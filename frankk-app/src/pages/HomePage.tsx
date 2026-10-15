import { useRef, useState } from 'react';
import ReactGridLayout, { useContainerWidth, verticalCompactor, type LayoutItem } from 'react-grid-layout';
import { Icon } from '../components/Icons';
import { ColorSelect } from '../components/ColorSelect';
import { Popover } from '../components/Popover';
import { Initial } from '../components/Ornaments';
import { Editable } from '../components/Editable';
import { METRICS, WIDGET_CATALOG, WidgetBody } from '../components/Widgets';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { greeting, longToday } from '../lib/dates';
import { artCss, artPresets, downscaleImage } from '../lib/art';
import { newId } from '../data/fixtures';
import { PIGMENTS } from '../data/types';
import { AppearanceButton } from '../components/Appearance';
import { Matins } from '../components/Matins';
import { CommandBar } from '../components/CommandBar';
import type { ThemePrefs } from '../lib/theme';
import type { WidgetDef } from '../data/schema';

/** Home: an at-a-glance dashboard you build yourself out of widgets. */
export function HomePage({ theme, setTheme }: { theme: ThemePrefs; setTheme: (t: ThemePrefs) => void }) {
  const { data, today, dispatch } = useStore();
  const { setPalette } = useUi();
  const dash = data.dashboards[0];
  const [editing, setEditing] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth();
  const g = greeting();
  const own = !!dash.background && dash.background !== 'inherit';
  const art = own ? artCss(dash.background) : { image: 'none', tile: false };

  const onLayout = (l: readonly LayoutItem[]) => {
    if (!editing) return;
    const next = l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
    if (JSON.stringify(next) !== JSON.stringify(dash.layout)) dispatch({ type: 'dash/update', id: dash.id, patch: { layout: next } });
  };

  return (
    <div className={`homepage${own ? ' own-art' : ''}`} style={{ '--art': art.image, '--art-size': art.tile ? 'auto' : 'cover', '--dim': String(dash.dim) } as React.CSSProperties}>
      <div className="home-art" aria-hidden="true" />
      <header className="hp-head">
        <div className="hp-greet">
          <Initial letter={g[0]} size={52} />
          <div>
            <h1><span className="sr-only">{g[0]}</span><span className="greet-rest">{g.slice(1)}, FRANKK</span></h1>
            <p className="hp-date">{longToday(today)}</p>
          </div>
        </div>
        <CommandBar />
        <div className="head-actions">
          <button className="btn" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)"><Icon name="search" size={14} /> Search</button>
          <AppearanceButton prefs={theme} setPrefs={setTheme} />
          {editing && <AddWidget />}
          {editing && <BackgroundPicker />}
          <button className={`btn${editing ? ' primary' : ''}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)}><Icon name="layout" size={14} /> {editing ? 'Done' : 'Customize'}</button>
        </div>
      </header>
      <Matins />
      {editing && <p className="hp-hint">Drag widgets by their grip, resize from any edge, use ⋯ to change what a widget shows. Your layout is saved as you go.</p>}
      <div className="hp-grid" ref={containerRef}>
        {mounted && (
          <ReactGridLayout width={width} layout={dash.layout.filter((l) => dash.widgets.some((w) => w.id === l.i))}
            gridConfig={{ cols: 24, rowHeight: 30, margin: [12, 12], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, handle: '.w-grip', cancel: 'input,select,textarea,button,a,.no-drag' }}
            resizeConfig={{ enabled: editing, handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] }}
            compactor={verticalCompactor} onLayoutChange={onLayout}>
            {dash.widgets.map((w) => (
              <div key={w.id} className={`wcard kind-${w.kind}${editing ? ' editing' : ''}`} style={{ '--wc': w.color ?? 'var(--accent)' } as React.CSSProperties} data-widget={w.id}>
                <WidgetFrame w={w} editing={editing} />
              </div>
            ))}
          </ReactGridLayout>
        )}
      </div>
    </div>
  );
}

function WidgetFrame({ w, editing }: { w: WidgetDef; editing: boolean }) {
  const { data, dispatch } = useStore();
  const dashId = data.dashboards[0].id;
  const update = (patch: Partial<WidgetDef>) => dispatch({ type: 'dash/widget', dashId, widget: { ...w, ...patch, config: { ...w.config, ...patch.config } } });
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="w-frame" aria-label={w.title}>
      <header className="w-head">
        {editing && <span className="w-grip" title="Drag to move"><Icon name="grip" size={13} /></span>}
        <span className="w-mark" />
        {editing ? <Editable className="w-title" label="Widget title" value={w.title} onSave={(v) => update({ title: v.trim() })} /> : <h3 className="w-title">{w.title}</h3>}
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn tiny w-menu" aria-label={`Settings for ${w.title}`} onClick={toggle}><Icon name="more" size={14} /></button>
        )}>
          {(close) => (
            <div className="pop-form w-settings">
              <strong>{w.title}</strong>
              {w.kind === 'stat' && (
                <label>Shows<select value={w.config.metric} onChange={(e) => update({ config: { metric: e.target.value as WidgetDef['config']['metric'] } })}>
                  {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
              )}
              {w.kind === 'stat' && w.config.metric === 'records-count' && (
                <label>Type<select value={w.config.typeId ?? ''} onChange={(e) => update({ config: { typeId: e.target.value } })}>
                  {data.types.map((t) => <option key={t.id} value={t.id}>{t.plural}</option>)}</select></label>
              )}
              {w.kind === 'view' && (
                <label>Saved view<select value={w.config.viewId} onChange={(e) => update({ config: { viewId: e.target.value } })}>
                  {data.views.map((v) => <option key={v.id} value={v.id}>{data.types.find((t) => t.id === v.typeId)?.plural} · {v.name}</option>)}</select></label>
              )}
              {w.kind === 'note' && (
                <label>Note<select value={w.config.noteId} onChange={(e) => update({ config: { noteId: e.target.value } })}>
                  {data.notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
              )}
              {w.kind === 'image' && (
                <>
                  <label>Picture<select value={w.config.image?.startsWith('data:') ? 'upload' : w.config.image} onChange={(e) => (e.target.value === 'upload' ? fileRef.current?.click() : update({ config: { image: e.target.value } }))}>
                    {artPresets().filter((a) => a.id !== 'none').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}<option value="upload">Upload my own…</option></select></label>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) update({ config: { image: await downscaleImage(f, 1000) } }); }} />
                  <label>Caption<input defaultValue={w.config.caption ?? ''} onBlur={(e) => update({ config: { caption: e.target.value } })} /></label>
                </>
              )}
              <div className="field">Accent<ColorSelect label="Widget accent" value={w.color ?? PIGMENTS[0].color} onChange={(color) => update({ color })} /></div>
              <button onClick={() => { dispatch({ type: 'dash/remove-widget', dashId, widgetId: w.id }); close(); }}><Icon name="trash" size={13} /> Remove widget</button>
            </div>
          )}
        </Popover>
      </header>
      <div className="w-body"><WidgetBody w={w} /></div>
    </section>
  );
}

function AddWidget() {
  const { data, dispatch } = useStore();
  return (
    <Popover align="right" className="wide-pop" trigger={({ toggle, ref }) => <button ref={ref} className="btn" onClick={toggle}><Icon name="plus" size={14} /> Add widget</button>}>
      {(close) => (
        <div className="catalog">
          {WIDGET_CATALOG.map((c) => (
            <button key={c.kind + (c.config?.metric ?? '')} className="catalog-item" onClick={() => {
              const id = newId('w');
              dispatch({ type: 'dash/widget', dashId: data.dashboards[0].id, widget: { id, kind: c.kind, title: c.name, config: { ...c.config } }, at: { x: 0, y: 999, ...c.size } });
              close();
              requestAnimationFrame(() => document.querySelector(`[data-widget="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            }}>
              <Icon name={c.icon} size={16} /><span><b>{c.name}</b><small>{c.blurb}</small></span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function BackgroundPicker() {
  const { data, dispatch } = useStore();
  const dash = data.dashboards[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof dash>) => dispatch({ type: 'dash/update', id: dash.id, patch });
  return (
    <Popover align="right" className="wide-pop" trigger={({ toggle, ref }) => <button ref={ref} className="btn" onClick={toggle}><Icon name="image" size={14} /> Background</button>}>
      {() => (
        <div className="bg-picker">
          <div className="bg-tiles">
            <button className={`bg-tile${!dash.background || dash.background === 'inherit' ? ' on' : ''}`} onClick={() => set({ background: 'inherit' })}><span>Same as window</span></button>
            {artPresets().map((a) => (
              <button key={a.id} className={`bg-tile${(dash.background ?? 'millefleur') === a.id ? ' on' : ''}`} style={{ backgroundImage: a.css, backgroundSize: a.tile ? '120px' : 'cover' }} onClick={() => set({ background: a.id })}><span>{a.name}</span></button>
            ))}
            <button className={`bg-tile upload${dash.background?.startsWith('data:') ? ' on' : ''}`} style={dash.background?.startsWith('data:') ? { backgroundImage: `url("${dash.background}")`, backgroundSize: 'cover' } : undefined} onClick={() => fileRef.current?.click()}><span><Icon name="plus" size={12} /> My image</span></button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ background: await downscaleImage(f) }); }} />
          <label className="dim-row">Dim the art<input type="range" min={0.3} max={0.95} step={0.05} value={dash.dim} onChange={(e) => set({ dim: Number(e.target.value) })} /><span>{Math.round(dash.dim * 100)}%</span></label>
          <p className="hint">“Same as window” follows Appearance → Window background. Uploaded images are saved in Esther/Assets in the desktop app.</p>
        </div>
      )}
    </Popover>
  );
}
