//! The guides, like Illustrator's smart guides, shown only while a card is moved or resized: the grid it lands on,
//! the screen's centre, middle and quarters (dashed), the other cards outlined, the card itself in gold, and, lit
//! up with a label, whichever guide it has snapped to.
//!
//! On Windows they're drawn into a see-through window of their own that never takes a click and sits above
//! everything (a layered window with per-pixel alpha); its picture exists only while the guides show.

/// What a guide is.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Centre,
    Middle,
    Quarter,
    Card,
    Gap,
}

impl Kind {
    pub fn label(self) -> &'static str {
        match self {
            Kind::Centre => "Centre",
            Kind::Middle => "Middle",
            Kind::Quarter => "Quarter",
            Kind::Card => "Aligned",
            Kind::Gap => "Even gap",
        }
    }
}

/// A guide line: vertical (`x`) at screen x = v, or horizontal at screen y = v.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line {
    pub x: bool,
    pub v: i32,
    pub kind: Kind,
}

/// (x, y, width, height) in screen pixels.
pub type Rect = (i32, i32, i32, i32);

#[cfg(windows)]
mod imp {
    use super::*;
    use std::cell::RefCell;
    use windows_sys::Win32::Foundation::*;
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    const ACCENT: (u8, u8, u8) = (0xd9, 0xa6, 0x3a);
    const ACCENT_INK: u32 = 0x000c_1115; // COLORREF (0x00bbggrr) of #15110c

    struct Surface {
        hwnd: HWND,
        mem: HDC,
        dib: HBITMAP,
        old: HGDIOBJ,
        bits: *mut u32,
        area: Rect,
    }

    thread_local! {
        static HWND_: std::cell::Cell<isize> = const { std::cell::Cell::new(0) };
        static SURFACE: RefCell<Option<Surface>> = const { RefCell::new(None) };
    }

    fn window() -> HWND {
        let h = HWND_.with(|h| h.get());
        if h != 0 { return h as HWND; }
        unsafe {
            let inst = GetModuleHandleW(std::ptr::null());
            let class = crate::shell::wide_str("EstherGuides");
            let mut wc: WNDCLASSEXW = std::mem::zeroed();
            wc.cbSize = std::mem::size_of::<WNDCLASSEXW>() as u32;
            wc.lpfnWndProc = Some(DefWindowProcW);
            wc.hInstance = inst;
            wc.lpszClassName = class.as_ptr();
            RegisterClassExW(&wc);
            let h = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE,
                class.as_ptr(), crate::shell::wide_str("Esther guides").as_ptr(), WS_POPUP,
                0, 0, 1, 1, std::ptr::null_mut(), std::ptr::null_mut(), inst, std::ptr::null(),
            );
            let one: u32 = 1;
            DwmSetWindowAttribute(h, 3, &one as *const u32 as _, 4); // no Windows animations
            HWND_.with(|c| c.set(h as isize));
            h
        }
    }

    /// Show the guides over `area` (the screen without the taskbar). The picture is made here, and freed in `hide`.
    pub fn show(area: Rect) {
        hide_surface();
        let hwnd = window();
        let (_, _, w, h) = area;
        unsafe {
            let screen = GetDC(std::ptr::null_mut());
            let mem = CreateCompatibleDC(screen);
            ReleaseDC(std::ptr::null_mut(), screen);
            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w;
            bi.bmiHeader.biHeight = -h;
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
            let dib = CreateDIBSection(mem, &bi, DIB_RGB_COLORS, &mut bits, std::ptr::null_mut(), 0);
            if dib.is_null() { DeleteDC(mem); return; }
            let old = SelectObject(mem, dib as _);
            SURFACE.with(|s| *s.borrow_mut() = Some(Surface { hwnd, mem, dib, old, bits: bits as *mut u32, area }));
        }
    }

    pub fn visible() -> bool {
        SURFACE.with(|s| s.borrow().is_some()) && unsafe { IsWindowVisible(window()) != 0 }
    }

    fn hide_surface() {
        SURFACE.with(|s| {
            if let Some(sf) = s.borrow_mut().take() {
                unsafe {
                    ShowWindow(sf.hwnd, SW_HIDE);
                    SelectObject(sf.mem, sf.old);
                    DeleteObject(sf.dib as _);
                    DeleteDC(sf.mem);
                }
            }
        });
    }
    pub fn hide() {
        hide_surface();
    }

    /// Blend a colour over one pixel (the picture keeps premultiplied alpha, as Windows wants it).
    #[inline]
    fn blend(px: &mut u32, (r, g, b): (u8, u8, u8), a: f32) {
        let d = *px;
        let inv = 1.0 - a;
        let ch = |shift: u32, c: u8| ((c as f32 * a) + ((d >> shift) & 0xff) as f32 * inv).round() as u32;
        let na = (255.0 * a + ((d >> 24) & 0xff) as f32 * inv).round() as u32;
        *px = (na << 24) | (ch(16, r) << 16) | (ch(8, g) << 8) | ch(0, b);
    }

    /// Draw the guides: `card` is where the moving card is now, `others` the other cards, `lines` the guides it
    /// snapped to. `k` is the screen's scale (1.25 at 125 %).
    pub fn draw(card: Rect, others: &[Rect], lines: &[Line], grid: i32, k: f32) {
        SURFACE.with(|s| {
            let s = s.borrow();
            let Some(sf) = s.as_ref() else { return };
            let (ax, ay, w, h) = sf.area;
            let buf = unsafe { std::slice::from_raw_parts_mut(sf.bits, (w * h) as usize) };
            buf.fill(0);
            let white = (255, 255, 255);
            let vline = |buf: &mut [u32], x: i32, a: f32, c: (u8, u8, u8), dash: bool, y0: i32, y1: i32| {
                if x < 0 || x >= w { return; }
                for y in y0.max(0)..y1.min(h) {
                    if dash && (y / 6) % 2 == 1 { continue; }
                    blend(&mut buf[(y * w + x) as usize], c, a);
                }
            };
            let hline = |buf: &mut [u32], y: i32, a: f32, c: (u8, u8, u8), dash: bool, x0: i32, x1: i32| {
                if y < 0 || y >= h { return; }
                let row = (y * w) as usize;
                for x in x0.max(0)..x1.min(w) {
                    if dash && (x / 6) % 2 == 1 { continue; }
                    blend(&mut buf[row + x as usize], c, a);
                }
            };
            // The grid: every step faintly, every fourth a little stronger.
            let g = grid.max(2);
            let mut x = 0;
            while x < w { vline(buf, x, if (x / g) % 4 == 0 { 0.09 } else { 0.045 }, white, false, 0, h); x += g; }
            let mut y = 0;
            while y < h { hline(buf, y, if (y / g) % 4 == 0 { 0.09 } else { 0.045 }, white, false, 0, w); y += g; }
            // The screen's centre, middle and quarters, dashed.
            for q in [0.25f32, 0.5, 0.75] {
                let a = if q == 0.5 { 0.32 } else { 0.18 };
                vline(buf, (w as f32 * q).round() as i32, a, white, true, 0, h);
                hline(buf, (h as f32 * q).round() as i32, a, white, true, 0, w);
            }
            // The other cards, outlined faintly; the one you're moving, in gold.
            let outline = |buf: &mut [u32], r: Rect, a: f32, c: (u8, u8, u8)| {
                let (x, y, rw, rh) = (r.0 - ax, r.1 - ay, r.2, r.3);
                hline(buf, y, a, c, false, x, x + rw);
                hline(buf, y + rh - 1, a, c, false, x, x + rw);
                vline(buf, x, a, c, false, y + 1, y + rh - 1);
                vline(buf, x + rw - 1, a, c, false, y + 1, y + rh - 1);
            };
            for o in others { outline(buf, *o, 0.22, white); }
            outline(buf, card, 0.7, ACCENT);
            // The guides it snapped to, lit up (a soft glow, then the line).
            for l in lines {
                let v = if l.x { l.v - ax } else { l.v - ay };
                let glow = (3.0 * k).round() as i32;
                for d in -glow..=glow {
                    let a = if d.abs() <= (k.round() as i32 / 2) { 0.95 } else { 0.18 * (1.0 - d.abs() as f32 / (glow as f32 + 1.0)) };
                    if l.x { vline(buf, v + d, a, ACCENT, false, 0, h) } else { hline(buf, v + d, a, ACCENT, false, 0, w) }
                }
            }
            // Their labels: a gold pill with the name, beside the card.
            for l in lines {
                let text = crate::shell::wide_str(l.kind.label());
                unsafe {
                    let font = CreateFontW(-(11.0 * k).round() as i32, 0, 0, 0, 600, 0, 0, 0, DEFAULT_CHARSET as u32, OUT_DEFAULT_PRECIS as u32, CLIP_DEFAULT_PRECIS as u32, ANTIALIASED_QUALITY as u32, DEFAULT_PITCH as u32, crate::shell::wide_str("Segoe UI").as_ptr());
                    let oldf = SelectObject(sf.mem, font as _);
                    let mut size = SIZE { cx: 0, cy: 0 };
                    GetTextExtentPoint32W(sf.mem, text.as_ptr(), text.len() as i32 - 1, &mut size);
                    let (pw, ph) = (size.cx + (14.0 * k) as i32, (18.0 * k) as i32);
                    let v = if l.x { l.v - ax } else { l.v - ay };
                    let (cx, cy) = (card.0 - ax, card.1 - ay);
                    let lx = if l.x { v + (6.0 * k) as i32 } else { (cx + card.2 + (8.0 * k) as i32).min(w - pw - 6) };
                    let ly = if l.x { (cy - (26.0 * k) as i32).max(6) } else { v - (22.0 * k) as i32 };
                    let rad = ph as f32 / 2.0;
                    let inside = |px: i32, py: i32| {
                        let (dx, dy) = ((px - lx) as f32 + 0.5, (py - ly) as f32 + 0.5);
                        let ex = if dx < rad { rad - dx } else if dx > pw as f32 - rad { dx - (pw as f32 - rad) } else { 0.0 };
                        let ey = if dy < rad { rad - dy } else if dy > ph as f32 - rad { dy - (ph as f32 - rad) } else { 0.0 };
                        ex * ex + ey * ey <= rad * rad
                    };
                    for py in ly.max(0)..(ly + ph).min(h) {
                        for px in lx.max(0)..(lx + pw).min(w) {
                            if inside(px, py) {
                                buf[(py * w + px) as usize] = 0xff00_0000 | ((ACCENT.0 as u32) << 16) | ((ACCENT.1 as u32) << 8) | ACCENT.2 as u32;
                            }
                        }
                    }
                    SetBkMode(sf.mem, TRANSPARENT as i32);
                    SetTextColor(sf.mem, ACCENT_INK);
                    TextOutW(sf.mem, lx + (7.0 * k) as i32, ly + (ph - size.cy) / 2, text.as_ptr(), text.len() as i32 - 1);
                    GdiFlush();
                    // (Windows' text drawing leaves the alpha at 0; the pill is solid, so make it so again.)
                    for py in ly.max(0)..(ly + ph).min(h) {
                        for px in lx.max(0)..(lx + pw).min(w) {
                            if inside(px, py) { buf[(py * w + px) as usize] |= 0xff00_0000; }
                        }
                    }
                    SelectObject(sf.mem, oldf);
                    DeleteObject(font as _);
                }
            }
            unsafe {
                let screen = GetDC(std::ptr::null_mut());
                let pos = POINT { x: ax, y: ay };
                let size = SIZE { cx: w, cy: h };
                let src = POINT { x: 0, y: 0 };
                let bf = BLENDFUNCTION { BlendOp: AC_SRC_OVER as u8, BlendFlags: 0, SourceConstantAlpha: 255, AlphaFormat: AC_SRC_ALPHA as u8 };
                UpdateLayeredWindow(sf.hwnd, screen, &pos, &size, sf.mem, &src, 0, &bf, ULW_ALPHA);
                ReleaseDC(std::ptr::null_mut(), screen);
                if IsWindowVisible(sf.hwnd) == 0 {
                    SetWindowPos(sf.hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
                }
            }
        });
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    pub fn show(_area: Rect) {}
    pub fn visible() -> bool { false }
    pub fn hide() {}
    pub fn draw(_card: Rect, _others: &[Rect], _lines: &[Line], _grid: i32, _k: f32) {}
}

pub use imp::*;
