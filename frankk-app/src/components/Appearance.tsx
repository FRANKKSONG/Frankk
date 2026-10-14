import { Icon } from './Icons';
import { Popover } from './Popover';
import { COLOR_KEYS, THEMES, themeColor, type ThemeId, type ThemePrefs } from '../lib/theme';

export function AppearancePanel({ prefs, setPrefs }: { prefs: ThemePrefs; setPrefs: (p: ThemePrefs) => void }) {
  return (
    <div className="appearance">
      <div className="theme-cards" role="radiogroup" aria-label="Theme">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => (
          <button key={id} role="radio" aria-checked={prefs.theme === id} className={`theme-card look-${id}`}
            onClick={() => setPrefs({ theme: id, colors: prefs.colors })}>
            <span className="swatches">
              {(['bg-2', 'general', 'music', 'seround', 'house'] as const).map((k) => <i key={k} style={{ background: THEMES[id].vars[k] }} />)}
            </span>
            <b>{THEMES[id].label}</b>
            <small>{THEMES[id].blurb}</small>
          </button>
        ))}
      </div>
      <div className="color-rows">
        {COLOR_KEYS.map(({ key, label }) => (
          <label key={key} className="color-row">
            <input type="color" value={themeColor(prefs, key)} onChange={(e) => setPrefs({ ...prefs, colors: { ...prefs.colors, [key]: e.target.value } })} />
            {label}
          </label>
        ))}
      </div>
      <button className="btn small" disabled={!Object.keys(prefs.colors).length} onClick={() => setPrefs({ ...prefs, colors: {} })}>Reset colours</button>
    </div>
  );
}

export function AppearanceButton(props: { prefs: ThemePrefs; setPrefs: (p: ThemePrefs) => void }) {
  return (
    <Popover align="right" className="wide-pop" trigger={({ toggle, ref, open }) => (
      <button ref={ref} className="btn" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}><Icon name="palette" size={15} /> Appearance</button>
    )}>
      {() => <AppearancePanel {...props} />}
    </Popover>
  );
}
