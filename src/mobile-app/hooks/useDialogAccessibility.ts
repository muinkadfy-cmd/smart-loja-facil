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

const dialogStack: Array<{ node: HTMLElement }> = [];
const backgroundLocks = new Map<HTMLElement, { count: number; inert: boolean; ariaHidden: string | null }>();
let bodyLockCount = 0;
let previousBodyOverflow = '';
let previousBodyOverflowPriority = '';

function isAvailableForFocus(element: HTMLElement): boolean {
  if (element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

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
    const entry = { node: dialog };
    dialogStack.push(entry);
    const isolatedElements: HTMLElement[] = [];
    const hadTabIndex = dialog.hasAttribute('tabindex');
    if (!hadTabIndex) dialog.tabIndex = -1;
    if (bodyLockCount === 0) {
      previousBodyOverflow = document.body.style.getPropertyValue('overflow');
      previousBodyOverflowPriority = document.body.style.getPropertyPriority('overflow');
      document.body.style.setProperty('overflow', 'hidden');
      document.documentElement.classList.add('mapp-dialog-open');
      document.body.classList.add('mapp-dialog-open');
    }
    bodyLockCount += 1;
    let activeBranch: HTMLElement = dialog;
    let parent = dialog.parentElement;

    while (isolateBackground && parent && parent !== document.body) {
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === activeBranch || !(sibling instanceof HTMLElement)) return;
        const lock = backgroundLocks.get(sibling);
        if (lock) lock.count += 1;
        else backgroundLocks.set(sibling, { count: 1, inert: sibling.inert, ariaHidden: sibling.getAttribute('aria-hidden') });
        isolatedElements.push(sibling);
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      });
      activeBranch = parent;
      parent = parent.parentElement;
    }

    const focusFirstControl = window.requestAnimationFrame(() => {
      if (dialogStack[dialogStack.length - 1] !== entry) return;
      const preferred = Array.from(dialog.querySelectorAll<HTMLElement>('[data-dialog-initial-focus], [autofocus]'))
        .find(isAvailableForFocus);
      // Focar a janela mantém o contexto sem abrir o teclado antes de o usuário escolher um campo.
      (preferred || dialog).focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== entry || event.defaultPrevented) return;
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => element.tabIndex >= 0 && isAvailableForFocus(element));

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === dialog || !dialog.contains(document.activeElement)) {
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
      const wasTopDialog = dialogStack[dialogStack.length - 1] === entry;
      const entryIndex = dialogStack.indexOf(entry);
      if (entryIndex >= 0) dialogStack.splice(entryIndex, 1);
      isolatedElements.forEach((element) => {
        const lock = backgroundLocks.get(element);
        if (!lock || --lock.count > 0) return;
        element.inert = lock.inert;
        if (lock.ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', lock.ariaHidden);
        backgroundLocks.delete(element);
      });
      bodyLockCount -= 1;
      if (bodyLockCount === 0) {
        if (previousBodyOverflow) document.body.style.setProperty('overflow', previousBodyOverflow, previousBodyOverflowPriority);
        else document.body.style.removeProperty('overflow');
        document.documentElement.classList.remove('mapp-dialog-open');
        document.body.classList.remove('mapp-dialog-open');
      }
      if (!hadTabIndex) dialog.removeAttribute('tabindex');
      if (wasTopDialog && previouslyFocused?.isConnected && isAvailableForFocus(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      } else if (wasTopDialog) {
        dialogStack[dialogStack.length - 1]?.node.focus({ preventScroll: true });
      }
    };
  }, [closeOnEscape, dialogKey, isolateBackground, open]);

  return setActiveDialogNode;
}
