# Slint's software renderer, as Esther uses it

This is Slint's `i-slint-renderer-software` 1.18.1, unchanged except for two things, marked "Esther:".

How letters are drawn (`fonts/vectorfont.rs`):

- glyphs are hinted (stems on whole pixels), as Windows draws text;
- a contrast lift and gamma are applied to the edges of letters, as DirectWrite and Skia do, so text looks solid
  rather than thin and soft.

Drawing a window whole when asked (`lib.rs`, `draw_whole_next_frame`): Windows throws a layered window's picture away
when it starts or stops being see-through (Esther's fades), and the renderer, which draws only what changed, can't
know; Esther asks for the whole window to be drawn at those moments.

Slint is used under its royalty-free licence (see `LICENSES/`).
