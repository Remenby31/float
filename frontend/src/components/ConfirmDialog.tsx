import { useEffect, useId, useState } from 'react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'delete', onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useDialogFocus();
  const titleId = useId();
  const messageId = useId();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center px-4">
      <button aria-label="close confirmation" className="fade-in overlay-backdrop" onClick={onCancel} tabIndex={-1} type="button" />
      <section ref={dialogRef} aria-labelledby={titleId} aria-describedby={messageId} aria-modal="true" className="dialog-surface modal-in relative w-full max-w-sm p-7" role="alertdialog" tabIndex={-1}>
        <p className="eyebrow mb-4">A quick check</p>
        <h2 className="section-title" id={titleId}>{title}</h2>
        <p className="mt-4 text-sm leading-6 text-text-muted" id={messageId}>{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button" disabled={pending} onClick={onCancel} type="button">cancel</button>
          <button className="primary-button" disabled={pending} onClick={async () => { setPending(true); try { await onConfirm(); } catch { setPending(false); } }} type="button">{pending ? 'Working…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
