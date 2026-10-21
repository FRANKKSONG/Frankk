//! Esther's glass, natively: the wallpaper, cropped the way Windows' "Fill" shows it, blurred, with the panel's tint
//! laid over it, at the screen's own size. Every card shows the part of it that sits behind the window, pixel for
//! pixel, so it reads as frosted glass, looks smooth, and is quick to draw. It's worked out again whenever the
//! wallpaper file changes. (One picture, shared by every card.)
use slint::{Image, Rgb8Pixel, SharedPixelBuffer};
use std::path::PathBuf;

pub fn wallpaper_file() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ESTHER_WALLPAPER") {
        return Some(PathBuf::from(p));
    }
    std::env::var("APPDATA").ok().map(|a| PathBuf::from(a).join("Microsoft").join("Windows").join("Themes").join("TranscodedWallpaper"))
}

/// The glass for a screen of `sw` × `sh` pixels: the wallpaper blurred by about `blur_px`, under `tint` at
/// `alpha` (0–1). None if there is no wallpaper file.
pub fn glass(sw: u32, sh: u32, blur_px: f32, tint: [u8; 3], alpha: f32) -> Option<Image> {
    let bytes = std::fs::read(wallpaper_file()?).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.to_rgb8();
    let (iw, ih) = img.dimensions();
    // Cover-crop to the screen's shape.
    let scale = f32::max(sw as f32 / iw as f32, sh as f32 / ih as f32);
    let (cw, ch) = ((sw as f32 / scale) as u32, (sh as f32 / scale) as u32);
    let cropped = image::imageops::crop_imm(&img, (iw - cw.min(iw)) / 2, (ih - ch.min(ih)) / 2, cw.min(iw), ch.min(ih)).to_image();
    drop(img);
    // Blur small (quick), then bring it up to the screen's size smoothly, once.
    let (w, h) = ((sw / 4).max(32), (sh / 4).max(18));
    let mut small = image::imageops::resize(&cropped, w, h, image::imageops::FilterType::Triangle);
    drop(cropped);
    let r = ((blur_px / 4.0) as u32).max(1);
    for _ in 0..3 {
        box_blur(&mut small, r);
    }
    let full = image::imageops::resize(&small, sw, sh, image::imageops::FilterType::Triangle);
    drop(small);
    // The tint, and a whisper of noise so the soft gradients don't show bands.
    let mut buf = SharedPixelBuffer::<Rgb8Pixel>::new(sw, sh);
    let mut seed: u32 = 0x9e37_79b9;
    for (dst, src) in buf.make_mut_slice().iter_mut().zip(full.pixels()) {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        let n = (seed >> 24) as f32 / 255.0 - 0.5;
        let mix = |c: u8, t: u8| (t as f32 * alpha + c as f32 * (1.0 - alpha) + n * 2.0).round().clamp(0.0, 255.0) as u8;
        *dst = Rgb8Pixel { r: mix(src.0[0], tint[0]), g: mix(src.0[1], tint[1]), b: mix(src.0[2], tint[2]) };
    }
    Some(Image::from_rgb8(buf))
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
