import { describe, it, expect } from 'vitest';
import {
  deriveApiOrigin,
  generatePreconnectTags,
  injectPreconnectIntoHtml
} from './preconnectPlugin';

describe('API Origin Preconnect & DNS-Prefetch HTML Transform Unit Tests', () => {
  it('correctly derives origin from absolute HTTP and HTTPS URLs', () => {
    expect(deriveApiOrigin('https://srsf-backend.onrender.com/api')).toBe('https://srsf-backend.onrender.com');
    expect(deriveApiOrigin('http://localhost:5001/api')).toBe('http://localhost:5001');
    expect(deriveApiOrigin('https://billing-api.custom-domain.in:8443/v1/api/')).toBe('https://billing-api.custom-domain.in:8443');
  });

  it('safely handles relative paths, undefined, empty, or invalid URLs by returning empty string', () => {
    expect(deriveApiOrigin('/api')).toBe('');
    expect(deriveApiOrigin('')).toBe('');
    expect(deriveApiOrigin(null)).toBe('');
    expect(deriveApiOrigin(undefined)).toBe('');
    expect(deriveApiOrigin('not-a-valid-url')).toBe('');
  });

  it('generates preconnect and dns-prefetch link tags with correct attributes', () => {
    const tags = generatePreconnectTags('https://srsf-backend.onrender.com');
    expect(tags).toContain('<link rel="dns-prefetch" href="https://srsf-backend.onrender.com" />');
    expect(tags).toContain('<link rel="preconnect" href="https://srsf-backend.onrender.com" crossorigin />');
  });

  it('replaces placeholder with preconnect links when API URL origin is available', () => {
    const rawHtml = '<head>\n    <!-- %API_PRECONNECT% -->\n    <title>App</title>\n</head>';
    const transformed = injectPreconnectIntoHtml(rawHtml, 'https://srsf-backend.onrender.com/api');

    expect(transformed).toContain('<link rel="preconnect" href="https://srsf-backend.onrender.com" crossorigin />');
    expect(transformed).toContain('<link rel="dns-prefetch" href="https://srsf-backend.onrender.com" />');
    expect(transformed).not.toContain('<!-- %API_PRECONNECT% -->');
  });

  it('cleanly removes placeholder when no external API URL is configured (same-origin)', () => {
    const rawHtml = '<head>\n    <!-- %API_PRECONNECT% -->\n    <title>App</title>\n</head>';
    const transformed = injectPreconnectIntoHtml(rawHtml, '/api');

    expect(transformed).not.toContain('<!-- %API_PRECONNECT% -->');
    expect(transformed).not.toContain('<link rel="preconnect"');
  });
});
