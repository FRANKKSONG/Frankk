# Slint's software renderer, as Esther uses it

This is Slint's `i-slint-renderer-software` 1.18.1, unchanged except for how letters are drawn
(`fonts/vectorfont.rs`, marked "Esther:"):

- glyphs are hinted (stems on whole pixels), as Windows draws text;
- a contrast lift and gamma are applied to the edges of letters, as DirectWrite and Skia do, so text looks solid
  rather than thin and soft.

Slint is used under its royalty-free licence (see `LICENSES/`).
