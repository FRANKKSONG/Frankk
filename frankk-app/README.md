# Esther — build 0.2.6 (prototype)

An interactive, **fixture-only** prototype of Esther, the life control panel (React + TypeScript + Vite).
It never reads or writes your Obsidian vault. All records are sample data kept in this browser's `localStorage`.

## Run it
```
npm install
npm run dev        # http://127.0.0.1:5173   (add ?today=2026-10-14 to pin the date)
npm test           # unit tests (rules: progress, scope, bills, agenda)
npm run e2e        # 84 browser checks (needs the dev server running and Chromium)
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

## Iteration 5: depth
- Two main pages: **Home** (your own dashboard of widgets) and **Tasks** (the board).
- **Library**: types with smart fields (kind detected from the name/example), your own types, saved views (table, board, gallery, calendar, list).
- **Notes**: folders, Markdown, `[[wikilinks]]`, backlinks, linked records, the AI librarian's folder and proposals.
- **Settings**: storage map (types → vault folders → files), Obsidian Bridge with Bases previews, AI & models (MCP for subscriptions, keys for DeepSeek/Jev), AI permissions, history.
- New default look **Gilded**: readable dashboard over art backgrounds with medieval accents.
- Principles and roadmap: `docs/ARCHITECTURE.md`.

## Iteration 6: polish
- Appearance → Window background: art, plain colour or your own image, with panel translucency, blur and darkening sliders; Highlight colour.
- Calm surfaces in Gilded/Modern: hairline edges, soft glass panels, no coloured top bars or inner outlines.
- Drag handles to reorder music stages, stage items and task steps (keyboard: Space, arrows, Space).
- Column headers: click to sort (▲/▼, third click = manual order), larger resize handles, double-click to fit. Library tables too; view changes save automatically.
- Date chips that look editable (calendar icon, dashed "Add date" when empty).
- Type: Instrument Serif for headings, Instrument Sans for everything else.

## Build 0.2.5
The morning check. Home is built around what Frankk asked for: today's mood, what to start first, the tasks, the calendar, and one place to write anything.
- **Matins header**: today's mood takes the greeting's place. A painted glory brightens, and the chapel darkens, the heavier the day (late items, deadlines, the B-YOU office day). A blessing pairs an Aramaic word with an inscription-style line and a verse quoted from public-domain translations (KJV, Yusuf Ali, Long, Gummere, Legge, Müller). Your saying and your motto ("An ancient dreams in a modern land") are part of it. A small month sits in the corner.
- **Tell Esther bar**: reads plain sentences without AI: where a task belongs (B-YOU, a Seround brand, the house), its deadline or day, urgency and #tags, shown before Enter. Prefixes `i:` `p:` `c:` `j:` keep ideas, progress, context and journal lines. Tab will ask the AI once one is connected.
- **Begin here**: what to start first and why, with a per-task shortcut that opens it.
- **Today's journal**: every capture is a timestamped line on today's page in `Esther/Journal`; write in it directly too.
- **Sparks**: ideas come back instead of piling up; one older idea to revisit each day, the newest below.
- **Task details** as a property sheet; the Tasks board panels are compact summaries of their pages; table headers sit above their scrolling rows; overlay scrollbars can be dragged.
- Life brief of Frankk's answers: `docs/LIFE-BRIEF.md`.
- Still sample data only: no vault, phone, calendar or AI connection yet.

## Build 0.2.6
- The bar knows your music: name an artist or project ("record Just vocal") and the work becomes an item on that project's stage, Record, Mix and so on, or the current stage when none is named. Saying you'll do a stage that was outside your scope on a job brings it into scope, and the preview says so. Music without a project becomes a task tagged #music.
- "friday this week", "this week" (by Sunday) and "this weekend" are read as dates and taken out of the task name.
- New dated tasks fall into place by date among their area's tasks instead of landing on top. Task panels also have a "Smart: late, then soonest" order.
