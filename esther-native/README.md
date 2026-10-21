# Esther native: the Tasks card, without Electron

A prototype of Esther's Tasks card as a native Windows program, written in Rust with the [Slint](https://slint.dev)
toolkit, to see how light Esther can be. The Electron app is ~250–300 MB; this card aims for well under 40 MB.

## What it does
- List tabs (All and your lists, with open counts), All / To do / Done, and the task table: tick, name, list, subtasks, date.
- Add a task with Enter (on All, click the list pill to pick which list it goes to).
- Double-click a task to rename it; right-click it for Today / Tomorrow / Next week / No date, Move to a list, or Delete.
- Finished tasks stay crossed out, "clears in N days", and clear themselves after a week.
- Narrow card (under 560 px): no column headings, the list shown as a dot.
- Drag the card by the space around the tabs; resize it from any edge or corner. Both land on the 8 px grid, and it
  remembers where you put it.
- Esther's glass: your wallpaper, blurred, lined up behind the card, picked up again when the wallpaper changes.
- On Windows it sits on the desktop like the Electron cards (owned by the desktop window), is a tool window (no
  taskbar button), has Windows' rounded corners, and no Windows window animations.

## Shares your tasks with Esther
Both read and write `%APPDATA%\Esther\tasks.json`. Esther 2.2 or later writes it; this card never creates it, so a
first start here can't overwrite your tasks. Until the file exists, the card waits (and says so). To try it beside
Esther, turn off Esther's own Tasks card (Settings → Cards) and run `esther-tasks.exe`.

## Build and try
- `cargo run` (Linux needs libxkbcommon-x11). `cargo build --release` for the small, fast build.
- `esther-tasks --smoke DIR` opens the card on `DIR/tasks.json`, adds a task, saves `DIR/tasks-card.png` and
  `DIR/memory.json`, and quits. The Windows workflow (`.github/workflows/esther-native.yml`) runs this on every push
  and puts the program, the picture and the memory figures on the "Esther native" pre-release.
- `SLINT_BACKEND=winit-femtovg` draws with the graphics card (OpenGL) instead of the processor, for comparison.

## Not in the prototype yet
Subtasks (shown as a count, not opened), colours and looks from Esther's settings, the date picker, Alt/Shift
resizing, the guides, and the other cards. Fonts: Instrument Serif (SIL Open Font License, `ui/fonts/OFL.txt`).
