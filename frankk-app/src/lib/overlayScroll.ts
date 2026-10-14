/**
 * Scrollbars as an overlay, not part of any box: native scrollbars are hidden (they take no space),
 * and a thin thumb floats over the edge of whatever is scrolling. It appears while scrolling,
 * can be dragged while it is showing, and fades out again, so it never sits on top of other controls.
 * Moving the mouse up to the edge of a scrolling area shows its thumb; the thumb only catches the mouse
 * when the pointer is right on it, so resize handles and buttons next to it keep working.
 */
interface Bars { el: Element; v: HTMLDivElement; h: HTMLDivElement; timer?: number; dragging?: boolean; wasNear?: boolean }

const bars = new Map<Element, Bars>();
const HIDE_AFTER = 900;
const MIN_THUMB = 28;

const rootEl = () => (document.scrollingElement ?? document.documentElement) as Element;
const rectOf = (el: Element) => (el === rootEl() ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : el.getBoundingClientRect());
/** The part of a scroll area you can actually see: clipped by the window and by every area it scrolls inside. */
function visibleRect(el: Element) {
  const r = rectOf(el);
  let top = Math.max(r.top, 0), left = Math.max(r.left, 0), bottom = Math.min(r.bottom, window.innerHeight), right = Math.min(r.right, window.innerWidth);
  if (el !== rootEl()) {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      top = Math.max(top, ar.top); left = Math.max(left, ar.left); bottom = Math.min(bottom, ar.bottom); right = Math.min(right, ar.right);
    }
  }
  return { top, left, bottom, right, width: right - left, height: bottom - top };
}

function makeThumb(axis: 'v' | 'h', b: () => Bars) {
  const t = document.createElement('div');
  t.className = `overlay-thumb ${axis}`;
  t.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const s = b(); const el = s.el;
    t.setPointerCapture(e.pointerId);
    s.dragging = true;
    const start = axis === 'v' ? e.clientY : e.clientX;
    const startScroll = axis === 'v' ? el.scrollTop : el.scrollLeft;
    const r = rectOf(el);
    const ratio = axis === 'v' ? el.scrollHeight / r.height : el.scrollWidth / r.width;
    const move = (ev: PointerEvent) => {
      const d = (axis === 'v' ? ev.clientY : ev.clientX) - start;
      if (axis === 'v') el.scrollTop = startScroll + d * ratio; else el.scrollLeft = startScroll + d * ratio;
    };
    const up = () => { s.dragging = false; t.classList.remove('grab'); t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); hideLater(s); };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  });
  t.addEventListener('pointerenter', () => { const s = b(); window.clearTimeout(s.timer); });
  t.addEventListener('pointerleave', () => hideLater(b()));
  document.body.appendChild(t);
  return t;
}

function barsFor(el: Element): Bars {
  let s = bars.get(el);
  if (!s) {
    const ref = { s: undefined as unknown as Bars };
    const get = () => ref.s;
    ref.s = { el, v: makeThumb('v', get), h: makeThumb('h', get) };
    s = ref.s;
    bars.set(el, s);
  }
  return s;
}

function place(s: Bars) {
  const { el, v, h } = s;
  if (el !== rootEl() && !el.isConnected) { v.remove(); h.remove(); bars.delete(el); return; }
  const r = rectOf(el);
  const vis = visibleRect(el);
  const seen = vis.width > 12 && vis.height > 12 && (el === rootEl() || (el as HTMLElement).offsetParent !== null);
  const canV = seen && el.scrollHeight > el.clientHeight + 1;
  const canH = seen && el.scrollWidth > el.clientWidth + 1;
  if (canV) {
    const len = Math.max(MIN_THUMB, (el.clientHeight / el.scrollHeight) * r.height);
    const top = r.top + (el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * (r.height - len);
    // keep the thumb inside the visible part of the area (an edge scrolled out of view takes no thumb with it)
    const t = Math.max(vis.top, top), b = Math.min(vis.bottom, top + len);
    if (r.right > vis.right + 1 || b - t < 8) v.style.display = 'none';
    else Object.assign(v.style, { top: `${t}px`, left: `${r.right - 8}px`, height: `${b - t}px`, display: 'block' });
  } else v.style.display = 'none';
  if (canH) {
    const len = Math.max(MIN_THUMB, (el.clientWidth / el.scrollWidth) * r.width);
    const left = r.left + (el.scrollLeft / (el.scrollWidth - el.clientWidth || 1)) * (r.width - len);
    const l = Math.max(vis.left, left), rr = Math.min(vis.right, left + len);
    if (r.bottom > vis.bottom + 1 || rr - l < 8) h.style.display = 'none';
    else Object.assign(h.style, { left: `${l}px`, top: `${r.bottom - 8}px`, width: `${rr - l}px`, display: 'block' });
  } else h.style.display = 'none';
}

function show(s: Bars) {
  place(s);
  s.v.classList.add('on'); s.h.classList.add('on');
  hideLater(s);
}

function hideLater(s: Bars) {
  window.clearTimeout(s.timer);
  s.timer = window.setTimeout(() => { if (!s.dragging) for (const t of [s.v, s.h]) t.classList.remove('on', 'grab'); }, HIDE_AFTER);
}

export function installOverlayScrollbars() {
  document.documentElement.classList.add('overlay-scrollbars');
  document.addEventListener('scroll', (e) => {
    const el = e.target instanceof Element ? e.target : rootEl();
    // Thumbs are fixed to the window, so when anything scrolls, every showing thumb is moved to where its area now is.
    bars.forEach((s) => { if (s.el !== el && (s.v.classList.contains('on') || s.h.classList.contains('on'))) place(s); });
    show(barsFor(el));
  }, { capture: true, passive: true });
  window.addEventListener('resize', () => bars.forEach(place));
  let queued = false;
  document.addEventListener('pointermove', (e) => {
    if (queued || e.buttons) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; nearEdge(e.clientX, e.clientY, e.target); });
  }, { passive: true });
}

const EDGE = 12;
const scrollerOf = (n: EventTarget | null) => {
  for (let el = n instanceof Element ? n : null; el; el = el.parentElement) {
    if (el.classList.contains('overlay-thumb')) return null;
    const o = getComputedStyle(el);
    if ((/(auto|scroll)/.test(o.overflowY) && el.scrollHeight > el.clientHeight + 1) || (/(auto|scroll)/.test(o.overflowX) && el.scrollWidth > el.clientWidth + 1)) return el;
  }
  return null;
};
const inside = (t: HTMLElement, x: number, y: number, pad: number) => {
  if (!t.classList.contains('on') || t.style.display === 'none') return false;
  const r = t.getBoundingClientRect();
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
};

/** Show a scroll area's thumb when the pointer comes near its edge, and let it be grabbed when the pointer is on it. */
function nearEdge(x: number, y: number, target: EventTarget | null) {
  const el = scrollerOf(target);
  if (el) {
    const r = rectOf(el);
    const nearV = el.scrollHeight > el.clientHeight + 1 && x >= r.right - EDGE && x <= r.right;
    const nearH = el.scrollWidth > el.clientWidth + 1 && y >= r.bottom - EDGE && y <= r.bottom;
    if (nearV || nearH) show(barsFor(el));
  }
  bars.forEach((s) => {
    if (s.dragging) return;
    let near = false;
    for (const t of [s.v, s.h]) {
      const on = inside(t, x, y, 3);
      t.classList.toggle('grab', on);
      near = near || on;
    }
    // stay while the pointer is on the thumb, then fade as usual once it moves off
    if (near) window.clearTimeout(s.timer);
    else if (s.wasNear) hideLater(s);
    s.wasNear = near;
  });
}
