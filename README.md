# Whiteboard App

A real-time collaborative whiteboard application built with Node.js, Socket.IO, and PostgreSQL.

## Prerequisites

- Node.js (v16 or higher) 
- PostgreSQL 17
- npm or yarn

## Project Structure
```
whiteboard-app/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/
│   ├── models/
│   ├── index.js
│   └── package.json
└── README.md
```

## Setup
1. Server Setup
```bash
cd server
npm install
# Configure environment variables in .env:
# DATABASE_URL=postgres://username:password@localhost:5432/whiteboard_db
# CLIENT_URL="http://localhost:5173"
npm start
```

2. Client Setup
```bash
cd client
yarn
# Configure environment variables in .env:
# VITE_SERVER_URL="http://localhost:3000"
yarn dev
```

## Features
- Real-time collaborative drawing
- Multiple drawing tools (freehand, line, rectangle)
- Color picker and line width adjustment
- Room-based collaboration
- Persistent storage of drawings

## Technical Details
- Socket.IO handles real-time communication
- PostgreSQL stores whiteboard and drawing data
- Canvas API for drawing functionality
- Sequelize ORM for database interactions

## Database Schema
```sql
CREATE TABLE "Whiteboards" (
  id SERIAL PRIMARY KEY,
  roomId VARCHAR(255) UNIQUE NOT NULL,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

CREATE TABLE "DrawingData" (
  id SERIAL PRIMARY KEY,
  whiteboardId INTEGER REFERENCES "Whiteboards"(id),
  type VARCHAR(50) NOT NULL,
  x0 FLOAT,
  y0 FLOAT,
  x1 FLOAT,
  y1 FLOAT,
  color VARCHAR(50),
  width FLOAT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Assumptions
- Single PostgreSQL instance running locally
- No authentication required (open access)
- Modern browser support for Canvas API
- Single server deployment
- Limited concurrent users per room
- Drawing data size within reasonable limits
- Stable network connection for real-time features
- No required data backup/recovery mechanisms
- Client devices have sufficient processing power for canvas operations

## Known Limitations
- No user authentication
- No drawing export functionality
- No undo/redo capabilities
- No offline support
- Drawing performance may degrade with large number of elements
