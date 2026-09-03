import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ColorPickerProps {
  color: string | null;
  icon: string | null;
  onChange: (color: string | null, icon: string | null) => unknown | Promise<unknown>;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#F43F5E',
  '#78716C', '#525252', '#84CC16', '#14B8A6', '#0EA5E9',
  '#8B5CF6', '#F472B6', '#FB923C', '#FBBF24', '#34D399',
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
      const width = 236;
      const left = Math.min(rect.right + 8, window.innerWidth - width - 8);
      const top = Math.min(Math.max(8, rect.top - 8), window.innerHeight - 360);
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
    if (/^#[0-9a-fA-F]{3,8}$/.test(nextColor)) void pickColor(nextColor);
  };

  return (
    <>
      <button ref={triggerRef} aria-label="change project appearance" className="shrink-0 transition-transform hover:scale-125" onClick={openPicker} type="button">
        {icon ? <span className="text-sm leading-none">{icon}</span> : <span className="block h-2.5 w-2.5 rounded-full" style={{ background: color ?? '#525252' }} />}
      </button>

      {open
        ? createPortal(
            <>
              <button aria-label="close appearance picker" className={`fixed inset-0 z-[75] ${mobile ? 'bg-black/50 backdrop-blur-[2px]' : ''}`} data-floating-overlay="true" onClick={() => setOpen(false)} type="button" />
              <section
                className={`${mobile ? 'modal-in fixed inset-x-0 bottom-0 z-[80] rounded-t-2xl safe-bottom' : 'modal-in z-[80] w-56 rounded-xl'} overflow-hidden border border-border bg-elevated shadow-2xl`}
                data-floating-overlay="true"
                style={mobile ? undefined : position}
              >
                <div className="flex border-b border-border">
                  {(['color', 'icon'] as const).map((item) => (
                    <button className={`flex-1 py-2 text-center text-[11px] ${tab === item ? 'border-b-2 border-accent text-text' : 'text-text-muted hover:text-text-secondary'}`} key={item} onClick={() => setTab(item)} type="button">{item}</button>
                  ))}
                </div>

                {tab === 'color' ? (
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          aria-label={`color ${preset}`}
                          className={`h-7 w-7 rounded-lg transition hover:scale-110 ${!icon && color === preset ? 'ring-2 ring-accent ring-offset-2 ring-offset-elevated' : ''}`}
                          key={preset}
                          onClick={() => void pickColor(preset)}
                          style={{ background: preset }}
                          type="button"
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input className="field !rounded-lg !px-2 !py-1 !text-xs" onChange={(event) => setCustomColor(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyCustomColor()} placeholder="#6366f1" value={customColor} />
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
                      <input className="field !rounded-lg !px-2 !py-1 !text-xs" maxLength={8} onChange={(event) => setCustomIcon(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && customIcon.trim() && void pickIcon(customIcon.trim())} placeholder="paste an emoji" value={customIcon} />
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
