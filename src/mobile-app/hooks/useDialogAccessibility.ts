import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogAccessibilityOptions {
  open: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  dialogKey?: string;
  isolateBackground?: boolean;
}

type DialogNodeRef = (node: HTMLElement | null) => void;

export function useDialogAccessibility({
  open,
  onClose,
  closeOnEscape = true,
  dialogKey = 'dialog',
  isolateBackground = true,
}: DialogAccessibilityOptions): DialogNodeRef {
  const onCloseRef = useRef(onClose);
  const activeDialogRef = useRef<HTMLElement | null>(null);
  const setActiveDialogNode = useCallback((node: HTMLElement | null) => {
    activeDialogRef.current = node;
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = activeDialogRef.current;
    if (!dialog) return undefined;
    const isolatedElements: Array<{ element: HTMLElement; inert: boolean; ariaHidden: string | null }> = [];
    let activeBranch: HTMLElement = dialog;
    let parent = dialog.parentElement;

    while (isolateBackground && parent && parent !== document.body) {
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === activeBranch || !(sibling instanceof HTMLElement)) return;
        isolatedElements.push({ element: sibling, inert: sibling.inert, ariaHidden: sibling.getAttribute('aria-hidden') });
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      });
      activeBranch = parent;
      parent = parent.parentElement;
    }

    const focusFirstControl = window.requestAnimationFrame(() => {
      const preferred = dialog.querySelector<HTMLElement>('[autofocus]');
      const first = preferred || dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) || dialog;
      first.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.removeEventListener('keydown', onKeyDown);
      isolatedElements.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [closeOnEscape, dialogKey, isolateBackground, open]);

  return setActiveDialogNode;
}
