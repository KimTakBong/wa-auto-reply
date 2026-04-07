# WA Auto-Reply Bot

A WhatsApp Auto-Reply Bot built with **Baileys** and **Node.js**, featuring AI-powered responses via **Groq**, and a web dashboard for management.

## Features

- 🤖 **Auto-Reply** — Automatically responds to incoming WhatsApp messages
- 🧠 **AI-Powered** — Uses Groq AI for intelligent responses with conversation history
- 🌐 **Web Dashboard** — Manage and monitor the bot via a web interface
- 💾 **MySQL Database** — Persistent storage for messages, rules, and settings
- 📱 **QR Code Authentication** — Scan QR code to connect your WhatsApp account
- ⚡ **Rate Limiting** — Built-in rate limiting per user to prevent abuse
- 📋 **Logging** — Configurable logging levels (error, warn, info, debug)
- 🔔 **Admin Notifications** — Error notifications sent to admin's WhatsApp number

## Tech Stack

| Component     | Technology           |
|---------------|----------------------|
| Runtime       | Node.js (ES Modules) |
| WhatsApp API  | Baileys              |
| Web Framework | Express.js           |
| Database      | MySQL                |
| AI Provider   | Groq SDK             |
| Auth          | bcryptjs             |
| Session       | express-session      |
| Logger        | Pino                 |

## Prerequisites

- **Node.js** >= 18.0.0
- **MySQL** server
- **WhatsApp** account for bot authentication

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd wa_auto_reply
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Copy and edit the `.env` file:
   ```bash
   cp .env.example .env  # if .env.example exists, or edit .env directly
   ```

   Update the following in `.env`:
   ```env
   # Database
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=root
   DB_NAME=wa-auto-reply

   # WhatsApp Bot
   BOT_NAME=WA-AutoReply-Bot
   ADMIN_NUMBER=6282121046474

   # Baileys Session
   AUTH_DIR=./auth_store

   # Logging
   LOG_LEVEL=info

   # Dashboard
   DASHBOARD_PORT=1111
   SESSION_SECRET=ganti-dengan-random-string-yang-panjang
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

## Usage

### Development (with auto-restart)
```bash
npm run dev
```

### Production
```bash
npm start
```

### First Time Setup
1. Run `npm start` or `npm run dev`
2. A QR code will be displayed in the terminal
3. Scan the QR code with your WhatsApp (Linked Devices)
4. Session will be saved to `AUTH_DIR` folder for future use

## Available Scripts

| Command           | Description                          |
|-------------------|--------------------------------------|
| `npm start`       | Start the bot (production)           |
| `npm run dev`     | Start with auto-restart on changes   |
| `npm run migrate` | Run database migrations              |

## Project Structure

```
wa_auto_reply/
├── auth_store/          # Baileys session storage
├── public/              # Static files (dashboard assets)
├── src/
│   ├── controllers/     # Request handlers
│   ├── core/            # Core WhatsApp connection & database logic
│   ├── handlers/        # Message event handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API & web routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   ├── index.js         # Entry point
│   └── server.js        # Express server setup
├── .env                 # Environment variables
├── package.json
└── README.md
```

## Environment Variables

| Variable                  | Description                                      | Default                    |
|---------------------------|--------------------------------------------------|----------------------------|
| `DB_HOST`                 | MySQL host                                       | `127.0.0.1`                |
| `DB_PORT`                 | MySQL port                                       | `3306`                     |
| `DB_USER`                 | MySQL username                                   | `root`                     |
| `DB_PASSWORD`             | MySQL password                                   | `root`                     |
| `DB_NAME`                 | Database name                                    | `wa-auto-reply`            |
| `BOT_NAME`                | Bot identifier name                              | `WA-AutoReply-Bot`         |
| `ADMIN_NUMBER`            | Admin phone (international format, no `+`)       | `6282121046474`            |
| `AUTH_DIR`                | Directory for Baileys auth session               | `./auth_store`             |
| `LOG_LEVEL`               | Logging level (error/warn/info/debug)            | `info`                     |
| `NODE_ENV`                | Node environment                                 | `development`              |
| `DASHBOARD_PORT`          | Web dashboard port                               | `1111`                     |
| `SESSION_SECRET`          | Express session secret                           | *(change this!)*           |
| `AI_MAX_HISTORY`          | Max conversation history per user                | `20`                       |
| `AI_RATE_LIMIT_SECONDS`   | Min seconds between messages per user            | `5`                        |
| `AI_FALLBACK_REPLY`       | Fallback message when AI errors/rate limited     | `Maaf, saya sedang sibuk...` |

## Accessing the Dashboard

Once the bot is running, open your browser and navigate to:
```
http://localhost:1111
```

## Notes

- The bot uses **Baileys** which connects via WhatsApp Web protocol
- Keep your `AUTH_DIR` folder secure — it contains your session credentials
- Set `ADMIN_NUMBER` to receive error notifications
- Adjust `AI_RATE_LIMIT_SECONDS` to control response frequency

## License

ISC
