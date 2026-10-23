# Slint's software renderer, as Esther uses it

This is Slint's `i-slint-renderer-software` 1.18.1, unchanged except for two things, marked "Esther:".

How letters are drawn (`fonts/vectorfont.rs`):

- glyphs keep their true shapes (not fitted to the pixel grid), soft and even as a Mac draws them
  (`ESTHER_TEXT_HINT=1` fits them to the grid instead, as Windows does);
- a gentle contrast lift and gamma are applied to the edges of letters, as DirectWrite and Skia do, so text reads
  solid rather than thin (`ESTHER_TEXT_CONTRAST`, default 0.4, and `ESTHER_TEXT_GAMMA`, default 0.85).

Drawing a window whole when asked (`lib.rs`, `draw_whole_next_frame`): Windows throws a layered window's picture away
when it starts or stops being see-through (Esther's fades), and the renderer, which draws only what changed, can't
know; Esther asks for the whole window to be drawn at those moments.

Slint is used under its royalty-free licence (see `LICENSES/`).
