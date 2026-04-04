# Genesis GV70 Remote Control

Control your Genesis GV70 remotely via iOS Shortcut, API call, or Google Home voice command — no app needed.

## Problem

The Genesis app works fine, but it's slow: unlock phone, find app, wait for it to load, navigate to remote start. I wanted a **one-tap** solution from my iPhone Home Screen and eventually voice control through Google Home.

## Solution

A lightweight Next.js API deployed on Vercel that authenticates with Genesis Connected Services and executes vehicle commands. Supports multiple trigger methods:

- **iOS Shortcut** — one tap from Home Screen
- **REST API** — `POST /api/command` with API key auth
- **Google Home** — voice commands via IFTTT webhook
- **SMS fallback** — text commands to Gmail (requires worker process)

## Sample Output

```
POST /api/command
{"command": "start", "pin": "1249"}

→ {"success": true, "message": "GV70 remote start initiated"}
```

## Supported Commands

| Command  | What it does                              |
|----------|-------------------------------------------|
| `start`  | Remote start, 72°F, HVAC on (10 min)      |
| `start-winter` | 80°F, heated seats, defrost on       |
| `start-summer` | 65°F, ventilated/cooled seats        |
| `start-preset` | Uses Genesis app's saved climate settings |
| `stop`   | Turn off engine                           |
| `lock`   | Lock all doors                            |
| `unlock` | Unlock all doors                          |
| `status` | Get engine and lock status                |

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  iOS Shortcut    │────>│              │     │  Genesis Connected   │
│  Google Home     │────>│  Vercel API  │────>│  Services API        │
│  SMS / Email     │────>│  (Next.js)   │     │  (Hyundai Telematics)│
└─────────────────┘     └──────────────┘     └─────────────────────┘
                              │
                              v
                        PIN + API Key
                        validation
```

## Design Decisions

- **Vercel + Next.js** — zero-cost serverless hosting, deploys on push
- **bluelinky** — community-maintained npm package that interfaces with Hyundai/Genesis Connected Services API (Genesis US vehicles use the Hyundai telematics endpoint)
- **Stateless** — no database needed; commands are fire-and-forget with console logging on Vercel
- **API key + PIN** — two-layer auth: API key in header + vehicle PIN in request body
- **iOS Shortcuts** — native Apple integration, no third-party app needed

## Cost

$0/month — Vercel free tier, IFTTT free tier (up to 3 applets), Genesis Connected Services included with vehicle.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/AnthonyShalagin/genesis-remote.git
cd genesis-remote
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Genesis Connected Services credentials, Gmail app password, and generate an API key:

```bash
openssl rand -hex 32
```

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Add environment variables via the Vercel API or dashboard (avoid CLI piping which can add newlines):

- `GENESIS_USERNAME` — your Genesis account email
- `GENESIS_PASSWORD` — your Genesis account password
- `GENESIS_PIN` — your vehicle PIN
- `COMMAND_PIN` — PIN required in every API request
- `API_KEY` — random 64-char hex string for auth
- `GMAIL_ADDRESS` — for SMS confirmation replies
- `GMAIL_APP_PASSWORD` — Gmail app password
- `SMS_GATEWAY` — carrier SMS gateway (e.g. `@msg.fi.google.com`)

### 4. iOS Shortcut setup

1. Open **Shortcuts** app on iPhone
2. Create new shortcut with **"Get Contents of URL"** action
3. Set URL to `https://your-app.vercel.app/api/command`
4. Method: POST, add `x-api-key` header, JSON body with `command` and `pin`
5. Add to Home Screen

### 5. Google Home setup (via IFTTT)

1. Create an [IFTTT](https://ifttt.com) account and connect your Google account
2. Create a new applet for each command you want:
   - **If This**: Google Assistant → "Activate scene" (e.g. scene name: `winter car`)
   - **Then That**: Webhooks → "Make a web request"
     - URL: `https://your-app.vercel.app/api/command`
     - Method: POST
     - Content-Type: `application/json`
     - Additional Headers: `x-api-key: YOUR_API_KEY`
     - Body: `{"command":"start-winter","pin":"YOUR_PIN"}`
3. Repeat for other commands (e.g. `summer car` → `start-summer`, `lock car` → `lock`)

Now say **"Hey Google, activate winter car"** and your GV70 starts with heated seats and defrost.

> **Note:** IFTTT free tier allows up to 3 applets. For more, a paid plan is required.

### 6. SMS worker (optional)

The SMS worker monitors a Gmail inbox for text commands (format: `COMMAND PIN`) and executes them:

```bash
npm run worker
```

This requires `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, `SMS_GATEWAY`, and `ALLOWED_SENDER` environment variables. The worker polls for unread messages every 30 seconds.

## License

MIT
