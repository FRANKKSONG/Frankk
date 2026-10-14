# Esther — architecture and principles

Esther is a life control panel on top of an Obsidian vault. This document records the principles it is built on,
how data is stored, how it talks to Obsidian and to AI, and what comes next.

## Principles

1. **Files are the truth (local-first).** Every task, project, person, idea, bill and note is a Markdown file with
   YAML properties in your vault. Esther's database is only a rebuildable index. If Esther disappeared, your life
   would still be readable in Obsidian. ([Ink & Switch, local-first software](https://inkandswitch.com/local-first/))
2. **Everything is a typed object.** A *Type* (Task, Music project, Person, Book…) has *Fields*. Built-in types map
   onto Esther's own models; you can add fields to them and create your own types. ([Capacities objects](https://capacities.io/compare/tana), [Tana supertags](https://www.asianefficiency.com/technology/tana-vs-capacities-vs-logseq/))
3. **Smart field kinds.** Each field has a kind (text, number, money, percent, date, checkbox, choice, multiple choice,
   link, email, phone, rating, duration, relation). The kind decides the editor, how it is summarised (sums, averages,
   calendars, boards) and how it is written to frontmatter. Esther guesses the kind from the name and an example value.
4. **One dataset, many views.** Saved views (table, board, gallery, calendar, list) with filters, sorts and grouping
   work over any type, and can be placed on any dashboard. ([Notion relations, rollups and linked views](https://sync2sheets.com/blog/how-to-link-databases-in-notion/))
   Saved views are mirrored as Obsidian **Bases** (`.base`) files so they work inside Obsidian too. ([Obsidian Bases](https://help.obsidian.md/bases))
5. **At a glance, then detail.** Home is a dashboard you compose yourself; the two or three numbers that matter sit at
   the top; colour and size carry meaning. ([Stephen Few](https://uxmatters.com/mt/archives/2007/04/book-review-information-dashboard-design.php))
6. **Plan the day, honestly.** Today and This week surface what's planned, due and late, across every space.
   ([Sunsama's daily ritual](https://www.asianefficiency.com/schedule-management/sunsama-review/))
7. **An AI librarian that writes the knowledge base.** Raw captures (Inbox, Journal, clips) are compiled into linked
   pages in `Esther/Knowledge`, with a log of every action and periodic check-ups. ([Karpathy's LLM wiki pattern](https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an))
8. **You stay in control.** The librarian writes freely only in its own folder; everything else is a proposal with a
   diff that you approve. Every write is snapshotted and logged. No deletes, moves or renames without approval.

## Storage map (vault)

| What | Where | Format |
| --- | --- | --- |
| Tasks | `Planning/Tasks/` (TaskNotes-compatible) | one note per task, properties + checklist body |
| Music projects | `Music/Releases/`, `Music/Jobs/` | note with properties; stages in properties + body |
| Bills | `House/Bills/` | note per bill; payments per month in properties |
| People, Ideas, your types | the type's folder | note per record |
| Notes | anywhere | ordinary Markdown with `[[wikilinks]]` |
| Librarian pages + log | `Esther/Knowledge/` | Markdown written by the AI |
| Settings, types, views, dashboards | `Esther/settings.json` | portable between computers |
| Saved views for Obsidian | `Esther/Views/*.base` | Obsidian Bases |
| Uploaded images | `Esther/Assets/` | jpg/png |

Never written: `.obsidian/` plugin configuration, credentials, anything outside the vault.

## Components

```
Esther (Windows app: Tauri + React)
  ├─ UI: Home dashboards · Tasks board · Notes · Library · Calendar · Settings
  ├─ Index (SQLite, rebuildable) ← watcher on vault files
  ├─ Change service: patch → snapshot → stale check → write → log
  ├─ MCP server (local): lets Claude Desktop / ChatGPT / Gemini tools read the library and propose changes
  └─ Model router: Claude · ChatGPT · Gemini (via MCP, your subscriptions) · DeepSeek · Jev (API keys)

Esther Bridge (Obsidian plugin)
  ├─ live two-way events while Obsidian is open
  ├─ safe typed operations (create, patch property, append, open note)
  └─ writes Esther/Views/*.base
```

The bridge follows the pattern of the [Obsidian Local REST API plugin](https://community.obsidian.md/plugins/obsidian-local-rest-api):
local only, authenticated, no remote pages, no arbitrary code execution.

## AI design

- **Subscriptions** (Claude Pro, ChatGPT Plus, Gemini Pro) don't include API keys for other apps. Esther exposes a
  local **MCP server**, and those assistants connect to it. ChatGPT's custom connectors need a reachable address, so
  that path needs a secure tunnel and is treated as advanced. ([MCP in Claude and ChatGPT](https://til.simonwillison.net/llms/mcp-in-claude-and-chatgpt))
- **Pay-per-use**: DeepSeek for cheap bulk jobs; **Jev (TypeSafe AI)** for fast typed decisions such as classifying a
  capture into a type and space, choosing field values and checking AI-written pages. ([Jev launch](https://letsdatascience.com/news/typesafe-ai-launches-jev-decision-model-889a38c0))
- Keys live in Windows Credential Manager; never in the vault or settings file.
- Roles are assignable in Settings → AI & models (writing, research, bulk, decisions).

## Roadmap

1. **Done (prototype):** Home dashboards, Tasks board, Library (types, smart fields, views), Notes with wikilinks and
   backlinks, librarian proposals (sample), Settings with storage map, Bases preview, AI/permission design, themes.
2. **Next: Windows app + read-only vault.** Tauri shell, vault picker, index, live watcher, TaskNotes property mapping,
   proof that nothing in the vault changes.
3. **Approved writes on a copy**, then on the real vault: tasks, fields, notes, with snapshots and stale checks.
4. **Esther Bridge plugin** and Bases files.
5. **AI**: MCP server + librarian (own-folder writes, proposals), Jev routing for captures.
6. **Calendar and reminders** (read-only office calendar first), then phone via Obsidian + Bases.
