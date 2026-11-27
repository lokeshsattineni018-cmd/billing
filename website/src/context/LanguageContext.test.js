import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translations } from './LanguageContext.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '..');

function collectSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('LanguageContext translations', () => {
  it('keeps en and te key sets identical', () => {
    const enKeys = Object.keys(translations.en).sort();
    const teKeys = Object.keys(translations.te).sort();
    expect(teKeys).toEqual(enKeys);
  });

  it('defines companyTitle as VIJAYA DURGA AGENCIES in both en and te', () => {
    expect(translations.en.companyTitle).toBe('VIJAYA DURGA AGENCIES');
    expect(translations.te.companyTitle).toBe('VIJAYA DURGA AGENCIES');
  });

  it('contains every static t(...) key referenced across website/src in both en and te', () => {
    const files = collectSourceFiles(srcRoot);
    const missingInEn = [];
    const missingInTe = [];
    const callPattern = /(?:^|[^\w$.])t\(\s*(['"`])([^'"`]+)\1\s*\)/g;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      let match;
      while ((match = callPattern.exec(content)) !== null) {
        const key = match[2];
        const rel = path.relative(srcRoot, filePath);
        if (!Object.prototype.hasOwnProperty.call(translations.en, key)) {
          missingInEn.push(`${rel}: ${key}`);
        }
        if (!Object.prototype.hasOwnProperty.call(translations.te, key)) {
          missingInTe.push(`${rel}: ${key}`);
        }
      }
    }

    expect(missingInEn).toEqual([]);
    expect(missingInTe).toEqual([]);
  });
});
