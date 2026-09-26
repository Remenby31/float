import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ColorPickerProps {
  color: string | null;
  icon: string | null;
  onChange: (color: string | null, icon: string | null) => unknown | Promise<unknown>;
}

const PRESET_COLORS = [
  '#F45B24', '#B95F43', '#AB884C', '#808B68', '#66877D',
  '#708391', '#89829B', '#A5777B', '#8A776A', '#78766E',
  '#30302D', '#53534E', '#94928B', '#C5C4BC', '#EFEEEA',
];

const PRESET_ICONS = ['📌', '🚀', '🧭', '🛠️', '💡', '📚', '🎯', '🌱', '🏠', '💼', '🧪', '🎨', '🧠', '⚡', '🗂️', '🛰️', '📝', '🔭', '🧩', '🌊'];

export function ColorPicker({ color, icon, onChange }: ColorPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'color' | 'icon'>(icon ? 'icon' : 'color');
  const [customColor, setCustomColor] = useState(color ?? '');
  const [customIcon, setCustomIcon] = useState(icon ?? '');
  const [mobile, setMobile] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const openPicker = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const isMobile = window.innerWidth < 768;
    setMobile(isMobile);
    setTab(icon ? 'icon' : 'color');
    setCustomColor(color ?? '');
    setCustomIcon(icon ?? '');
    if (!isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = 256;
      const left = Math.min(rect.right + 8, window.innerWidth - width - 8);
      const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 360));
      setPosition({ position: 'fixed', left, top });
    }
    setOpen(true);
  };

  const pickColor = async (nextColor: string | null) => {
    await onChange(nextColor, null);
    setOpen(false);
  };

  const pickIcon = async (nextIcon: string | null) => {
    await onChange(color, nextIcon);
    setOpen(false);
  };

  const applyCustomColor = () => {
    let nextColor = customColor.trim();
    if (!nextColor.startsWith('#')) nextColor = `#${nextColor}`;
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(nextColor)) void pickColor(nextColor);
  };

  return (
    <>
      <button ref={triggerRef} aria-label="change project appearance" aria-expanded={open} className="project-appearance" onClick={openPicker} type="button">
        {icon ? <span className="text-sm leading-none">{icon}</span> : <span className="block h-2 w-2" style={{ background: color ?? 'var(--color-border-strong)' }} />}
      </button>

      {open
        ? createPortal(
            <>
              <button aria-label="close appearance picker" className={`fixed inset-0 z-[75] ${mobile ? 'bg-black/50' : ''}`} data-floating-overlay="true" onClick={() => setOpen(false)} type="button" />
              <section
                aria-label="Project appearance"
                className={`${mobile ? 'modal-in fixed inset-x-0 bottom-0 z-[80] rounded-t-lg safe-bottom' : 'modal-in z-[80] w-64'} popover-panel overflow-hidden`}
                data-floating-overlay="true"
                style={mobile ? undefined : position}
              >
                <div className="flex border-b border-border">
                  {(['color', 'icon'] as const).map((item) => (
                    <button aria-pressed={tab === item} className={`min-h-11 flex-1 text-center text-xs ${tab === item ? 'border-b-2 border-accent text-text' : 'text-text-muted hover:text-text-secondary'}`} key={item} onClick={() => setTab(item)} type="button">{item}</button>
                  ))}
                </div>

                {tab === 'color' ? (
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          aria-label={`color ${preset}`}
                          className={`h-9 w-full rounded-sm transition hover:opacity-70 ${!icon && color === preset ? 'ring-2 ring-accent ring-offset-2 ring-offset-elevated' : ''}`}
                          key={preset}
                          onClick={() => void pickColor(preset)}
                          style={{ background: preset }}
                          type="button"
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input aria-label="Custom color" className="field min-w-0 !px-2 !py-1 !text-xs" onChange={(event) => setCustomColor(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyCustomColor()} placeholder="#F45B24" value={customColor} />
                      <button className="rounded-lg bg-surface px-2 text-xs text-text-secondary hover:text-text" onClick={applyCustomColor} type="button">apply</button>
                    </div>
                    {color ? <button className="text-[10px] text-text-muted hover:text-danger" onClick={() => void pickColor(null)} type="button">reset color</button> : null}
                  </div>
                ) : (
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-5 gap-1.5">
                      {PRESET_ICONS.map((preset) => (
                        <button className={`grid h-8 w-8 place-items-center rounded-lg text-base hover:bg-surface ${icon === preset ? 'bg-surface ring-1 ring-accent' : ''}`} key={preset} onClick={() => void pickIcon(preset)} type="button">{preset}</button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input aria-label="Custom icon" className="field min-w-0 !px-2 !py-1 !text-xs" maxLength={8} onChange={(event) => setCustomIcon(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && customIcon.trim() && void pickIcon(customIcon.trim())} placeholder="paste an emoji" value={customIcon} />
                      <button className="rounded-lg bg-surface px-2 text-xs text-text-secondary hover:text-text" onClick={() => customIcon.trim() && void pickIcon(customIcon.trim())} type="button">apply</button>
                    </div>
                    {icon ? <button className="text-[10px] text-text-muted hover:text-danger" onClick={() => void pickIcon(null)} type="button">reset icon</button> : null}
                  </div>
                )}
              </section>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
