export const CHUNK_RELOAD_STORAGE_KEY = 'srsf_chunk_retry_timestamp';
export const RELOAD_COOLDOWN_MS = 15000; // 15s cooldown prevents infinite reload loops

/**
 * Determines whether an error is a dynamic chunk loading failure.
 */
export function isChunkLoadError(error) {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  const name = (error.name || '').toLowerCase();
  return (
    name === 'chunkloaderror' ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('failed to load module script') ||
    msg.includes('unable to preload css') ||
    msg.includes('networkerror')
  );
}

/**
 * Handles automatic one-time reload and reload loop prevention.
 * Returns true if an auto-reload was scheduled/executed; false if already attempted.
 */
export function handleChunkReloadAttempt(
  storage = (typeof window !== 'undefined' ? window.sessionStorage : null),
  location = (typeof window !== 'undefined' ? window.location : null),
  currentTime = Date.now()
) {
  if (!storage || !location) return false;

  let lastReload = null;
  try {
    lastReload = storage.getItem(CHUNK_RELOAD_STORAGE_KEY);
  } catch {}

  const now = currentTime;

  // If reloaded within cooldown window, DO NOT auto-reload again -> prevents infinite loop
  if (lastReload && now - Number(lastReload) < RELOAD_COOLDOWN_MS) {
    return false;
  }

  try {
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {}

  if (typeof location.reload === 'function') {
    location.reload();
  }
  return true;
}
