/**
 * Scrollbars as an overlay, not part of any box: native scrollbars are hidden (they take no space),
 * and a thin thumb floats over the edge of whatever is scrolling. It appears while scrolling,
 * can be dragged while it is showing, and fades out again, so it never sits on top of other controls.
 */
interface Bars { el: Element; v: HTMLDivElement; h: HTMLDivElement; timer?: number; dragging?: boolean }

const bars = new Map<Element, Bars>();
const HIDE_AFTER = 900;
const MIN_THUMB = 28;

const rootEl = () => (document.scrollingElement ?? document.documentElement) as Element;
const rectOf = (el: Element) => (el === rootEl() ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : el.getBoundingClientRect());

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
    const up = () => { s.dragging = false; t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); hideLater(s); };
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
  const canV = el.scrollHeight > el.clientHeight + 1;
  const canH = el.scrollWidth > el.clientWidth + 1;
  if (canV) {
    const len = Math.max(MIN_THUMB, (el.clientHeight / el.scrollHeight) * r.height);
    const top = r.top + (el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * (r.height - len);
    Object.assign(v.style, { top: `${top}px`, left: `${r.right - 8}px`, height: `${len}px`, display: 'block' });
  } else v.style.display = 'none';
  if (canH) {
    const len = Math.max(MIN_THUMB, (el.clientWidth / el.scrollWidth) * r.width);
    const left = r.left + (el.scrollLeft / (el.scrollWidth - el.clientWidth || 1)) * (r.width - len);
    Object.assign(h.style, { left: `${left}px`, top: `${r.bottom - 8}px`, width: `${len}px`, display: 'block' });
  } else h.style.display = 'none';
}

function show(s: Bars) {
  place(s);
  s.v.classList.add('on'); s.h.classList.add('on');
  hideLater(s);
}

function hideLater(s: Bars) {
  window.clearTimeout(s.timer);
  s.timer = window.setTimeout(() => { if (!s.dragging) { s.v.classList.remove('on'); s.h.classList.remove('on'); } }, HIDE_AFTER);
}

export function installOverlayScrollbars() {
  document.documentElement.classList.add('overlay-scrollbars');
  document.addEventListener('scroll', (e) => {
    const el = e.target instanceof Element ? e.target : rootEl();
    show(barsFor(el));
  }, { capture: true, passive: true });
  window.addEventListener('resize', () => bars.forEach(place));
}
