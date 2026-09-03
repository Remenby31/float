import { useToastStore } from '@/stores/toast-store';

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4 safe-bottom">
      {toasts.map((item) => (
        <button
          className={`pointer-events-auto max-w-md rounded-xl border px-3.5 py-2 text-sm shadow-lg backdrop-blur-xl transition ${
            item.kind === 'error'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-success/30 bg-success/10 text-success'
          }`}
          key={item.id}
          onClick={() => dismiss(item.id)}
          type="button"
        >
          {item.message}
        </button>
      ))}
    </div>
  );
}
