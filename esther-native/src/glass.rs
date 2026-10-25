//! Esther's glass, natively: the wallpaper, cropped the way Windows' "Fill" shows it, blurred, with the panel's tint
//! laid over it. Each card gets the part that sits behind it, made at the card's own size (smoothly scaled up from a
//! small blurred copy), so it reads as frosted glass that stays put as the card moves, and the card's corners can be
//! Esther's own. It's worked out again whenever the wallpaper file changes.
use slint::{Image, Rgb8Pixel, SharedPixelBuffer};
use std::path::PathBuf;

pub fn wallpaper_file() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ESTHER_WALLPAPER") {
        return Some(PathBuf::from(p));
    }
    std::env::var("APPDATA").ok().map(|a| PathBuf::from(a).join("Microsoft").join("Windows").join("Themes").join("TranscodedWallpaper"))
}

/// The blurred, tinted wallpaper, small (a quarter of the screen's size, under a megabyte): every card's glass is made
/// from it, at the card's own size, so there's never a screen-sized picture in memory.
pub struct Source {
    img: image::RgbImage,
    sw: u32,
    sh: u32,
}

thread_local! {
    static SOURCE: std::cell::RefCell<Option<Source>> = const { std::cell::RefCell::new(None) };
}

/// Make the glass's source for a screen of `sw` × `sh` pixels: the wallpaper blurred by about `blur_px`, under
/// `tint` at `alpha` (0–1). False if there is no wallpaper file (then the cards are plain panels).
pub fn make_source(sw: u32, sh: u32, blur_px: f32, tint: [u8; 3], alpha: f32) -> bool {
    let src = (|| {
        let bytes = std::fs::read(wallpaper_file()?).ok()?;
        let img = image::load_from_memory(&bytes).ok()?.to_rgb8();
        let (iw, ih) = img.dimensions();
        // Cover-crop to the screen's shape.
        let scale = f32::max(sw as f32 / iw as f32, sh as f32 / ih as f32);
        let (cw, ch) = ((sw as f32 / scale) as u32, (sh as f32 / scale) as u32);
        let cropped = image::imageops::crop_imm(&img, (iw - cw.min(iw)) / 2, (ih - ch.min(ih)) / 2, cw.min(iw), ch.min(ih)).to_image();
        drop(img);
        // Blur small (quick), and lay the tint over it.
        let (w, h) = ((sw / 4).max(32), (sh / 4).max(18));
        let mut small = image::imageops::resize(&cropped, w, h, image::imageops::FilterType::Triangle);
        drop(cropped);
        let r = ((blur_px / 4.0) as u32).max(1);
        if blur_px >= 1.0 {
            for _ in 0..3 {
                box_blur(&mut small, r);
            }
        }
        for p in small.pixels_mut() {
            for c in 0..3 {
                p.0[c] = (tint[c] as f32 * alpha + p.0[c] as f32 * (1.0 - alpha)).round().clamp(0.0, 255.0) as u8;
            }
        }
        Some(Source { img: small, sw, sh })
    })();
    let ok = src.is_some();
    SOURCE.with(|s| *s.borrow_mut() = src);
    ok
}

/// The glass behind a card at (`x`, `y`) on the screen, `w` × `h` pixels: the source smoothly scaled up (bilinear),
/// with a whisper of noise fixed to the screen so soft gradients don't show bands. None without a source.
pub fn card(x: i32, y: i32, w: u32, h: u32) -> Option<Image> {
    SOURCE.with(|s| {
        let s = s.borrow();
        let src = s.as_ref()?;
        let (iw, ih) = src.img.dimensions();
        let (fx, fy) = (iw as f32 / src.sw.max(1) as f32, ih as f32 / src.sh.max(1) as f32);
        let raw = src.img.as_raw();
        let stride = iw as usize * 3;
        // (Where each column and row samples the source, and how far between its two neighbours, in 256ths.)
        let tap = |v: f32, n: u32| {
            let v = v.clamp(0.0, (n - 1) as f32);
            let a = v.floor() as usize;
            (a, (a + 1).min(n as usize - 1), ((v - a as f32) * 256.0) as u32)
        };
        let cols: Vec<(usize, usize, u32)> = (0..w).map(|c| tap((x + c as i32) as f32 * fx + fx / 2.0 - 0.5, iw)).collect();
        let mut buf = SharedPixelBuffer::<Rgb8Pixel>::new(w.max(1), h.max(1));
        for (r, row) in buf.make_mut_slice().chunks_mut(w.max(1) as usize).enumerate() {
            let sy = y + r as i32;
            let (y0, y1, t) = tap(sy as f32 * fy + fy / 2.0 - 0.5, ih);
            let (a, b) = (&raw[y0 * stride..], &raw[y1 * stride..]);
            for (c, px) in row.iter_mut().enumerate() {
                let (x0, x1, u) = cols[c];
                let sx = x + c as i32;
                let mut hsh = (sx as u32).wrapping_mul(0x9E37_79B1) ^ (sy as u32).wrapping_mul(0x85EB_CA77);
                hsh ^= hsh >> 15;
                hsh = hsh.wrapping_mul(0x2C1B_3C6D);
                let n = (hsh >> 30) as i32 - 1; // -1, 0, 1 (2 a little more often)
                let mix = |ch: usize| {
                    let top = a[x0 * 3 + ch] as u32 * (256 - u) + a[x1 * 3 + ch] as u32 * u;
                    let bot = b[x0 * 3 + ch] as u32 * (256 - u) + b[x1 * 3 + ch] as u32 * u;
                    ((((top * (256 - t) + bot * t) >> 16) as i32) + n.min(1)).clamp(0, 255) as u8
                };
                *px = Rgb8Pixel { r: mix(0), g: mix(1), b: mix(2) };
            }
        }
        Some(Image::from_rgb8(buf))
    })
}

/// One pass of a box blur, horizontally then vertically (three passes look close to a Gaussian blur).
fn box_blur(img: &mut image::RgbImage, r: u32) {
    let (w, h) = img.dimensions();
    let src = img.clone();
    let k = 2 * r + 1;
    for y in 0..h {
        for x in 0..w {
            let mut acc = [0u32; 3];
            for dx in 0..k {
                let sx = (x as i64 + dx as i64 - r as i64).clamp(0, w as i64 - 1) as u32;
                let p = src.get_pixel(sx, y).0;
                for c in 0..3 { acc[c] += p[c] as u32; }
            }
            img.put_pixel(x, y, image::Rgb([(acc[0] / k) as u8, (acc[1] / k) as u8, (acc[2] / k) as u8]));
        }
    }
    let src = img.clone();
    for y in 0..h {
        for x in 0..w {
            let mut acc = [0u32; 3];
            for dy in 0..k {
                let sy = (y as i64 + dy as i64 - r as i64).clamp(0, h as i64 - 1) as u32;
                let p = src.get_pixel(x, sy).0;
                for c in 0..3 { acc[c] += p[c] as u32; }
            }
            img.put_pixel(x, y, image::Rgb([(acc[0] / k) as u8, (acc[1] / k) as u8, (acc[2] / k) as u8]));
        }
    }
}

/// When the wallpaper file last changed (to notice a new wallpaper).
pub fn stamp() -> Option<std::time::SystemTime> {
    std::fs::metadata(wallpaper_file()?).and_then(|m| m.modified()).ok()
}
