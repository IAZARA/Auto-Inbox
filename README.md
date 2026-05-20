# Auto-inbox

![Auto-inbox dashboard preview](docs/images/auto-inbox-banner.png)

Auto-inbox is an open-source AI inbox assistant for teams that want faster customer replies without giving up human review. It reads like a premium support dashboard: incoming emails, intent detection, FAQ context, a generated reply, activity logs, and a clear manual `Enviar` action before anything is sent.

[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e?style=flat-square)](LICENSE)

## Overview

Auto-inbox turns the workflow of an AI email responder into a product-ready interface. The current version is a polished frontend prototype built for portfolio and open-source iteration. It uses realistic demo data so anyone can explore the experience without connecting Gmail, Google Sheets, or OpenAI credentials, and it already includes desktop-ready Google OAuth bridge layers for Gmail and Sheets.

The product direction is intentionally human-in-the-loop: AI prepares the response, but the user reviews and sends it manually.

## Highlights

- Premium 4-column inbox dashboard inspired by modern email and support tools.
- Dark sidebar with mailbox, automation, integration, and mode controls.
- Searchable inbox list with unread states and selected-message focus.
- Email detail view with customer metadata, intent, confidence, FAQ matches, and history.
- AI suggested reply composer with formatting controls, regenerate action, and manual `Enviar` button.
- Desktop-ready Gmail OAuth connection panel with sync state, history ID tracking, and least-privilege scopes.
- Configurable Gmail heartbeat for automatic inbox checks and duplicate skipping.
- Google Sheets MVP integration for FAQ rows, automation rules, and activity logs.
- Automation status panel and activity log for observability.
- English and Spanish interface language toggle while keeping email content untouched.
- Responsive layout with no horizontal overflow on mobile.

## Tech Stack

- React 19
- TypeScript
- Vite
- lucide-react
- CSS modules-style global styling with responsive grid layouts

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Desktop Development

Auto-inbox now includes an Electron shell for the future `.exe` build. In desktop mode, the React app receives a secure `window.autoInboxGmail` bridge from Electron instead of handling Google tokens directly.

```bash
npm run dev:desktop
```

For a Windows installer build:

```bash
npm run dist:desktop
```

## Build

```bash
npm run build
```

## Gmail OAuth Architecture

Auto-inbox is prepared for the safest desktop path: Google OAuth 2.0 for installed apps, Gmail API scopes, and secure token storage in the desktop shell.

- The React UI calls a `window.autoInboxGmail` bridge when Tauri or Electron exposes it.
- The Electron preload exposes that bridge through isolated IPC.
- The browser build falls back to a demo bridge so the open-source app remains easy to run.
- The first production scopes are `gmail.readonly` and `gmail.compose`, avoiding full mailbox access unless the product truly needs it.
- Initial sync can use `users.messages.list` and `users.messages.get`.
- Incremental sync can persist the latest `historyId` and call `users.history.list`.
- The UI includes a configurable heartbeat, currently 30 seconds to 15 minutes, so users choose how often Gmail is checked.
- Auto-sync keeps a local `seenMessageIds` cache and skips duplicate message IDs before counting or processing new emails.
- Sending should stay human-in-the-loop: generate a Gmail draft first, then let the user review and send.
- Access and refresh tokens are encrypted with Electron `safeStorage` and kept outside frontend storage.

To test real Gmail OAuth locally, create a Google Cloud OAuth client for a desktop app and set:

```bash
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=optional-client-secret
```

The app also reads a local `.env` file during desktop startup. The web-only Vite build still works without Gmail credentials.

## Google Sheets MVP

The first Sheets integration is intentionally simple: paste a Google Sheet URL or spreadsheet ID inside the app. Auto-inbox expects these tabs:

```text
FAQ
  enabled | intent | question | answer | tags | source | updated_at

Rules
  enabled | priority | match_text | intent | action | notes

Activity
  timestamp | email_id | sender | subject | intent | confidence | status | draft_created

Settings
  key | value
```

In desktop mode, the Electron bridge requests the `https://www.googleapis.com/auth/spreadsheets` scope, validates the selected spreadsheet, reads `FAQ` and `Rules`, and appends rows to `Activity`. In browser mode, the same UI uses demo data so contributors can work without Google credentials.

## Automation Engine

The inbox sync logic is separated from the React UI under `src/automation`. The current engine owns Gmail sync execution, heartbeat scheduling helpers, local heartbeat persistence, and duplicate detection through a bounded `seenMessageIds` cache. This keeps the UI focused on state and controls while leaving the automation flow ready for OpenAI classification and reply generation.

## Product Roadmap

- Settings UI for Gmail OAuth client configuration.
- Google Picker support for choosing a spreadsheet without pasting an ID.
- OpenAI-powered classification and reply generation.
- Real Gmail draft creation before sending.
- Safety rules for newsletters, billing, legal, and sensitive support cases.
- Desktop installer polish, app icon, and signed releases.
- Optional hosted SaaS mode for always-on automation.

## Project Structure

```text
Auto-Inbox/
  electron/                Electron shell, preload bridge, and Google OAuth flow
  docs/images/             README and GitHub assets
  src/automation/          Inbox sync engine, scheduler helpers, and dedupe store
  src/gmail/               Gmail OAuth bridge, API helpers, and sync types
  src/sheets/              Sheets API helpers, bridge, and MVP data mappers
  src/main.tsx             Main React application
  src/styles.css           Premium dashboard styling
  .env.example             Future desktop OAuth configuration placeholders
  index.html               Vite entry
  package.json             Scripts and dependencies
  tsconfig.electron.json   Electron TypeScript build config
```

## Philosophy

Auto-inbox is not trying to hide automation behind a black box. It is designed around review, clarity, and trust: show the reasoning context, show the generated reply, and keep the final send action in the user's hands.

## License

MIT
