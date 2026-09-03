import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'delete', onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center px-4">
      <button aria-label="close confirmation" className="fade-in absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onCancel} type="button" />
      <section aria-modal="true" className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-elevated p-5 shadow-2xl" role="alertdialog">
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="mt-1.5 text-sm leading-6 text-text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface hover:text-text" onClick={onCancel} type="button">cancel</button>
          <button className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white hover:brightness-105" onClick={() => void onConfirm()} type="button">{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
