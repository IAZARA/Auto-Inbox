# Auto-inbox

![Auto-inbox dashboard preview](docs/images/auto-inbox-banner.png)

Auto-inbox is an open-source AI inbox assistant for teams that want faster customer replies without giving up human review. It reads like a premium support dashboard: incoming emails, intent detection, FAQ context, a generated reply, activity logs, and a clear manual `Enviar` action before anything is sent.

[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e?style=flat-square)](LICENSE)

## Overview

Auto-inbox turns the workflow of an AI email responder into a product-ready interface. The current version is a polished frontend prototype built for portfolio and open-source iteration. It uses realistic demo data so anyone can explore the experience without connecting Gmail, Google Sheets, or OpenAI credentials.

The product direction is intentionally human-in-the-loop: AI prepares the response, but the user reviews and sends it manually.

## Highlights

- Premium 4-column inbox dashboard inspired by modern email and support tools.
- Dark sidebar with mailbox, automation, integration, and mode controls.
- Searchable inbox list with unread states and selected-message focus.
- Email detail view with customer metadata, intent, confidence, FAQ matches, and history.
- AI suggested reply composer with formatting controls, regenerate action, and manual `Enviar` button.
- Automation status panel and activity log for observability.
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

## Build

```bash
npm run build
```

## Product Roadmap

- Gmail OAuth connection and inbox sync.
- Google Sheets FAQ source and enquiry log.
- OpenAI-powered classification and reply generation.
- Gmail draft creation before sending.
- Safety rules for newsletters, billing, legal, and sensitive support cases.
- Local encrypted settings storage.
- Desktop packaging with Tauri or Electron.
- Optional hosted SaaS mode for always-on automation.

## Project Structure

```text
Auto-Inbox/
  docs/images/             README and GitHub assets
  src/main.tsx             Main React application
  src/styles.css           Premium dashboard styling
  index.html               Vite entry
  package.json             Scripts and dependencies
```

## Philosophy

Auto-inbox is not trying to hide automation behind a black box. It is designed around review, clarity, and trust: show the reasoning context, show the generated reply, and keep the final send action in the user's hands.

## License

MIT
