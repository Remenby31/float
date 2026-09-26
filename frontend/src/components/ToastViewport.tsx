import { useToastStore } from '@/stores/toast-store';

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4 safe-bottom">
      {toasts.map((item) => (
        <button
          aria-label={`${item.message}. Dismiss notification`}
          className={`toast-message pointer-events-auto max-w-md text-left ${item.kind === 'error' ? 'is-error' : ''}`}
          key={item.id}
          onClick={() => dismiss(item.id)}
          type="button"
        >
          {item.message}
          <span aria-hidden="true" className="text-text-muted">×</span>
        </button>
      ))}
    </div>
  );
}
