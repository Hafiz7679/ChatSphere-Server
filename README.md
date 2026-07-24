# ChatSphere Server

Backend API for the ChatSphere real-time messaging platform.

See the [root README](../README.md) for full project documentation.

## Quick Start

```bash
cd server
cp .env.example .env   # edit with your values
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `node scripts/generate-secrets.js` | Generate JWT secrets |
| `node scripts/create-admin.js` | Create admin user |
| `node scripts/backup-db.js` | Backup MongoDB |

## API Base

`http://localhost:5000/api`

## Socket.IO Events

### Client → Server

`register_user`, `send_message`, `typing`, `stop_typing`, `mark_as_read`,
`call_user`, `accept_call`, `reject_call`, `end_call`, `ice_candidate`,
`offer`, `answer`, `toggle_mic`, `toggle_camera`, `screen_share`,
`message_reacted`, `delete_message`, `edit_message`

### Server → Client

`receive_message`, `online_users`, `typing`, `stop_typing`, `messages_read`,
`message_reacted`, `delete_message`, `edit_message`, `message_status_updated`,
`incoming_call`, `call_accepted`, `call_rejected`, `call_ended`, `call_failed`,
`offer`, `answer`, `ice_candidate`, `mic_toggled`, `camera_toggled`,
`screen_share_status`

## Environment

All variables documented in `.env.example`. Required: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
