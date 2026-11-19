/**
 * Utility for deriving API origin and generating preconnect / dns-prefetch HTML tags
 * at build time based on VITE_API_URL.
 */

export function deriveApiOrigin(apiUrl) {
  if (!apiUrl || typeof apiUrl !== 'string') return '';
  const trimmed = apiUrl.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).origin;
    }
  } catch {
    return '';
  }
  return '';
}

export function generatePreconnectTags(apiOrigin) {
  if (!apiOrigin) return '';
  return [
    `    <!-- API Origin Preconnect & DNS Prefetch (derived from VITE_API_URL at build time) -->`,
    `    <link rel="dns-prefetch" href="${apiOrigin}" />`,
    `    <link rel="preconnect" href="${apiOrigin}" crossorigin />`,
  ].join('\n');
}

export function injectPreconnectIntoHtml(html, apiUrl) {
  if (!html || typeof html !== 'string') return '';
  const origin = deriveApiOrigin(apiUrl);
  if (!origin) {
    return html.replace(/<!-- %API_PRECONNECT% -->\r?\n?/, '');
  }
  return html.replace('<!-- %API_PRECONNECT% -->', generatePreconnectTags(origin));
}
