# Auto-inbox

![Auto-inbox dashboard preview](docs/images/auto-inbox-banner.png)

Auto-inbox is an open-source AI inbox assistant for teams that want faster customer replies without giving up human review. It reads like a premium support dashboard: incoming emails, intent detection, FAQ context, a generated reply, activity logs, and a clear manual `Enviar` action before anything is sent.

[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e?style=flat-square)](LICENSE)

## Overview

Auto-inbox turns the workflow of an AI email responder into a product-ready interface. The browser build still uses realistic demo data so anyone can explore the experience without credentials, while the Electron desktop build can connect Gmail, Google Sheets, and a configurable AI provider for a local MVP flow.

The product direction is intentionally human-in-the-loop: AI prepares the response, but the user reviews and sends it manually.

The current app is positioned as a focused ecommerce/support workspace for small teams and agencies that handle repetitive customer email every day. It is useful from the first demo session, but the clearest production path is: Gmail for incoming messages and draft creation, Google Sheets for FAQ/rules/activity, an AI provider for classification and drafting, and a human reviewer who approves every reply.

The 100-question product audit is answered in [`docs/product-answers.md`](docs/product-answers.md) and mirrored inside the app through the 100-question audit card.

## Highlights

- Premium 4-column inbox dashboard inspired by modern email and support tools.
- Clear support workspace controls for niche, brand tone, reply language, and confidence threshold.
- Dark sidebar with mailbox, automation, integration, and mode controls.
- Searchable inbox list with unread states and selected-message focus.
- Email detail view with customer metadata, intent, confidence, FAQ matches, and history.
- Safety decision engine for draft allowed, verify first, escalate, and do-not-draft cases.
- Configurable safety rules for automated mail, billing, account access, legal topics, and custom escalation terms.
- Team operation controls for owner, priority, SLA, follow-up, and next action per email.
- Human review checklist that must be completed before a Gmail draft can be created.
- AI suggested reply composer with formatting controls, regenerate action, and manual `Enviar` button.
- Reusable reply templates for shipping delays, returns, invoice verification, and sales quotes.
- Value metrics for prep time, draftable coverage, flagged volume, accepted drafts, edits, escalations, and activity rows.
- Cost estimator for monthly email volume, agent cost, AI cost per draft, time saved, and net monthly value.
- Copyable weekly report with active rules, KPI summary, FAQ gaps, and roadmap items.
- FAQ gap detector that suggests new knowledge-base rows from low-confidence or uncovered intents.
- Product strategy board with best-fit segments, channel plan, differentiation, weekly report scope, and next bets.
- 100-question product audit card that maps product answers to visible workflow evidence.
- Launch checklist for Gmail, Sheets, AI provider, rules, and workspace configuration.
- Desktop-ready Gmail OAuth connection panel with sync state, history ID tracking, and least-privilege scopes.
- Configurable Gmail heartbeat for automatic inbox checks and duplicate skipping.
- Google Sheets MVP integration for FAQ rows, automation rules, and activity logs.
- Configurable AI-backed intent detection and draft generation in desktop mode.
- Gmail draft creation for manual review before sending.
- Automation status panel and activity log for observability.
- English and Spanish interface language toggle while keeping email content untouched.
- Real light/dark theme selector using CSS theme tokens and native `color-scheme` rendering.
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
AI_PROVIDER=openai
AI_API_KEY=your-provider-api-key
AI_MODEL=gpt-5-mini
```

The app also reads a local `.env` file during desktop startup. The web-only Vite build still works without Gmail credentials.

## AI Provider Configuration

In desktop mode, the Electron process calls the selected AI provider so API keys are not stored in the React frontend. Auto-inbox sends the selected email body plus the active FAQ and Rules rows, asks for JSON, and writes the returned intent, confidence, FAQ matches, activity items, and suggested reply back into the inbox UI.

Set `AI_PROVIDER` to one of:

```text
openai
deepseek
anthropic
moonshot
custom-openai-compatible
```

Recommended examples:

```bash
# OpenAI
AI_PROVIDER=openai
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-5-mini

# DeepSeek
AI_PROVIDER=deepseek
AI_API_KEY=your-deepseek-api-key
AI_MODEL=deepseek-v4-flash

# Claude / Anthropic
AI_PROVIDER=anthropic
AI_API_KEY=your-anthropic-api-key
AI_MODEL=claude-sonnet-4-6

# Kimi / Moonshot
AI_PROVIDER=moonshot
AI_API_KEY=your-moonshot-api-key
AI_MODEL=kimi-k2.6

# Any OpenAI-compatible local or hosted server
AI_PROVIDER=custom-openai-compatible
AI_API_KEY=your-api-key
AI_MODEL=your-model
AI_BASE_URL=http://127.0.0.1:1234/v1
```

Provider-specific variables also work, such as `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, and `MOONSHOT_API_KEY`. If no key is configured, the app keeps running with the demo AI bridge.

Provider defaults:

| Provider | Protocol | Default base URL | Default model | API key env |
| --- | --- | --- | --- | --- |
| `openai` | Responses API with JSON schema | `https://api.openai.com/v1` | `gpt-5-mini` | `AI_API_KEY` or `OPENAI_API_KEY` |
| `deepseek` | OpenAI-compatible Chat Completions with JSON mode | `https://api.deepseek.com` | `deepseek-v4-flash` | `AI_API_KEY` or `DEEPSEEK_API_KEY` |
| `anthropic` | Claude Messages API with `output_config.format` | `https://api.anthropic.com` | `claude-sonnet-4-6` | `AI_API_KEY` or `ANTHROPIC_API_KEY` |
| `moonshot` | OpenAI-compatible Chat Completions with JSON mode | `https://api.moonshot.ai/v1` | `kimi-k2.6` | `AI_API_KEY` or `MOONSHOT_API_KEY` |
| `custom-openai-compatible` | OpenAI-compatible Chat Completions | `http://127.0.0.1:1234/v1` | `custom-model` | `AI_API_KEY` |

For custom OpenAI-compatible servers, set `AI_BASE_URL` to the server's `/v1` base URL. Auto-inbox appends `/chat/completions` unless the value already ends with that path. `AI_JSON_MODE=true` sends `response_format: {"type":"json_object"}`; it defaults to `true` for DeepSeek and Kimi/Moonshot, and `false` for custom servers because local gateways vary.

Reference docs:

- OpenAI models and Responses API: https://platform.openai.com/docs/models
- DeepSeek quick start and JSON output: https://api-docs.deepseek.com/
- Claude Messages API and structured outputs: https://platform.claude.com/docs/en/api/overview
- Kimi/Moonshot API overview and JSON mode: https://platform.kimi.ai/docs/api/overview

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

The inbox sync logic is separated from the React UI under `src/automation`. The current engine owns Gmail sync execution, heartbeat scheduling helpers, local heartbeat persistence, duplicate detection through a bounded `seenMessageIds` cache, and returns newly loaded Gmail messages so the UI can classify and draft replies.

## Operating Model

Auto-inbox is now opinionated about the workflow it supports:

- Best-fit users are ecommerce teams, SaaS support teams, and agencies running shared inboxes.
- Every email receives a safety decision, a suggested owner, priority, SLA, follow-up state, and next action.
- Operators can tune safety behavior without code by enabling/disabling risk groups and adding custom escalation terms.
- Agents can apply reusable templates before or after AI generation, which keeps repeated replies consistent.
- Managers can estimate cost per draft and net monthly value before committing to daily usage.
- High-risk legal, billing, account, refund, and chargeback cases are routed to verification or escalation instead of normal drafting.
- Newsletters, automated mail, and no-reply messages are explicitly marked as do-not-draft.
- Weekly reporting turns the inbox run into a client/manager summary and surfaces FAQ gaps to improve Sheets.
- The strategy panel keeps product scope visible: Gmail first, Outlook/IMAP later, hosted SaaS only after the local workflow proves trust.

## Product Roadmap

- Settings UI for Gmail OAuth client configuration.
- Google Picker support for choosing a spreadsheet without pasting an ID.
- Configurable safety-rule editor for newsletters, billing, legal, and sensitive support cases.
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
