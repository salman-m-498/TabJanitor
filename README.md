# Tab Janitor

<p align="center">
   <img src="icons/favicon-128x128.png" width="120" height="120" alt="Tab Janitor icon" />
</p>

Tab Janitor is a Chrome extension that keeps active browsing lean by automatically archiving overflow tabs into a searchable, filterable library. Each archived tab preserves where you left off, so future reading resumes at the same paragraph. The project combines a background service worker, modern popup UI, and Chrome's extension APIs into a polished productivity tool.

## Table of Contents
1. [Highlights](#highlights)
2. [Architecture](#architecture)
3. [UI Walkthrough](#ui-walkthrough)
4. [Installation](#installation)
5. [Development](#development)
6. [Future Enhancements](#future-enhancements)

## Highlights
- **Smart auto-close**: configurable toggle and tab limit automatically archive least-recent tabs when windows get crowded.
- **Context-preserving archive**: captures scroll position and surrounding text so reopened articles jump back to the exact reading location.
- **Rich metadata**: stores domain, favicon, and optional user notes per tab; renders a clean card layout optimized for review.
- **Powerful filtering**: instant search, domain filter, age filter, and lazy pagination make large archives easy to sift.
- **Selective archiving**: current tabs list includes iOS-style checkboxes, shift-click range support, and note field before archiving.
- **One-click restore**: archived entries include Restore and Open actions; restore removes the entry and reopens the page with scroll retention.
- **Stale tab reminders**: background alarms nudge the user when tabs have lived in the archive for more than a week.

## Architecture
| Layer | Responsibilities | Key Files |
| --- | --- | --- |
| Background service worker | Tracks current tabs, enforces auto-close policy, archives tabs with scroll data, handles reminders and restore requests. | [`background.js`](background.js) |
| Popup UI | Renders current tabs, archive explorer, and settings; manages user interactions and sends runtime messages. | [`popup.html`](popup.html), [`popup.js`](popup.js) |
| Manifest | Chrome MV3 configuration, permissions (`tabs`, `storage`, `notifications`, `scripting`), and default popup binding. | [`manifest.json`](manifest.json) |

### Data Model
- `chrome.storage.local.current`: live snapshot of open tabs `{ id, title, url, date }`.
- `chrome.storage.local.archived`: array of archived tab objects `{ id, title, url, scrollY, date, favicon, domain, note }`.
- Settings persisted via `chrome.storage.local`: `{ autoClose: boolean, tabLimit: number, lastReminder: timestamp }`.

### Message Channels
- `getSettings`/`updateSettings`: sync UI controls with background state.
- `archiveSelectedTabs`: request archival (with optional note) of user-selected tabs.
- `openArchivedTab` and `restoreArchivedTab`: reopen entries while restoring scroll position and optionally removing them from storage.

## UI Walkthrough
1. **Settings glass card**: toggle auto-archive and define tab limit (2–50). Values persist and drive the background enforcement logic.
2. **Current tabs list**: live view of all open tabs with branded checkboxes for selection. Shift-click selects ranges; optional note field annotates the subsequent archive action.
3. **Archive explorer**:
   - Search input filters by title or URL substring.
   - Domain dropdown auto-populates from stored entries.
   - Age filter highlights recent saves (day/week/month).
   - Lazy loader reveals more items in 15-card batches.
   - Each card shows favicon, title, domain/date meta, optional note, and inline actions (Open, Restore).
4. **Maintenance controls**: `Load more` and `Clear All` buttons keep the archive manageable.

## Installation
1. Clone or download the repository.
2. Open **chrome://extensions** and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder (`TabJanitor`).
4. The Tab Janitor icon appears in the toolbar. Pin it for quick access.

## Development
- **Stack**: Chrome MV3, vanilla JavaScript, DOM APIs, Chrome tabs/storage/alarms/notifications APIs.
- **Styling**: iOS-inspired glassmorphism implemented directly in `popup.html` for rapid iteration.
- **Linting/formatting**: project sticks to standard JS/DOM patterns; no build pipeline required.
- **Hot reload**: after code changes, click **Reload** on the Tab Janitor card inside **chrome://extensions**.

### Key Flows
1. **Auto-archive**: `chrome.tabs.onCreated` → enforce limit → `archiveTabs()` → capture scroll/text via `chrome.scripting.executeScript` → persist entry → `chrome.tabs.remove`.
2. **Manual archive**: popup selection → `archiveSelectedTabs` message → background reuses `archiveTabs()` with supplied note.
3. **Restore**: popup `Restore` button → `restoreArchivedTab` message → create tab + scroll injection → remove entry from storage.
4. **Reminder alarms**: `chrome.alarms` fires every six hours → stale check → throttled notification via `chrome.notifications`.

## Future Enhancements
- Integrate keyboard shortcuts for instant archiving/restoring.
- Sync archive metadata across devices via `chrome.storage.sync`.
- Add screenshot previews for visual memory cues.
- Offer analytics (e.g., domains most often archived, revisit cadence).
- Provide export/import for long-term knowledge management workflows.

---
