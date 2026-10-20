import { useRef } from 'react';
import { Icon } from './Icons';
import { Popover } from './Popover';
import { COLOR_KEYS, DEFAULT_WINDOW, THEMES, themeColor, themeOf, type ThemeId, type ThemePrefs, type WindowPrefs } from '../lib/theme';
import { artPresets, downscaleImage } from '../lib/art';
import { ColorSelect } from './ColorSelect';
import { desktop } from '../lib/desktop';

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
              {(['bg-2', 'bg-3', 'accent', 'gold', 'text'] as const).map((k) => <i key={k} style={{ background: THEMES[id].vars[k] }} />)}
            </span>
            <b>{THEMES[id].label}</b>
            <small>{THEMES[id].blurb}</small>
          </button>
        ))}
      </div>

      <h4 className="ap-h">Panels</h4>
      <div className="sliders">
        <div className="color-row">Panel colour
          <ColorSelect label="Panel colour" value={win.panelColor ?? THEMES[themeOf(prefs)].vars['bg-2']} onChange={(c) => setWin({ panelColor: c })} />
          {win.panelColor && <button className="link-btn" onClick={() => setWin({ panelColor: undefined })}>Use the look’s colour</button>}
        </div>
        <label className="slider">Opacity<input type="range" min={0.2} max={1} step={0.01} value={win.opacity} aria-label="Panel opacity" onChange={(e) => setWin({ opacity: Number(e.target.value) })} /><span>{Math.round(win.opacity * 100)}%</span></label>
        <p className="quiet">Text turns light or dark by itself so it stays readable on any panel colour.</p>
      </div>

      {!desktop && (
        <>
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
            <div className="color-row">Window colour<ColorSelect label="Window colour" value={win.color} onChange={(c) => setWin({ color: c })} /></div>
            <label className="slider">Background blur<input type="range" min={0} max={40} step={1} value={win.blur} onChange={(e) => setWin({ blur: Number(e.target.value) })} /><span>{win.blur}px</span></label>
            <label className="slider">Darken art<input type="range" min={0} max={0.95} step={0.01} value={win.dim} onChange={(e) => setWin({ dim: Number(e.target.value) })} /><span>{Math.round(win.dim * 100)}%</span></label>
          </div>
        </>
      )}

      <h4 className="ap-h">Highlight colour</h4>
      <div className="color-rows">
        {COLOR_KEYS.map(({ key, label }) => (
          <div key={key} className="color-row">{label}
            <ColorSelect label={label} value={themeColor(prefs, key)} onChange={(c) => setPrefs({ ...prefs, colors: { ...prefs.colors, [key]: c } })} />
          </div>
        ))}
      </div>
      <div className="form-actions left">
        <button className="btn small" disabled={!Object.keys(prefs.colors).length} onClick={() => setPrefs({ ...prefs, colors: {} })}>Reset colours</button>
        <button className="btn small" onClick={() => setPrefs({ ...prefs, window: DEFAULT_WINDOW })}>Reset panels{desktop ? '' : ' and window'}</button>
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
