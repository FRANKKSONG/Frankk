import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { useUpdates } from './DesktopBits';
import { desktop, prettyKeys, type Card, type DesktopState, type Layer } from '../lib/desktop';

const CARD_NAMES: Partial<Record<Card, string>> = { header: 'Header', tasks: 'Tasks', calendar: 'Calendar', week: 'This week' };
const LAYER_NAMES: { id: Layer; label: string }[] = [
  { id: 'desktop', label: 'On the desktop' },
  { id: 'normal', label: 'Like a window' },
  { id: 'top', label: 'Always on top' },
];

/** The tray icon's menu (right-click), drawn by Esther so it's rounded and Windows 11 style like everything else. */
export function TrayMenu() {
  const [st, setSt] = useState<DesktopState | null>(null);
  const up = useUpdates();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const get = () => desktop!.state().then(setSt);
    get();
    return desktop!.onChanged(get);
  }, []);
  // Tell the main process how big the menu is, so it opens by the mouse at the right size.
  useLayoutEffect(() => { const el = box.current; if (st && el) desktop!.menuSize(el.offsetWidth, el.offsetHeight); }, [st, up]);
  if (!st) return null;
  const run = (fn: () => void) => () => { fn(); desktop!.menuClose(); };
  const set = (p: Parameters<NonNullable<typeof desktop>['set']>[0]) => () => { void desktop!.set(p); };
  return (
    <div ref={box} className="tray-menu menu-list" role="menu" aria-label="Esther">
      {st.visible
        ? <Item icon="close" label="Hide Esther" keys={prettyKeys(st.shortcut)} onClick={run(() => desktop!.hide())} />
        : <Item icon="monitor" label="Show Esther" keys={prettyKeys(st.shortcut)} onClick={run(() => desktop!.show())} />}
      <hr />
      <p className="menu-label">Cards</p>
      {st.cards.map((c) => <Item key={c.id} check={c.on} label={CARD_NAMES[c.id] ?? c.id} onClick={set({ card: { id: c.id, on: !c.on } })} role="menuitemcheckbox" />)}
      <Item icon="layout" label="Put the cards back" onClick={run(() => { desktop!.resetLayout(); desktop!.show(); })} />
      <hr />
      <p className="menu-label">Where the cards sit</p>
      {LAYER_NAMES.map((l) => <Item key={l.id} radio={st.layer === l.id} label={l.label} onClick={set({ layer: l.id })} role="menuitemradio" />)}
      <hr />
      <Item icon="settings" label="Settings…" onClick={run(() => desktop!.openSettings())} />
      {up?.state === 'ready'
        ? <Item icon="sparkle" label={`Restart to update to ${up.next}`} onClick={run(() => desktop!.updates.install())} />
        : up && !['dev', 'portable'].includes(up.state) && <Item icon="history" label={up.state === 'checking' ? 'Checking for updates…' : up.state === 'downloading' ? `Downloading… ${up.percent ?? 0}%` : 'Check for updates'} onClick={() => desktop!.updates.check()} />}
      <Item icon="close" label="Quit Esther" onClick={run(() => desktop!.quit())} />
    </div>
  );
}

function Item({ label, onClick, icon, keys, check, radio, role = 'menuitem' }: {
  label: string; onClick: () => void; icon?: React.ComponentProps<typeof Icon>['name']; keys?: string; check?: boolean; radio?: boolean; role?: string;
}) {
  const checked = check ?? radio;
  return (
    <button type="button" className="menu-item" role={role} aria-checked={checked === undefined ? undefined : checked} onClick={onClick}>
      {checked !== undefined ? <span className="menu-mark">{checked && (radio !== undefined ? <i className="radio-dot" /> : <Icon name="check" size={14} />)}</span>
        : icon ? <Icon name={icon} size={15} /> : <span className="menu-noicon" />}
      <span>{label}</span>
      {keys && <kbd>{keys}</kbd>}
    </button>
  );
}
