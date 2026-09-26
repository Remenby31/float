import { CheckIcon } from '@/components/icons';

export function TaskCheckbox({ checked, onClick, label = 'toggle done' }: { checked: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={`task-checkbox ${checked ? 'is-checked' : ''}`}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      type="button"
    >
      <span className="task-checkbox-box">{checked ? <CheckIcon size={12} /> : null}</span>
    </button>
  );
}
