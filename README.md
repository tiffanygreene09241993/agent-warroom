# AGENT WARROOM

**Command. Compete. Conquer.**

AGENT WARROOM is a futuristic, real-time multiplayer strategy game where rival factions compete for control of a dynamic digital battlefield. Create a private warroom, invite others with a room code, capture sectors, fortify positions, scout the map, and build influence.

## Features

- Create and join multiplayer rooms using six-character codes
- Shared live battlefield and intelligence feed powered by Socket.IO
- Four factions: ATLAS, PHANTOM, NOVA, and ORACLE
- Eight connected sectors with territory control and fortification
- Deploy, fortify, scout, and influence commands
- Host-controlled match launch and turn submission
- Rule-based autonomous faction agents
- Responsive futuristic command-interface design
- Health endpoint at `/health`

## Tech stack

- Node.js 20+
- Express
- Socket.IO
- HTML, CSS, and JavaScript

## Run locally

1. Install Node.js 20 or newer.
2. Clone this repository.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser. Open another browser window or device to test multiplayer.

## Deploy

This project serves its frontend and Socket.IO server from one persistent Node.js process. It is suitable for a Node web-service host such as Render or Railway; do not deploy it as a static-only site.

### Render

1. Push this repository to GitHub.
2. In Render, select **New + → Web Service** and connect this repository.
3. Choose the Node runtime.
4. Set the build command to `npm install`.
5. Set the start command to `npm start`.
6. Deploy. Render will provide the public HTTPS URL.

Optional environment variable: `CLIENT_ORIGIN`. For same-origin hosting, it can remain unset.

## Gameplay and current limitations

- Room state is held in server memory. Restarting the service clears active rooms.
- Rooms expire after six hours.
- A room supports up to 50 connected participants, including observers.
- Autonomous factions use a built-in rule-based strategy policy; they are not LLM-backed agents.
- This is an early playable multiplayer foundation, not a hardened ranked-competition service. It does not yet include user accounts, persistent match history, database storage, moderation tools, reconnect identity tokens, or payment systems.

Before hosting a large public event, add persistent storage (such as Redis or PostgreSQL), rate limiting, moderation/reporting, reconnect handling, monitoring, and load testing.

## Showcase

Built for the **Handshake AI Showcase**.
