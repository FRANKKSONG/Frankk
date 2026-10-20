import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { Popover } from './Popover';
import { ColorSelect } from './ColorSelect';
import { Select, Switch } from './Select';
import { useUpdates } from './DesktopBits';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { CLEAR_CHOICES } from '../data/storage';
import { usePersistentState } from '../hooks/usePersistentState';
import { accelerator, desktop, prettyKeys, type Card, type DesktopState, type Layer } from '../lib/desktop';
import { DEFAULT_WINDOW, THEMES, themeColor, themeOf, type ThemeId, type ThemePrefs, type WindowPrefs } from '../lib/theme';
import { artPresets, downscaleImage } from '../lib/art';
import type { Data } from '../data/model';

type Props = { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void };

/** The gear: on the website a menu; in the desktop app it opens the Settings card. */
export function SettingsMenu(props: Props) {
  const gear = (p: { onClick: () => void; open?: boolean; ref?: React.Ref<HTMLButtonElement> }) => (
    <button ref={p.ref} className="icon-btn" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded={!!p.open} onClick={p.onClick}><Icon name="settings" size={18} /></button>
  );
  if (desktop) return gear({ onClick: () => desktop!.openSettings() });
  return (
    <Popover align="right" className="wide-pop settings-pop" trigger={({ toggle, ref, open }) => gear({ onClick: toggle, open, ref })}>
      {() => <SettingsPanel {...props} />}
    </Popover>
  );
}

const SECTIONS: { id: string; label: string; icon: IconName; desktopOnly?: boolean }[] = [
  { id: 'desktop', label: 'Desktop', icon: 'monitor', desktopOnly: true },
  { id: 'cards', label: 'Cards', icon: 'layout', desktopOnly: true },
  { id: 'look', label: 'Look', icon: 'palette' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'about', label: 'About', icon: 'info' },
];

/** A row like Windows 11 Settings: what it is and what it does on the left, the control on the right. */
function Row({ label, hint, children, wide }: { label: string; hint?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <div className={`set-row${wide ? ' wide' : ''}`}>
      <div className="set-text"><b>{label}</b>{hint && <small>{hint}</small>}</div>
      {children && <div className="set-control">{children}</div>}
    </div>
  );
}

/** All the settings. In the desktop app: a sidebar of sections; on the website: the sections one after another. */
export function SettingsPanel(props: Props) {
  const [st, setSt] = useState<DesktopState | null>(null);
  useEffect(() => {
    if (!desktop) return;
    const get = () => desktop!.state().then(setSt);
    get();
    return desktop.onChanged(get);
  }, []);
  const sections = SECTIONS.filter((s) => !s.desktopOnly || desktop);
  const [section, setSection] = usePersistentState<string>('settings.section', sections[0].id);
  const current = sections.some((s) => s.id === section) ? section : sections[0].id;
  const body = (id: string) => {
    switch (id) {
      case 'desktop': return st && <DesktopSection st={st} setSt={setSt} />;
      case 'cards': return st && <CardsSection st={st} setSt={setSt} />;
      case 'look': return <LookSection {...props} />;
      case 'tasks': return <TasksSection />;
      default: return <AboutSection />;
    }
  };
  if (!desktop) {
    return <div className="settings stacked">{sections.map((s) => <section key={s.id} className="set-section"><h3>{s.label}</h3>{body(s.id)}</section>)}</div>;
  }
  return (
    <div className="settings two-pane">
      <nav className="set-nav" aria-label="Settings sections">
        {sections.map((s) => (
          <button key={s.id} className={current === s.id ? 'on' : ''} aria-current={current === s.id ? 'page' : undefined} onClick={() => setSection(s.id)}>
            <Icon name={s.icon} size={16} />{s.label}
          </button>
        ))}
      </nav>
      <div className="set-body"><h3>{sections.find((s) => s.id === current)!.label}</h3>{body(current)}</div>
    </div>
  );
}

const LAYERS: { id: Layer; label: string; hint: string }[] = [
  { id: 'desktop', label: 'On the desktop', hint: 'Under all your windows, like a Rainmeter skin. The shortcut brings the cards forward until you click elsewhere.' },
  { id: 'normal', label: 'Like a window', hint: 'A card comes to the front when you click it, like any app.' },
  { id: 'top', label: 'Always on top', hint: 'The cards stay above every other window.' },
];

function DesktopSection({ st, setSt }: { st: DesktopState; setSt: (s: DesktopState) => void }) {
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className="set-group">
      <Row label="Show and hide" hint={note || (!st.shortcutOk ? 'Another app already uses these keys. Pick others.' : 'Shows or hides every card from anywhere.')}>
        <button className={`btn keys${recording ? ' recording' : ''}`}
          onClick={() => { setRecording(true); setNote('Press the new keys, with Ctrl or Alt…'); }}
          onBlur={() => { setRecording(false); setNote(''); }}
          onKeyDown={async (e) => {
            if (!recording) return;
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') { setRecording(false); setNote(''); return; }
            const a = accelerator(e);
            if (!a) return;
            const next = await desktop!.set({ shortcut: a });
            setSt(next); setRecording(false);
            setNote(next.shortcut === a ? '' : `${prettyKeys(a)} is taken by another app. Kept ${prettyKeys(next.shortcut)}.`);
          }}>{recording ? 'Press keys…' : prettyKeys(st.shortcut)}</button>
      </Row>
      <Row label="Where the cards sit" hint={LAYERS.find((l) => l.id === st.layer)!.hint + (st.layer === 'desktop' && !st.pinsToDesktop ? ' (Works on Windows only.)' : '')}>
        <Select label="Where the cards sit" value={st.layer} onChange={async (layer) => setSt(await desktop!.set({ layer }))} options={LAYERS.map((l) => ({ value: l.id, label: l.label }))} />
      </Row>
      <Row label="Size" hint="Makes every card bigger or smaller.">
        <Select label="Size" value={st.scale} onChange={async (scale) => setSt(await desktop!.set({ scale }))} options={st.scales.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }))} />
      </Row>
      <Row label="Snap cards into line" hint="When you let go of a card, it lines up with the others and the screen edges, with even gaps.">
        <Switch label="Snap cards into line" on={st.snap} onChange={async (snap) => setSt(await desktop!.set({ snap }))} />
      </Row>
      <Row label="Start with Windows" hint="Esther opens when you sign in.">
        <Switch label="Start with Windows" on={st.startWithWindows} onChange={async (startWithWindows) => setSt(await desktop!.set({ startWithWindows }))} />
      </Row>
    </div>
  );
}

const CARD_LABEL: Record<Card, { label: string; hint: string }> = {
  header: { label: 'Header', hint: 'The Esther logo, the greeting and the day’s line.' },
  tasks: { label: 'Tasks', hint: 'Your lists and the task table.' },
  calendar: { label: 'Calendar', hint: 'The month. Pick a day to filter Tasks.' },
  week: { label: 'This week', hint: 'Monday to Sunday at a glance.' },
  settings: { label: 'Settings', hint: '' },
};

function CardsSection({ st, setSt }: { st: DesktopState; setSt: (s: DesktopState) => void }) {
  const { say } = useUi();
  return (
    <div className="set-group">
      {st.cards.map((c) => (
        <Row key={c.id} label={CARD_LABEL[c.id].label} hint={CARD_LABEL[c.id].hint}>
          <Switch label={`Show the ${CARD_LABEL[c.id].label} card`} on={c.on} onChange={async (on) => setSt(await desktop!.set({ card: { id: c.id, on } }))} />
        </Row>
      ))}
      <Row label="Put the cards back" hint="Every card goes back to where it started. Double-clicking the Esther logo does this too.">
        <button className="btn" onClick={() => { desktop!.resetLayout(); say('Cards are back in their places.'); }}>Put back</button>
      </Row>
    </div>
  );
}

function LookSection({ theme: prefs, setTheme: setPrefs }: Props) {
  const win = { ...DEFAULT_WINDOW, ...prefs.window };
  const setWin = (patch: Partial<WindowPrefs>) => setPrefs({ ...prefs, window: { ...win, ...patch } });
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="theme-cards" role="radiogroup" aria-label="Look">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => (
          <button key={id} role="radio" aria-checked={themeOf(prefs) === id} className={`theme-card look-${id}`} onClick={() => setPrefs({ ...prefs, theme: id, colors: {} })}>
            <span className="swatches">{(['bg-2', 'bg-3', 'accent', 'gold', 'text'] as const).map((k) => <i key={k} style={{ background: THEMES[id].vars[k] }} />)}</span>
            <b>{THEMES[id].label}</b><small>{THEMES[id].blurb}</small>
          </button>
        ))}
      </div>
      <div className="set-group">
        <Row label="Panel colour" hint="Any colour. Text turns light or dark by itself to stay readable.">
          {win.panelColor && <button className="link-btn" onClick={() => setWin({ panelColor: undefined })}>Use the look’s</button>}
          <ColorSelect label="Panel colour" value={win.panelColor ?? THEMES[themeOf(prefs)].vars['bg-2']} onChange={(c) => setWin({ panelColor: c })} />
        </Row>
        <Row label="Opacity" hint="How solid the panels are.">
          <input type="range" min={0.2} max={1} step={0.01} value={win.opacity} aria-label="Panel opacity" onChange={(e) => setWin({ opacity: Number(e.target.value) })} /><output>{Math.round(win.opacity * 100)}%</output>
        </Row>
        <Row label={desktop ? 'Blur behind the cards' : 'Background blur'} hint={desktop ? 'How much the wallpaper behind each card is blurred. 0 shows it sharp.' : 'How much the page background is blurred behind the panels.'}>
          <input type="range" min={0} max={60} step={1} value={win.blur} aria-label="Blur" onChange={(e) => setWin({ blur: Number(e.target.value) })} /><output>{win.blur}px</output>
        </Row>
        <Row label="Highlight colour" hint="Today, the selected tab, ticks and buttons.">
          {!!Object.keys(prefs.colors).length && <button className="link-btn" onClick={() => setPrefs({ ...prefs, colors: {} })}>Use the look’s</button>}
          <ColorSelect label="Highlight colour" value={themeColor(prefs, 'accent')} onChange={(c) => setPrefs({ ...prefs, colors: { ...prefs.colors, accent: c } })} />
        </Row>
        {!desktop && (
          <Row label="Page background" hint="Art or a plain colour behind the page." wide>
            <div className="bg-tiles">
              {artPresets().filter((a) => a.id !== 'none').map((a) => (
                <button key={a.id} className={`bg-tile${win.background === a.id ? ' on' : ''}`} style={{ backgroundImage: a.css, backgroundSize: a.tile ? '120px' : 'cover' }} aria-pressed={win.background === a.id} onClick={() => setWin({ background: a.id })}><span>{a.name}</span></button>
              ))}
              <button className={`bg-tile${win.background === 'color' ? ' on' : ''}`} style={{ background: win.color }} onClick={() => setWin({ background: 'color' })}><span>Plain colour</span></button>
              <button className="bg-tile upload" onClick={() => fileRef.current?.click()}><span><Icon name="plus" size={12} /> My image</span></button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setWin({ background: await downscaleImage(f) }); }} />
          </Row>
        )}
        <Row label="Start over" hint="The look’s own panels, opacity and blur."><button className="btn" onClick={() => setPrefs({ ...prefs, window: DEFAULT_WINDOW })}>Reset</button></Row>
      </div>
    </>
  );
}

function TasksSection() {
  const { data, dispatch, startFresh } = useStore();
  const { say } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sure, setSure] = useState(false);
  const [clearAfter, setClearAfter] = usePersistentState<number>('clearAfter', 7);
  const exportCopy = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `esther-tasks-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importCopy = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as Data;
      if (!Array.isArray(d?.lists) || !d.lists.length || !Array.isArray(d.tasks)) throw new Error('not Esther');
      dispatch({ type: 'replace', data: { version: 1, lists: d.lists, tasks: d.tasks.map((t) => ({ ...t, subtasks: t.subtasks ?? [] })) } });
      say(`Loaded ${d.tasks.length} task${d.tasks.length === 1 ? '' : 's'} in ${d.lists.length} list${d.lists.length === 1 ? '' : 's'}.`, true);
    } catch { say('That file isn’t a copy saved from Esther.'); }
  };
  return (
    <div className="set-group">
      <Row label="Finished tasks" hint="They stay crossed out, then clear themselves.">
        <Select label="When finished tasks clear" value={clearAfter} onChange={setClearAfter} options={CLEAR_CHOICES.map((c) => ({ value: c.days, label: c.label }))} />
      </Row>
      <Row label="Save a copy" hint={`${data.lists.length} list${data.lists.length === 1 ? '' : 's'} and ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'}, saved on this PC. Keep a copy, or move them to another PC.`}>
        <button className="btn" onClick={exportCopy}>Save…</button>
      </Row>
      <Row label="Load a copy" hint="Replaces your lists and tasks with a saved copy. Ctrl+Z undoes it.">
        <button className="btn" onClick={() => fileRef.current?.click()}>Load…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCopy(f); e.target.value = ''; }} />
      </Row>
      <Row label="Start fresh" hint={sure ? 'This deletes every list and task.' : 'Delete everything and start with the sample.'}>
        {!sure ? <button className="btn" onClick={() => setSure(true)}>Start fresh…</button>
          : <><button className="btn danger" onClick={() => { startFresh(); setSure(false); say('Started fresh.', true); }}>Delete everything</button><button className="btn ghost" onClick={() => setSure(false)}>Cancel</button></>}
      </Row>
    </div>
  );
}

function AboutSection() {
  const st = useUpdates();
  const text = st && {
    idle: 'Checks for updates a minute after starting, then every 4 hours.',
    checking: 'Checking for updates…',
    current: 'You have the latest version.',
    downloading: `Downloading ${st.next ?? 'the new version'}… ${st.percent ?? 0}%`,
    ready: `Version ${st.next} is ready to install.`,
    error: `Couldn’t check for updates (${st.error ?? 'no connection'}). It will try again later.`,
    dev: 'Updates are off while developing.',
    portable: 'The portable version doesn’t update itself. Install Esther with the Setup file to get updates.',
  }[st.state];
  return (
    <div className="set-group">
      <Row label={`Esther ${st?.version ?? __ESTHER_BUILD__}`} hint={text ?? 'A to-do list that lives on your desktop.'}>
        {st?.state === 'ready' ? <button className="btn primary" onClick={() => desktop!.updates.install()}>Restart to update</button>
          : st && ['idle', 'current', 'error'].includes(st.state) && <button className="btn" onClick={() => desktop!.updates.check()}>Check now</button>}
      </Row>
      {desktop && <Row label="Quit Esther" hint="Closes every card. Esther has no taskbar button; the tray icon by the clock has these settings too."><button className="btn" onClick={() => desktop!.quit()}>Quit</button></Row>}
    </div>
  );
}
