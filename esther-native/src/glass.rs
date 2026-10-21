//! Esther's glass, natively: the wallpaper, cropped the way Windows' "Fill" shows it, shrunk to a quarter and
//! blurred once. The card shows the part of it that sits behind the window, so it reads as frosted glass.
//! It's worked out again whenever the wallpaper file changes.
use slint::{Image, Rgb8Pixel, SharedPixelBuffer};
use std::path::PathBuf;

pub fn wallpaper_file() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ESTHER_WALLPAPER") {
        return Some(PathBuf::from(p));
    }
    std::env::var("APPDATA").ok().map(|a| PathBuf::from(a).join("Microsoft").join("Windows").join("Themes").join("TranscodedWallpaper"))
}

/// The blurred wallpaper for a screen of `sw` × `sh` pixels, or None if there is no wallpaper file.
pub fn blurred(sw: u32, sh: u32, blur_px: f32) -> Option<Image> {
    let bytes = std::fs::read(wallpaper_file()?).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.to_rgb8();
    let (iw, ih) = img.dimensions();
    // Cover-crop to the screen's shape.
    let scale = f32::max(sw as f32 / iw as f32, sh as f32 / ih as f32);
    let (cw, ch) = ((sw as f32 / scale) as u32, (sh as f32 / scale) as u32);
    let cropped = image::imageops::crop_imm(&img, (iw - cw.min(iw)) / 2, (ih - ch.min(ih)) / 2, cw.min(iw), ch.min(ih)).to_image();
    drop(img);
    let (w, h) = ((sw / 4).max(32), (sh / 4).max(18));
    let mut small = image::imageops::resize(&cropped, w, h, image::imageops::FilterType::Triangle);
    drop(cropped);
    let r = ((blur_px / 4.0) as u32).max(1);
    for _ in 0..3 {
        box_blur(&mut small, r);
    }
    let mut buf = SharedPixelBuffer::<Rgb8Pixel>::new(w, h);
    buf.make_mut_bytes().copy_from_slice(small.as_raw());
    Some(Image::from_rgb8(buf))
}

/// One pass of a box blur, horizontally then vertically (three passes look close to a Gaussian blur).
fn box_blur(img: &mut image::RgbImage, r: u32) {
    let (w, h) = img.dimensions();
    let src = img.clone();
    let k = (2 * r + 1) as u32;
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
