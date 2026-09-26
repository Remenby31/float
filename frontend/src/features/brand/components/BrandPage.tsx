import { useState } from 'react';

import { Brand } from '@/components/Brand';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { CalendarIcon, CheckIcon, MoonIcon, PlusIcon, SearchIcon, SunIcon } from '@/components/icons';
import { useUiStore } from '@/stores/ui-store';

const colors = [
  { name: 'Paper', value: '#EFEEEA', role: 'Space to think', ink: '#30302d' },
  { name: 'Graphite', value: '#292927', role: 'After hours', ink: '#efeeea' },
  { name: 'Ink', value: '#30302D', role: 'Say it clearly', ink: '#efeeea' },
  { name: 'Signal', value: '#F45B24', role: 'A little progress', ink: '#292927' },
  { name: 'Pencil', value: '#68665F', role: 'The finer details', ink: '#ffffff' },
];

export function BrandPage() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const [checked, setChecked] = useState([true, false, false]);
  return (
    <div className="brand-page">
      <header className="brand-kit-header"><a aria-label="Back to Float" href="/app"><Brand /></a><span className="eyebrow">The brand book / Edition 01</span><button aria-label="toggle theme" className="secondary-button" onClick={toggleTheme} type="button">{theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}{theme === 'dark' ? 'Paper' : 'Graphite'}</button></header>
      <main>
        <section className="brand-kit-hero"><p className="eyebrow">Float / Daybook / September 2026</p><h1>MAKE<br />ROOM<span className="text-brand-orange">.</span></h1><div className="brand-hero-caption"><p>A little less on your mind.<br />An identity for a more considered everyday.</p><span className="eyebrow">Paper. Graphite. One orange square.</span></div></section>
        <div className="mb-8"><Download file="float-daybook-kit.zip" label="Download the complete kit" /></div>
        <nav aria-label="Brand kit sections" className="brand-kit-nav">{['Identity', 'Color', 'Typography', 'Components', 'Responsive', 'Voice'].map((name, index) => <a href={`#brand-${index + 1}`} key={name}><span>0{index + 1}</span>{name}</a>)}</nav>

        <section className="brand-kit-section" id="brand-1">
          <SectionHeading number="01" title="A name. A full stop." description="Float makes space. A confident, geometric wordmark, finished with a single orange square. Nothing decorative. Nothing in the way." />
          <div className="brand-logo-grid"><div className="brand-logo-sample brand-paper"><img alt="Float ink wordmark" src="/brand/wordmark-ink.svg" /><span className="eyebrow">Primary / Ink on Paper</span></div><div className="brand-logo-sample brand-graphite"><img alt="Float paper wordmark" src="/brand/wordmark-paper.svg" /><span className="eyebrow">Reversed / Paper on Graphite</span></div><div className="brand-icon-sample"><img alt="Float app icon" height="120" src="/brand/mark.svg" width="120" /><p className="text-sm text-text-muted">The F monogram.<br />Made for the smallest spaces.</p></div></div>
          <p className="brand-rule">Keep one cap-height of clear space. Minimum wordmark width: 80 px. Never stretch, outline, add a shadow, or change the orange square.</p>
          <div className="brand-downloads"><Download file="wordmark-ink.svg" label="Ink wordmark" /><Download file="wordmark-paper.svg" label="Paper wordmark" /><Download file="mark.svg" label="App mark" /><Download file="social-card.png" label="Social cover / 1200 × 630" /><a className="secondary-button" download href="/icon-512.png">App icon / 512 px ↓</a></div>
        </section>

        <section className="brand-kit-section" id="brand-2">
          <SectionHeading number="02" title="Quiet, with a signal." description="An almost-monochrome world. Orange marks a moment of progress, an active day, or the end of a sentence. It never fills the whole room." />
          <div className="brand-palette">{colors.map((color) => <div className="brand-swatch" key={color.name} style={{ background: color.value, color: color.ink }}><span className="brand-swatch-name">{color.name}</span><span>{color.role}</span><code>{color.value}</code></div>)}</div>
          <div className="brand-guidelines"><div><h3>Paper, by day.</h3><p>Paper background, Ink text, Pencil metadata. Hairlines use #C5C4BC. Text accents use the deeper #B83C0D for legibility.</p></div><div><h3>Graphite, by night.</h3><p>Graphite background, Paper text, #AAA79F metadata. Hairlines use #53534E. Text accents brighten to #FF8B59.</p></div><div><h3>Color has a job.</h3><p>Signal is for completion and emphasis. Errors have words and a red rule. Personal project colors stay as small markers, never tinted cards.</p></div></div>
          <div className="brand-downloads"><Download file="palette.svg" label="Color palette" /><Download file="tokens.json" label="Design tokens / JSON" /></div>
        </section>

        <section className="brand-kit-section" id="brand-3">
          <SectionHeading number="03" title="Let the type do the work." description="Geist for the everyday. Geist Mono for the details. Self-hosted, fast, and the same on your laptop and your phone." />
          <div className="brand-type-specimen"><span className="eyebrow">Geist Bold / 700 / −0.055em</span><p>MONDAY</p><span className="eyebrow">A strong start. No shouting required.</span></div>
          <div className="brand-guidelines"><div><h3>Display</h3><p className="section-title mt-3">One day<br />at a time.</p><p>42–80 px. Tight leading. Uppercase for page titles and days, never for task content.</p></div><div><h3>Body</h3><p className="mt-3 !text-base !text-text">Read 10 pages.<br />Walk the dog.<br />Make something good.</p><p>13–16 px. Sentence case. Comfortable line height. Task titles wrap, not truncate.</p></div><div><h3>Details</h3><p className="eyebrow mt-4">01 / September 21, 2026<br /><br />03 tasks / Personal</p><p>10–12 px. Monospaced labels, counts, dates and keyboard shortcuts. Always supporting.</p></div></div>
        </section>

        <section className="brand-kit-section" id="brand-4">
          <SectionHeading number="04" title="Every little thing." description="Actual interface components, using the same tokens as the app. Flat surfaces, thin rules, square controls, and enough room for a thumb." />
          <div className="brand-component-grid">
            <div className="brand-component"><h3 className="eyebrow">The task / Try checking one</h3>{['5 km run', 'Read 10 pages', 'Design a little less'].map((title, index) => <div className="day-task" key={title}><TaskCheckbox checked={checked[index]} label={`Complete ${title}`} onClick={() => setChecked((values) => values.map((value, i) => i === index ? !value : value))} /><span className={`day-task-title ${checked[index] ? 'task-done' : ''}`}>{title}</span></div>)}</div>
            <div className="brand-component"><h3 className="eyebrow">Actions & states</h3><div className="mt-5 flex flex-wrap items-center gap-3"><button className="primary-button" onClick={() => setChecked([true, true, true])} type="button"><CheckIcon size={14} />Complete all</button><button className="secondary-button" onClick={() => setChecked([false, false, false])} type="button">Reset</button><button className="primary-button" disabled type="button">Unavailable</button></div><div className="mt-5 flex items-center gap-3"><SearchIcon /><PlusIcon /><CalendarIcon /><SunIcon /><MoonIcon /><span className="spinner" aria-label="Loading example" /><kbd>⌘ K</kbd></div></div>
            <div className="brand-component"><h3 className="eyebrow">Fields & feedback</h3><label className="mt-5 block"><span className="field-label">A thought for later</span><input className="field" placeholder="Write it down…" /></label><p className="mt-3 text-xs text-text-muted">A clear label. An orange focus ring. No guessing.</p><p className="login-error mt-5">Something didn’t save. Please try again.</p></div>
            <div className="brand-component"><h3 className="eyebrow">Empty, not unfinished</h3><p className="section-title mt-6">A little room<br />to breathe.</p><p className="mt-3 text-sm text-text-muted">No tasks planned for today.</p><div className="toast-message mt-6"><CheckIcon size={15} />Task added. One less thing to remember.</div></div>
          </div>
        </section>

        <section className="brand-kit-section" id="brand-5">
          <SectionHeading number="05" title="Same thought. Any screen." description="A daybook, not a shrunken dashboard. Two open columns on a laptop. One deliberate, vertical reading order on mobile." />
          <div className="brand-responsive-grid"><div><div className="brand-layout-desktop"><div className="brand-layout-bar"><Brand compact /><span className="eyebrow">Your workspace</span></div><p className="section-title">Your week.</p><div className="grid grid-cols-2 gap-6"><div><MiniDay name="Monday" open /><MiniDay name="Tuesday" /><MiniDay name="Wednesday" /></div><div><MiniDay name="Personal" open /><MiniDay name="Work" open /></div></div></div><p className="brand-rule">Laptop / two columns / 56 px gutters / up to 1440 px</p></div><div><div className="brand-layout-mobile"><Brand compact /><p className="section-title mt-7 mb-6">Your week.</p><div className="eyebrow mb-5">Week — Projects</div><MiniDay name="Monday" open /><MiniDay name="Tuesday" /><MiniDay name="Wednesday" /></div><p className="brand-rule">Mobile / 20 px gutters / 44 px primary touch targets</p></div></div>
          <p className="brand-rule">At 768 px, Week and Projects become separate views. No horizontal agenda carousel. Dialogs become bottom sheets. Account keeps undo and redo within reach. Reduced-motion preferences are respected.</p>
        </section>

        <section className="brand-kit-section" id="brand-6">
          <SectionHeading number="06" title="A calmer kind of productive." description="Brief, useful, human. Float helps you remember; it doesn’t tell you to hustle. Progress is a quiet orange check, not confetti." />
          <div className="brand-guidelines"><div><h3>The promise</h3><p className="!text-xl !text-text">Make room for what matters.</p></div><div><h3>The signature</h3><p className="!text-xl !text-text">Less noise. More doing.</p></div><div><h3>The everyday</h3><p className="!text-xl !text-text">One day at a time.</p></div></div>
          <div className="brand-voice"><p><span className="eyebrow">Say</span> “A little room to breathe.”</p><p><span className="eyebrow">Not</span> “Crush your goals. Maximize your productivity!”</p></div>
        </section>
      </main>
      <footer className="workspace-footer"><Brand compact /><span className="eyebrow">Float / Daybook / Edition 01</span><a className="eyebrow" href="/app">Back to your day ↗</a></footer>
    </div>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="brand-section-intro"><div><p className="eyebrow mb-4">{number} / The essentials</p><h2>{title}</h2></div><p>{description}</p></div>;
}

function Download({ file, label }: { file: string; label: string }) {
  return <a className="secondary-button" download href={`/brand/${file}`}>{label} <span aria-hidden="true">↓</span></a>;
}

function MiniDay({ name, open = false }: { name: string; open?: boolean }) {
  return <div className="brand-mini-day"><h3>{name}</h3>{open ? <div><p><span className="brand-mini-check is-checked">✓</span><span className="task-done">Make a little room</span></p><p><span className="brand-mini-check" />Start something good</p><p className="!mt-6 text-text-muted">Add a new task…</p></div> : null}</div>;
}
