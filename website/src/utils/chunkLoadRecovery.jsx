import React, { lazy } from 'react';
import {
  CHUNK_RELOAD_STORAGE_KEY,
  RELOAD_COOLDOWN_MS,
  isChunkLoadError,
  handleChunkReloadAttempt
} from './chunkLoadRecoveryLogic';

export {
  CHUNK_RELOAD_STORAGE_KEY,
  RELOAD_COOLDOWN_MS,
  isChunkLoadError,
  handleChunkReloadAttempt
};

/**
 * Standalone bilingual fallback component when chunk cannot be loaded.
 */
export function ChunkLoadFallback({ onReload }) {
  const handleReload = () => {
    if (onReload) onReload();
    else if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  return (
    <div
      className="chunk-load-error-container"
      style={{
        minHeight: '260px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 16px',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderRadius: '16px',
          padding: '24px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#ffedd5',
            color: '#c2410c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            margin: '0 auto 14px auto',
          }}
        >
          🔄
        </div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
          App Update Available or Offline
        </h3>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.92rem', fontWeight: 700, color: '#0b5394' }}>
          యాప్ నవీకరణ అందుబాటులో ఉంది లేదా నెట్‌వర్క్ డిస్‌కనెక్ట్ అయింది
        </p>
        <p style={{ margin: '0 0 18px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
          A newer version of the billing application was published or the network connection dropped. Please tap Reload to continue.
          <br />
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            దయచేసి తాజా వెర్షన్ లోడ్ చేయడానికి 'రీలోడ్' బటన్ నొక్కండి.
          </span>
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="btn btn-primary"
          style={{
            background: '#0b5394',
            color: '#ffffff',
            padding: '10px 24px',
            fontSize: '0.9rem',
            fontWeight: 800,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reload / రీలోడ్ చేయండి
        </button>
      </div>
    </div>
  );
}

/**
 * Wraps dynamic component import with automatic one-time reload on stale chunk,
 * loop prevention, and bilingual fallback UI.
 */
export function lazyWithRetry(importFn) {
  return lazy(async () => {
    try {
      const module = await importFn();
      // On successful import, clear the reload timestamp so future deploys can reload cleanly
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
        } catch {}
      }
      return module;
    } catch (error) {
      if (isChunkLoadError(error)) {
        const reloaded = handleChunkReloadAttempt();
        if (reloaded) {
          // Page is reloading; return a never-resolving promise while reload executes
          return new Promise(() => {});
        }
      }
      // If already reloaded once (e.g. offline) or reload prevented, render ChunkLoadFallback
      return {
        default: (props) => <ChunkLoadFallback {...props} />,
      };
    }
  });
}
