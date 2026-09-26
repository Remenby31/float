import { useEffect, useRef } from 'react';

// Keeps keyboard navigation inside the foremost overlay and restores its trigger.
export function useDialogFocus() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (!root) return;
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], [contenteditable="true"]';
    const visible = () => Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((item) => item.getClientRects().length > 0);
    if (!root.contains(document.activeElement)) (visible()[0] ?? root).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || document.querySelector('[data-floating-overlay="true"]')) return;
      const elements = visible();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return ref;
}
