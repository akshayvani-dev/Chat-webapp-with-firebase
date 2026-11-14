# Chat App (Monorepo)

A 1:1 chat application with a Node.js and TypeScript backend and a React frontend. Users and chats live in PostgreSQL, while messages, read receipts and last seen tracking live in Firebase Firestore. Authentication uses JWT access and refresh tokens stored in HTTP-only cookies.

## Table of contents

1. [Tech stack](#tech-stack)
2. [Architecture](#architecture)
3. [Project structure](#project-structure)
4. [Database design (PostgreSQL)](#database-design-postgresql)
5. [Firebase Firestore design](#firebase-firestore-design)
6. [Authentication flow](#authentication-flow)
7. [API reference](#api-reference)
8. [Getting started](#getting-started)
9. [Environment variables](#environment-variables)
10. [Available scripts](#available-scripts)
11. [Frontend overview](#frontend-overview)
12. [Troubleshooting](#troubleshooting)

---

## Tech stack

**Backend**

| Area | Technology |
| --- | --- |
| Runtime | Node.js, TypeScript (strict mode), ESM |
| Framework | Express 5 |
| Relational database | PostgreSQL |
| ORM | Prisma 7 (with the `pg` driver adapter) |
| Document database | Firebase Firestore (via `firebase-admin`) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, `cookie-parser` |
| Security and logging | Helmet, CORS, Morgan |
| Dev tooling | tsx (watch mode), TypeScript compiler |

**Frontend**

| Area | Technology |
| --- | --- |
| Framework | React with Vite and TypeScript |
| Styling | Tailwind CSS, Manrope font |
| HTTP client | Axios (cookies enabled, refresh interceptor) |
| Forms | React Hook Form with Zod |
| State | Redux Toolkit |
| Routing | React Router |
| UI primitives | Radix UI (confirmation dialogs) |

---

## Architecture

```
                        +----------------------------+
                        |     React frontend (Vite)   |
                        |  Redux, Axios, React Router |
                        +--------------+-------------+
                                       |
                    HTTPS + HTTP-only cookies (JWT)
                                       |
                        +--------------v-------------+
                        |      Express API server     |
                        |  routes > controllers >     |
                        |  services > data access     |
                        +------+---------------+-----+
                               |               |
                  Prisma ORM   |               |  firebase-admin SDK
                               |               |
                +--------------v---+     +-----v------------------+
                |    PostgreSQL     |     |   Firebase Firestore    |
                |                   |     |                        |
                | users             |     | messages               |
                | refresh_tokens    |     | read receipts          |
                | conversations     |     | last seen per user     |
                +-------------------+     +------------------------+
```

**Why two databases**

- PostgreSQL stores data that is relational and needs integrity: users, credentials, refresh tokens and the list of chats with their members.
- Firestore stores data that is written often and read in order: messages, read receipts and last seen markers. It scales well for append-heavy data and supports real-time listeners later.

**Backend layering**

- `routes`: map URLs to controllers and attach middleware.
- `controllers`: thin layer that reads the request and sends the response.
- `services`: all business logic, talking to Prisma and Firestore.
- `validators`: Zod schemas for request bodies, params and queries.
- `middlewares`: authentication, validation, 404 and the central error handler.
- `utils`: helpers such as `AppError`, JWT and cookie utilities.

---

## Project structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/              # committed to git
│   ├── prisma.config.ts             # Prisma 7 config, holds the database URL
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts               # Zod-validated environment variables
│   │   │   ├── prisma.ts            # PrismaClient singleton
│   │   │   └── firebase.ts          # Firebase Admin initialisation
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── validators/
│   │   ├── middlewares/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── generated/prisma/        # generated Prisma client (not committed)
│   │   ├── app.ts                   # Express app, no listen()
│   │   └── server.ts                # DB connect, listen, graceful shutdown
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── apis/                    # axios instance and API functions
    │   ├── components/
    │   ├── pages/
    │   ├── schemas/                 # Zod form schemas
    │   ├── store/                   # Redux store and auth slice
    │   ├── types/
    │   ├── utils/
    │   ├── App.tsx
    │   └── main.tsx
    ├── .env.example
    └── package.json
```

---

## Database design (PostgreSQL)

### Tables

**users**

| Column | Type | Notes |
| --- | --- | --- |
| id | text (UUID string) | Primary key |
| name | text | |
| email | text | Unique, stored lowercase |
| password | text | bcrypt hash only |
| createdAt, updatedAt | timestamp | |

**refresh_tokens**

| Column | Type | Notes |
| --- | --- | --- |
| id | text (UUID string) | Primary key |
| userId | text | Foreign key to users, cascade delete, indexed |
| tokenHash | text | Unique, SHA-256 hash of the refresh token |
| expiresAt | timestamp | |
| revokedAt | timestamp, nullable | Set when rotated or logged out |
| createdAt | timestamp | |

**conversations**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| participants | uuid[] | Exactly two user IDs |
| last_message_id | uuid, nullable | |
| last_message | text, nullable | Preview text for the chat list |
| last_message_sender_id | uuid, nullable | |
| last_message_at | timestamptz, nullable | |
| created_at, updated_at | timestamptz | |

### How 1:1 chats stay unique

A conversation between two users must exist only once, regardless of who starts it. This is enforced in the database:

- The two IDs are always stored **sorted ascending** (lowercase), so A-B and B-A produce the same array.
- `CHECK (cardinality(participants) = 2 AND participants[1] < participants[2])` guarantees two different users in sorted order.
- `UNIQUE (participants)` prevents duplicate chats.
- A GIN index on `participants` makes "list chats for a user" queries fast.

The create-chat service sorts the IDs, checks that both users exist, and handles a unique violation (Prisma error `P2002`) by returning the existing chat.

### Migrations

Migrations live in `backend/prisma/migrations` and are committed to git. Prisma ignores the `CHECK` constraint and may not represent the array `UNIQUE` constraint in `schema.prisma`, so the migration SQL is the source of truth. Do not accept an auto-generated migration that drops these constraints.

---

## Firebase Firestore design

Firestore holds the data that changes most often. The backend reaches it only through the Firebase Admin SDK using a service account, so no Firestore security rules are needed for client access.

```
conversations (collection)
└── {chatId} (document)               same ID as the PostgreSQL conversation
    ├── messages (subcollection)
    │   └── {messageId} (document)
    │       ├── senderId: string
    │       ├── text: string
    │       ├── createdAt: timestamp   server timestamp, used for ordering
    │       └── readBy: map            { [userId]: timestamp }
    └── members (subcollection)
        └── {userId} (document)
            ├── lastSeenMessageId: string
            └── lastSeenAt: timestamp
```

| Feature | How it works |
| --- | --- |
| Send message | Adds a document to `messages` with a server timestamp, then updates the preview fields on the `conversations` row in PostgreSQL. |
| Get messages | Queries `messages` ordered by `createdAt` with a `limit` (default 50). |
| Mark read | Sets `readBy.{userId}` on the message document. |
| Last seen | Writes `lastSeenMessageId` and `lastSeenAt` on the user's `members` document. |

Before reading or writing, the backend verifies in PostgreSQL that the caller is a participant of the chat.

---

## Authentication flow

Tokens are never returned in the response body and never stored by the frontend. They live only in HTTP-only cookies.

| Token | Lifetime | Cookie name | Purpose |
| --- | --- | --- | --- |
| Access token | 15 minutes | `accessToken` | Authorises API requests |
| Refresh token | 7 days | `refreshToken` | Gets a new token pair when the access token expires |

1. **Sign up or sign in**: the server validates the input, issues both tokens and sets them as cookies. The response contains the user object only.
2. **Protected request**: the `authenticate` middleware reads the access token from the cookie (or an `Authorization: Bearer` header for tools like Postman).
3. **Access token expires**: the API returns `401`. The Axios interceptor calls `POST /auth/refresh` once (even when several requests fail together) and replays the failed requests.
4. **Refresh with rotation**: the server checks the refresh token's hash in the database, revokes it and issues a brand new pair.
5. **Reuse detection**: if a revoked refresh token is used again, every refresh token of that user is revoked and the request gets `401`.
6. **Logout**: the refresh token is revoked and both cookies are cleared.

Security measures: bcrypt password hashing, refresh tokens stored only as SHA-256 hashes, HTTP-only and `sameSite=lax` cookies, `secure` cookies in production, Helmet headers, CORS limited to one origin with credentials, and Zod validation on all input.

On page load the frontend calls `GET /auth/me` only if a small `isLoggedIn` hint flag exists in `localStorage`. The flag is just a hint to avoid useless calls. The server response always decides the real session state.

---

## API reference

Base URL: `http://localhost:3000`

**Health**

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Server health check |

**Auth**

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/signup` | No | Create an account. Body: `name`, `email`, `password` (min 8). |
| POST | `/auth/signin` | No | Sign in. Body: `email`, `password`. |
| POST | `/auth/refresh` | Refresh cookie | Rotate tokens. |
| POST | `/auth/logout` | Refresh cookie | Revoke the refresh token and clear cookies. Returns `204`. |
| GET | `/auth/me` | Yes | Returns the current user. |

**Chat**

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/chat/create` | Create or get a 1:1 chat. Body: `userAId`, `userBId`. Returns `chatId`. |
| POST | `/chat/:chatId/message/send` | Send a message. Body: `senderId`, `text`. Stored in Firestore with a timestamp. |
| GET | `/chat/:chatId/messages?limit=50` | List messages ordered by timestamp. |
| POST | `/chat/:chatId/message/:messageId/read` | Mark a message as read. Body: `userId`. |
| POST | `/chat/:chatId/lastseen` | Update the last seen message. Body: `userId`, `messageId`. |
| GET | `/user/:userId/chats` | List a user's chats with member IDs from PostgreSQL. |

Errors are returned as JSON with a `message` and the matching HTTP status (`400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict).

---

## Getting started

### Prerequisites

- Node.js 20.19 or later
- PostgreSQL running locally
- A Firebase project with Firestore enabled
- npm

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Set up Firebase

1. Open the [Firebase console](https://console.firebase.google.com) and create a project.
2. Go to **Build > Firestore Database** and create a database in **production mode** (the backend uses the Admin SDK, so client rules are not needed).
3. Go to **Project settings > Service accounts** and click **Generate new private key**. A JSON file is downloaded.
4. From that file, copy `project_id`, `client_email` and `private_key` into the backend `.env` (see below).
5. Never commit the JSON file. It is listed in `.gitignore`.

### 3. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your own values (see [Environment variables](#environment-variables)). Then create the database, tables and Prisma client:

```bash
npx prisma migrate dev
npx prisma generate
```

`migrate dev` creates the database if it does not exist and applies every migration in `prisma/migrations`, which creates all the tables. Start the server:

```bash
npm run dev
```

Verify it at `http://localhost:3000/health`. The console shows "Database connected successfully" when PostgreSQL is reachable.

### 4. Set up the frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Make sure the backend `CORS_ORIGIN` is exactly this URL.

### Production build and deploy

```bash
cd backend
npm run build
npx prisma migrate deploy
npm start
```

Use `migrate deploy` (not `migrate dev`) in production. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, serve everything over HTTPS and set `CORS_ORIGIN` to your real frontend URL.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | `development`, `production` or `test` | `development` |
| `PORT` | API port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/chat_app` |
| `CORS_ORIGIN` | Exact frontend origin, no wildcard | `http://localhost:5173` |
| `JWT_ACCESS_SECRET` | Access token secret, min 32 characters | long random string |
| `JWT_REFRESH_SECRET` | Refresh token secret, different from the access secret | long random string |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `COOKIE_SECURE` | `true` in production (HTTPS) | `false` |
| `FIREBASE_PROJECT_ID` | From the service account file | `my-project-id` |
| `FIREBASE_CLIENT_EMAIL` | From the service account file | `firebase-adminsdk-xxx@my-project-id.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | From the service account file, wrapped in quotes with `\n` for line breaks | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend (`frontend/.env`)

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend base URL | `http://localhost:3000` |

---

## Available scripts

**Backend**

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server with tsx in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type check without emitting files |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create and apply a migration in development |
| `npm run prisma:studio` | Open Prisma Studio to browse the data |

**Frontend**

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Type check |

---

## Frontend overview

- **Pages**: sign up, sign in and a dashboard.
- **Forms**: React Hook Form with Zod, validating on every change and showing server errors.
- **State**: Redux Toolkit stores only the logged-in user, never tokens.
- **Route protection**: protected routes redirect unauthenticated users to sign in, and public routes redirect signed-in users to the dashboard.
- **Axios**: one shared instance with credentials enabled and a response interceptor that refreshes the session once and replays failed requests.
- **Dashboard**: a users list with last message and unread count on the left, a chat panel on the right, and a 300-word limit on messages.
- **Dialogs**: logout and other confirmations use a reusable Radix UI alert dialog.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot find module .../generated/prisma/client` | Run `npx prisma generate`. |
| Database connection error on start | Check that PostgreSQL is running and `DATABASE_URL` has the right user, password, port and database name. |
| Tables are missing | Run `npx prisma migrate dev`. Make sure the `prisma/migrations` folder exists. |
| Cookies are not saved in the browser | `CORS_ORIGIN` must exactly match the frontend URL, and Axios must use `withCredentials: true`. |
| Cookies not set in production | Use HTTPS and set `COOKIE_SECURE=true`. |
| Firebase error about the private key | Keep the key in quotes and keep the `\n` sequences in `.env`. |
| `401` on every request after some time | The access token expired and the refresh failed. Sign in again. |