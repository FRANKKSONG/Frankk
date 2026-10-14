import { useRef } from 'react';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { COLOR_KEYS, DEFAULT_WINDOW, THEMES, themeColor, themeOf, type ThemeId, type ThemePrefs, type WindowPrefs } from '../lib/theme';
import { artPresets, downscaleImage } from '../lib/art';

export function AppearancePanel({ prefs, setPrefs }: { prefs: ThemePrefs; setPrefs: (p: ThemePrefs) => void }) {
  const win = { ...DEFAULT_WINDOW, ...prefs.window };
  const setWin = (patch: Partial<WindowPrefs>) => setPrefs({ ...prefs, window: { ...win, ...patch } });
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="appearance">
      <h4 className="ap-h">Look</h4>
      <div className="theme-cards four" role="radiogroup" aria-label="Theme">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => (
          <button key={id} role="radio" aria-checked={themeOf(prefs) === id} className={`theme-card look-${id}`}
            onClick={() => setPrefs({ ...prefs, theme: id, colors: {} })}>
            <span className="swatches">
              {(['bg-2', 'general', 'music', 'seround', 'house'] as const).map((k) => <i key={k} style={{ background: THEMES[id].vars[k] }} />)}
            </span>
            <b>{THEMES[id].label}</b>
            <small>{THEMES[id].blurb}</small>
          </button>
        ))}
      </div>

      <h4 className="ap-h">Window background</h4>
      <div className="bg-tiles">
        {artPresets().filter((a) => a.id !== 'none').map((a) => (
          <button key={a.id} className={`bg-tile${win.background === a.id ? ' on' : ''}`} style={{ backgroundImage: a.css, backgroundSize: a.tile ? '120px' : 'cover' }}
            aria-pressed={win.background === a.id} onClick={() => setWin({ background: a.id })}><span>{a.name}</span></button>
        ))}
        <button className={`bg-tile${win.background === 'color' ? ' on' : ''}`} style={{ background: win.color }} aria-pressed={win.background === 'color'} onClick={() => setWin({ background: 'color' })}><span>Plain colour</span></button>
        <button className={`bg-tile upload${win.background.startsWith('data:') ? ' on' : ''}`}
          style={win.background.startsWith('data:') ? { backgroundImage: `url("${win.background}")`, backgroundSize: 'cover' } : undefined} onClick={() => fileRef.current?.click()}>
          <span><Icon name="plus" size={12} /> My image</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setWin({ background: await downscaleImage(f) }); }} />
      <div className="sliders">
        <label className="color-row"><input type="color" value={win.color} onChange={(e) => setWin({ color: e.target.value })} />Window colour</label>
        <label className="slider">Panel translucency<input type="range" min={0.35} max={1} step={0.01} value={win.opacity} onChange={(e) => setWin({ opacity: Number(e.target.value) })} /><span>{Math.round((1 - win.opacity) * 100)}%</span></label>
        <label className="slider">Background blur<input type="range" min={0} max={40} step={1} value={win.blur} onChange={(e) => setWin({ blur: Number(e.target.value) })} /><span>{win.blur}px</span></label>
        <label className="slider">Darken art<input type="range" min={0} max={0.95} step={0.01} value={win.dim} onChange={(e) => setWin({ dim: Number(e.target.value) })} /><span>{Math.round(win.dim * 100)}%</span></label>
      </div>

      <h4 className="ap-h">Colours</h4>
      <div className="color-rows">
        {COLOR_KEYS.map(({ key, label }) => (
          <label key={key} className="color-row">
            <input type="color" value={themeColor(prefs, key)} onChange={(e) => setPrefs({ ...prefs, colors: { ...prefs.colors, [key]: e.target.value } })} />
            {label}
          </label>
        ))}
      </div>
      <div className="form-actions left">
        <button className="btn small" disabled={!Object.keys(prefs.colors).length} onClick={() => setPrefs({ ...prefs, colors: {} })}>Reset colours</button>
        <button className="btn small" onClick={() => setPrefs({ ...prefs, window: DEFAULT_WINDOW })}>Reset window</button>
      </div>
    </div>
  );
}

export function AppearanceButton(props: { prefs: ThemePrefs; setPrefs: (p: ThemePrefs) => void }) {
  return (
    <Popover align="right" className="wide-pop appearance-pop" trigger={({ toggle, ref, open }) => (
      <button ref={ref} className="btn" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}><Icon name="palette" size={15} /> Appearance</button>
    )}>
      {() => <AppearancePanel {...props} />}
    </Popover>
  );
}
