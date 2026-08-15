# Discord Clone

<p align="right">
  Language: <a href="README.md">English</a> · <a href="README.tr.md">Türkçe</a>
</p>

A full-stack, real-time community chat application inspired by Discord. It includes secure email verification, persistent servers and conversations, granular roles, moderation, voice/video communication, community tools, and an Electron desktop client.

> This independent educational project is not affiliated with, endorsed by, or sponsored by Discord Inc. Discord is a trademark of Discord Inc.

## Highlights

- Email-code verification during registration and sign-in, password recovery, email change confirmation, JWT sessions, and bcrypt password hashing
- Real-time server channels, direct messages, group DMs, typing indicators, presence, replies, reactions, pins, search, attachments, GIFs, voice messages, edit history, drafts, and unread state
- Voice channels with microphone/deafen controls, cameras, screen sharing, push-to-talk, input/output settings, speaking indicators, reconnect handling, stage channels, and a soundboard
- Server ownership, ordered roles, granular permissions, channel permission overrides, member nicknames, server profiles, kicks, bans, timeouts, mute/deafen/disconnect controls, and audit logs
- Categories, text/voice/stage/announcement/forum channels, threads, tags, polls, slow mode, NSFW gates, temporary voice channels, and a recoverable channel trash system
- Invite links, member screening, onboarding questions, server discovery, server templates, scheduled events and RSVP support
- AutoMod for spam, blocked words, links, invite links, excessive caps and mentions; user/message reports and block lists
- Webhooks, custom slash commands with persistent bot responses, custom emojis/stickers, announcement following, notification preferences, statistics, exports, and backups
- SQLite persistence with first-run JSON migration and Electron-safe application data storage
- Light, dark, and midnight themes; profile bio/banner/status/presence preferences
- Web client plus Electron packages for Windows, macOS, and Linux

## Technology

- Frontend: React 18, Vite 8, Tailwind CSS, Socket.IO Client, PeerJS
- Backend: Node.js, Express, Socket.IO, PeerJS Server, JWT, bcrypt, Nodemailer
- Storage: SQLite through `better-sqlite3`
- Desktop: Electron

## Requirements

- Node.js 20.19 or newer (Node.js 22 LTS is recommended)
- npm
- An SMTP account for the mandatory email verification flow
- A browser or operating system that grants microphone/camera permissions for voice features

## Development setup

```bash
git clone https://github.com/tahosg2m3/discord-clone.git
cd discord-clone
npm install
```

Copy `backend/.env.example` to `backend/.env` and fill in your own secrets:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
# Optional: 32 bytes / 64 hex. Losing it makes encrypted data unrecoverable.
# DATA_ENCRYPTION_KEY=...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
MAIL_FROM="Discord Clone <your-email@example.com>"
```

For Gmail, use an App Password instead of the normal account password. Never commit `backend/.env`, `runtime.env`, databases, uploads, or generated secrets.

Start the complete development stack:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`, the API/Socket.IO server at `http://localhost:3001`, and the bundled PeerJS signaling server at port `9000` by default.

To run components separately:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:electron
```

## Optional frontend environment

Create `frontend/.env.local` when the services are not running on localhost:

```env
VITE_API_URL=https://example.com/api
VITE_API_ORIGIN=https://example.com
VITE_SOCKET_URL=https://example.com
VITE_PEER_HOST=peer.example.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=true
```

## Build

```bash
# Web production bundle
npm run build:frontend

# Electron installer/package for the current operating system
npm run build:electron

# Both
npm run build
```

Generated Electron artifacts are placed under `release/`.

For a packaged desktop installation, copy the generated `runtime.env.example` in the application's data directory to `runtime.env` and enter the real SMTP credentials. Passwords are irreversibly hashed with Argon2id. SQLite/JSON application state is encrypted with AES-256-GCM; the data key is protected with Windows DPAPI or macOS Keychain. If the key or OS user profile is lost, encrypted data cannot be recovered, so keep a secure backup.

GIF search uses GIPHY. Create a key at the GIPHY Developers portal and add `GIPHY_API_KEY` to `backend/.env` (or packaged `runtime.env`).

## Security

- Dependency manifests are kept free of known npm audit findings at the time of release.
- REST and Socket.IO actions derive the actor from a verified JWT; client-supplied user identities are not trusted.
- Server, channel, messaging, voice, moderation, upload, and management operations enforce membership and permissions on the backend.
- Passwords are hashed with Argon2id; legacy bcrypt hashes are upgraded after a successful login, while legacy plaintext passwords are migrated during the first secure startup.
- SQLite/JSON state is stored in an AES-256-GCM envelope with a random nonce and authentication tag; a wrong key or tampered data fails closed instead of silently resetting state.
- Secrets and local user data are excluded through `.gitignore`.

For an internet-facing deployment, additionally use HTTPS/WSS, a reverse proxy, strict production CORS origins, rate limiting, monitoring, backups, and properly managed secrets. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License and disclaimer

This repository is provided as-is for educational and portfolio use. No warranty or support obligation is provided. Review the repository license and third-party licenses before redistribution or commercial use.
