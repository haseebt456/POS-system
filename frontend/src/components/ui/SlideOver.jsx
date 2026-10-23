import { useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import Button from './Button';
import Icon from './Icon';
import styles from './SlideOver.module.css';

// The right-hand panel every add/edit form in the reference uses, in place of a centred modal.
//
// It is the right shape for this app specifically because the window is 900x600: a centred
// modal covers the list you are editing from, and on a till you are very often copying a
// detail off the row behind it. The panel leaves that row visible.
//
// Three things it owes the user, none of which a plain <div> gets for free:
//
//   - Escape closes it.
//   - Focus moves in on open and returns to whatever opened it on close, so a keyboard user
//     is not dropped back at the top of the document.
//   - Tab cycles within the panel, which is what makes aria-modal="true" an honest claim
//     rather than a lie a screen reader passes on to the user.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function SlideOver({ title, subtitle, onClose, footer, width, children, className }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Wrapping at the ends is the whole trap. Without it, Tab from the last control lands on
      // the sidebar behind the scrim — reachable and clickable through a panel that claims to
      // be modal.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Capture phase: the panel's own controls stop propagation on some keys, and the trap has
    // to see Tab before anything else does.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    restoreRef.current = document.activeElement;

    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    return () => {
      // `?.` on the method as well as the ref: the opener can be unmounted by the time this
      // runs — a row that was removed, a button that no longer renders — and calling focus()
      // on a detached node throws.
      restoreRef.current?.focus?.();
    };
  }, []);

  // The page behind must not scroll while the panel is up. The panel is a fixed overlay on a
  // scrolling document, so without this the wheel still moves the list underneath it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    // mousedown rather than click: a click that *starts* inside the panel and ends on the
    // scrim — which is what dragging over the panel's edge does — is a mis-drag, not a
    // dismissal, and closing on it loses whatever was typed.
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className={cx(styles.panel, className)}
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </Button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </aside>
    </div>
  );
}

export default SlideOver;
