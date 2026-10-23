# Esther native: Esther's cards, without Electron

Esther's cards as one native Windows program, written in Rust with the [Slint](https://slint.dev) toolkit, to make
Esther light. The Electron app uses about 250–300 MB; this keeps under 25 MB in Task Manager (about 9 MB on the test
machine), and its Windows test fails if it goes over.

Stages 1 to 3 of the move are here: the four cards, each its own window, all showing the one set of tasks; the tray,
the shortcut, starting with Windows, the bubble, and the grid and guides while you move and resize; and Settings.
Still to come: stage 4, the installer and updater in place of Electron's.

## The cards
- **Header**: Esther's arch emblem and name, the greeting by the time of day, the date and the day's line (the same line
  the Esther app shows that day), and × to hide Esther. Double-click the emblem and name to put every card back where
  it started; right-click the header for that, Hide or Quit.
- **Tasks**: list tabs (All and your lists, with open counts), All / To do / Done, and the task table: ⠿, tick, › and
  name, list, subtasks (a bar and n/m), date. Add a task with Enter; beside it pick its list (on All) and its date.
  - Click a heading (TASK, LIST, SUBTASKS, DATE) to sort by it, again for the other way; "Back to my order" undoes it.
    Drag a heading's left edge to make its column wider or narrower (remembered).
  - Drag a task by its ⠿ to put it elsewhere (not while sorted); drag a list tab along the tabs the same way.
  - Ctrl+Z undoes the last change (a delete, a move, a tick, a rename…), up to 100 back; in a field with text in it,
    it undoes the typing instead.
  - Click a task's name to edit it (Enter or clicking away saves, Esc cancels).
  - Click its list to move it to another list; click › or its subtasks (or "+ sub") to open them: tick, click to edit,
    right-click to delete, and "Add a subtask"; click its date for the date picker (Today, Tomorrow, Next week, any
    day of any month, or No date). Right-click a task anywhere on its line for quick dates, its list, its subtasks,
    and Delete task.
  - Lists: + (at the right of the tabs) for a new one; double-click a tab to rename it; right-click a tab for Rename,
    its colour, or Delete list (its tasks moved to another list, or deleted with it).
  - Finished tasks stay crossed out, "clears in N days", and clear themselves after a week. Narrower than 560 px it goes
    compact.
- **Calendar**: the month, Monday first, with open tasks as dots in their lists' colours; today outlined. Click a day
  and the Tasks card shows only that day (a task added then gets that date); click it again, or the × on the Tasks card,
  for every day. ‹ Today › move between months.
- **This week**: Monday to Sunday, and anything still open from before. Tick tasks there; click a task's name to point
  it out on the Tasks card. Right-click a task for the same menu as on the Tasks card.

Every card: drag it by its empty space, resize it from any edge or corner (the grip at the bottom right shows where;
Alt from the centre, Shift in proportion, both together for both, like Illustrator). While you do, the grid shows (every 8 px, stronger every 32), with the
screen's centre, middle and quarters dashed and the other cards outlined; the card lands on the grid, and near a guide
(the centre, a quarter, another card's edge or centre, or an even gap from it) it snaps to it and the guide lights up
with its name. Where each card is is remembered (`esther-native.json` next to the tasks).

Esther's glass: Windows' own acrylic behind every card (the acrylic accent docks and other desktop tools use), so
Windows blurs whatever is behind the card, live, in its own compositor, and Esther draws only its warm tint over it.
That costs Esther nothing. Where Windows won't give acrylic, Esther paints its own glass instead: your wallpaper,
blurred, with the tint, made once at the screen's own size (made again when the wallpaper changes). On Windows each
card sits on the desktop like the Electron cards (owned by the desktop window), is a tool window (no taskbar button),
has Windows' rounded corners, and no Windows window animations: Esther's own instead.

## Settings
The gear on the header (or right-click the header, or the tray menu's Settings…) opens Settings, a card of its own: drag
it by its name, close it with ×. It comes back with the cards if it was open when they were hidden.
- **Desktop**: the show/hide shortcut (click it and press new keys with Ctrl, Alt or the Windows key; if another app
  has them, Esther says so and keeps the old ones), the bubble and its size, snapping, Start with Windows.
- **Cards**: each card on or off, and Put the cards back.
- **Look**: the Esther app's looks (Gilded, Nocturne, Modern, Illuminated), a panel colour of your own (the text turns
  light or dark to stay readable), how solid the panels are, Windows' acrylic or Esther's own glass (and how blurred),
  the highlight colour, and Reset.
- **Tasks**: when finished tasks clear themselves (a day to a month, or never), and Save a copy (a new file in your
  Documents folder; it never replaces one).
- **About**: the version, the memory Esther is using right now as Task Manager counts it, and Quit.

Not in Settings yet: the cards' size (Windows' display scale sets it), where the cards sit (on the desktop only), and
loading a saved copy.

## Showing and hiding
- **Ctrl+Alt+E** (or the keys set in Settings), or a click on the tray icon (the "E"): if the cards are in front, they fly into the bubble as they
  fade; otherwise they fly out of it, one after another. Alt+F4 on a card hides Esther too.
- **The bubble**: the word "Esther", on nothing (no card, no glass, no Windows border or corners). While the cards are away it sits big in the middle of the screen (the mouse wheel
  over it makes it bigger or smaller); click it and they come back, and it goes small to the bottom left (click it
  there to hide them again).
- **The tray menu** (right-click the "E"; Windows' own menu, light or dark with Windows): Show / Hide, Settings…, Cards (which are
  on), Put the cards back, Snap to the grid and guides, The Esther bubble, Start with Windows, Quit Esther.

## Shares your tasks with Esther
Both read and write `%APPDATA%\Esther\tasks.json`. Esther 2.2 or later writes it; this program never creates it, so a
first start here can't overwrite your tasks. Until the file exists, the Tasks card waits (and says so). Changes made in
one show up in the other within a second or so. Running both shows two sets of cards, so close the Electron one (or
turn its cards off in Settings → Cards) while you try this.

## Build and try
- `cargo run` (Linux needs libxkbcommon-x11). `cargo build --release` for the small, fast build: `esther-native.exe` (on Windows it carries its version, shown in its Properties → Details; the download on the pre-release is named with it, e.g. `esther-native-0.3.0.exe`).
- `esther-native --smoke DIR` opens the cards on `DIR/tasks.json` and tries them, on Windows with the real mouse and
  keyboard: adds, renames, moves, dates (menu and picker) a task and gives it a subtask; renames and adds a list; picks a
  day on the calendar; points out and ticks a task from This week; resizes and drags cards with the guides showing and
  snaps one to the screen's centre; right-clicks a task and deletes it, brings it back with Ctrl+Z, sorts by date,
  drags a task and a list tab to new places and widens a column; opens Settings with the gear, picks a look, turns a
  card off and on, changes the shortcut and back, and closes it; hides with Ctrl+Alt+E and comes back with the bubble; opens the tray menu and
  clicks elsewhere to close it; turns Start with Windows on and off. It saves pictures (of each card, and of the whole
  screen at the interesting moments) and the figures (`memory.json`), and quits. The Windows workflow
  (`.github/workflows/esther-native.yml`) runs this on every push and puts the program, the pictures and the figures on
  the "Esther native" pre-release.
- `SLINT_BACKEND=winit-femtovg` draws with the graphics card (OpenGL) instead of the processor, for comparison.

## Text
Letters are drawn the way Windows draws them, not Slint's usual soft way: fitted to the pixel grid (hinted), with
Windows' contrast and gamma, in Segoe UI. That is a small change to Slint's software renderer, kept in
`vendor/i-slint-renderer-software` (see its `ESTHER.md`); `ESTHER_TEXT_CONTRAST` and `ESTHER_TEXT_GAMMA` try other
values. Fonts: Instrument Serif (SIL Open Font License, `ui/fonts/OFL.txt`).

## Not here yet
The cards fly and fade, but don't shrink as they go into the bubble (Electron's do).
