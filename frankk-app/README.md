# FRANKK — Milestone 1 prototype

An interactive, **fixture-only** prototype of the FRANKK life control panel (React + TypeScript + Vite).
It never reads or writes your Obsidian vault. All records are sample data kept in this browser's `localStorage`.

## Run it
```
npm install
npm run dev        # http://127.0.0.1:5173   (add ?today=2026-10-14 to pin the date)
npm test           # unit tests (rules: progress, scope, bills, agenda)
npm run e2e        # 49 browser checks (needs the dev server running and Chromium)
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
