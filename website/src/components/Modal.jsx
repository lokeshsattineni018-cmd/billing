import { useEffect, useRef } from 'react';

let openModalCount = 0;
let previousBodyOverflow = '';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
}

/**
 * Accessible shared Modal / Dialog wrapper (WCAG 2.2 AA).
 * Provides role="dialog", aria-modal="true", aria-labelledby / aria-label,
 * focus trap (Tab/Shift+Tab), Escape close, focus restoration, and body scroll lock.
 */
export default function Modal({
  isOpen = true,
  onClose,
  labelledBy,
  ariaLabel,
  disableBackdropClose = false,
  disableEscapeClose = false,
  maxWidth = '500px',
  alignTop = false,
  zIndex,
  backdropStyle = {},
  contentClassName = 'modal-content fade-in',
  contentStyle = {},
  children,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    const frameId = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.contains(document.activeElement)) return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    });

    const handleKeyDown = (e) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (e.key === 'Escape' && !disableEscapeClose) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements(dialog);
        if (focusable.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, disableEscapeClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        ...(alignTop ? { alignItems: 'flex-start', overflowY: 'auto', padding: '24px 16px' } : {}),
        ...(zIndex !== undefined ? { zIndex } : {}),
        ...backdropStyle,
      }}
      onClick={() => {
        if (!disableBackdropClose) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || undefined}
        aria-label={!labelledBy ? ariaLabel || 'Dialog' : undefined}
        tabIndex={-1}
        className={contentClassName}
        style={{
          maxWidth,
          outline: 'none',
          ...(alignTop ? { margin: '20px auto' } : {}),
          ...contentStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
