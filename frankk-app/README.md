# Esther — Milestone 1 prototype

An interactive, **fixture-only** prototype of Esther, the life control panel (React + TypeScript + Vite).
It never reads or writes your Obsidian vault. All records are sample data kept in this browser's `localStorage`.

## Run it
```
npm install
npm run dev        # http://127.0.0.1:5173   (add ?today=2026-10-14 to pin the date)
npm test           # unit tests (rules: progress, scope, bills, agenda)
npm run e2e        # 63 browser checks (needs the dev server running and Chromium)
```

## What works (real)
- **Home board:** drag panels by the dotted grip, resize by edge/corner, hide/restore secondary widgets, focus mode (maximize icon / Esc), layout + column widths + filters persist across restart. Below ~1240px the board scrolls sideways instead of squashing text.
- **General (complete):** add (name, steps, task date, due date), inline rename (Enter/Esc), complete/reopen, expandable steps, filters, sorting, drag rows by handle or `Alt+↑/↓`, resizable/hideable columns, detail drawer.
  Finishing every step never completes the task; completing the task never ticks steps.
- **Music:** *Artist job* (only assigned stages count) vs *Full release*. Out-of-scope stages never reduce progress or become overdue. Stage checklists, dates, reorder, include/exclude, add job/release.
- **Seround:** brand groups (spelling preserved), brand filter, sundey content queue vs backend, content fields in the drawer.
- **House:** recurring bills with per-month paid state, missed months stay visible, editable reminder offset.
- Today strip, Coming up, mini calendar (click a day), quick capture (General tasks), `Ctrl+K` search.

## Simulated / unavailable (labelled in the UI)
- Everything is sample data; no vault connection (Milestone 2, read-only).
- "Open in Obsidian" builds the official `obsidian://` link and shows it; it does not launch Obsidian.
- Reminders: offset saved, nothing delivered. Office Google Calendar, iPhone sync, AI assistant: not connected.
- Repeat/reminder on General tasks and Note/Idea/Link/Meeting capture: disabled.
- No delete/move/rename-file features exist, by design.

## Architecture
`src/data/repository.ts` (`FixtureRepository`, swappable later for vault adapters) → `reducer.ts` (pure rules) → React UI. Layout/column preferences are stored separately from content. Tauri is not wrapped yet (Milestone 2).

Screenshots: `docs/screens/`.

## Iteration 2
- Renamed to **Esther**.
- Columns: every column (including the name) has its own width that stays where you drag it; double-click a divider to reset; extra columns (Priority, List, Workstream) via each panel's ⋯ menu.
- Bento: fits the window height, panels swap places when dropped on each other, resize from left, right, bottom or corners.
- Thick progress bars with the percentage printed on them.
- Click to edit: task names, steps (and remove), panel names, brand names (add/rename), bill names and due day, music artist/project/client/roles/target date, stage and item names. Ctrl+Z or the toast's Undo reverts the last 50 changes.

## Iteration 3
- Themes: **Manuscript** (candlelit oak, gold leaf, pigment colours), **Parchment** (light vellum) and **Modern**, with adjustable accent and area colours (Appearance button or Settings). Sources: `docs/DESIGN-RESOURCES.md`.
- Own releases use a **step bar** (Concept → Lyrics → Produce → Record → Mix & Master → Art (Design)); Marketing, MV and Streaming are separate tracks that never count toward release progress.
- sundey **repost queue** is a simple to-do list with one-line add.
- Every task can be a **simple to-do** or **with steps** (progress bar); switch any time.
- **Tags**: coloured, add from any row or with `#tag` in quick capture, click a tag to filter the board, rename/recolour in Settings.
- Full **New task** and **New project** windows that ask for everything.
- More colour coding: priority stripes, brand colours, project colours, date pills (today, soon, overdue), calendar dots by area.

## Iteration 4: medieval art direction
- New default look **Illuminated** (vellum, iron-gall ink, flat lapis / vermilion / verdigris / gold), plus **Nocturne** (the same manuscript language printed dark with grain) and **Modern**.
- No glows, gradients, blur or rounded pills in the medieval looks: double ink rules, blackletter rubrics, small caps, pilcrows, Roman-numeral steps.
- Ornaments: vine border with ivy leaves and gold dots, diaper band, illuminated initials, arch emblem, and the lion drollery.
