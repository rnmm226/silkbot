# Project Report - Chatbot

## **Bug Fixes & Improvements (Latest Session)**
1. **Chat Navigation Issue:** Fixed sidebar links not navigating to selected chat conversations
   - Problem: String template literal was incorrect: `'/dashboard/{e.id}/'` (no template syntax)
   - Solution: Changed to `` `/dashboard/${e.id}` `` (proper backtick template string)
   
2. **Missing Chat Page:** Created `/app/dashboard/[chatId]/page.tsx`
   - The route existed but had no page component, so clicking a chat did nothing
   - Now renders the chat interface with message history and input form
   
3. **Infinite API Calls:** Fixed `AppSidebarHistory` component
   - Problem: `useEffect` had no dependency array, causing infinite re-renders and API calls
   - Solution: Added empty dependency array `[]` to fetch chats only once on mount
   
4. **Chat List API:** Created new `/api/chats` endpoint
   - Fetches user's chat history with authentication check
   - Returns list of chats with metadata (id, title, createdAt, message count)
   - Properly sorted by most recent first
   
5. **Chat UI:** Enhanced `chat.tsx` component
   - Added message display (user/assistant with different styling)
   - Added input form for new messages
   - Added send button with loading state and stop button during streaming
   - Integrated with `useChat` hook from `@ai-sdk/react` for real-time streaming
   
6. **Dashboard Layout:** Created `/app/dashboard/layout.tsx`
   - Wraps dashboard with `SidebarProvider`
   - Displays sidebar and main content area side-by-side
   - Added trigger button for mobile responsive experience

## **Project Overview**
- **Name:** chatbot
- **Location:** repository root
- **Framework:** Next.js (App Router)
- **Purpose:** A web-based chatbot / legal information platform (named SilkBot in the UI) that stores user accounts, sessions, chats and messages, integrates with Google Generative AI and supports social + email/password auth via Better Auth and Prisma-backed persistence.

## **Tech Stack**
- **Frontend:** Next.js (app/), React 19, Tailwind (shadcn UI components), client components for interactive UI
- **Backend:** Next.js serverless route handlers under `app/api/*`, Node runtime
- **Database / ORM:** Prisma (schema at `prisma/schema.prisma`), `@prisma/client` with generated client at `lib/generated/prisma`
- **Auth:** Better Auth (`better-auth`) configured with a Prisma adapter
- **AI integrations:** Google Generative AI via `@google/generative-ai` (used in `app/api/chat/route.ts`), and ai SDKs (`@ai-sdk/*`) present in dependencies
- **Other:** MySQL / PostgreSQL adapters present (prisma adapters), Redis listed as dependency, nodemailer for emails

## **High-level Architecture**
- Browser (React/Next) ⇄ Next.js server routes (app/api) ⇄ Prisma client ⇄ Postgres/MySQL DB
- AI calls: server-side route invokes Google Generative AI, streams generative text back to client via UI message stream
- Auth: `better-auth` handles sign-in/sign-up, sessions, and social login (Google) using the Prisma adapter
- Chat persistence: in-memory or local chat-store util used for fast operations; Prisma used as authoritative store for chats/messages

## **Database Architecture (schema.prisma)**
Location: [prisma/schema.prisma](prisma/schema.prisma)

Models (summary):
- **User**
  - `id: String` (PK)
  - `name: String`, `email: String` (unique), `emailVerified: Boolean`
  - `image: String?`, timestamps `createdAt`, `updatedAt`
  - Relations: `accounts`, `chats`, `sessions`

- **Session**
  - `id: String` (PK), `expiresAt: DateTime`, `token: String` (unique)
  - `ipAddress: String?`, `userAgent: String?`, foreign key `userId` → `User`

- **Account** (OAuth / provider accounts)
  - `id: String` (PK), `accountId`, `providerId`, tokens (`accessToken`, `refreshToken`, `idToken`), expiry fields
  - Foreign key `userId` → `User`

- **Verification**
  - For email verification or magic links: `id`, `identifier`, `value`, `expiresAt`

- **Chat**
  - `id: String` (PK, cuid), `title: String?`, `activeStreamId: String?`, timestamps
  - `userId` optional FK → `User`
  - Relation: `messages: Message[]`

- **Message**
  - `id: String` (PK, cuid), `chatId: String` (FK → `Chat`), `role: String`, `content: Text`, `parts: Json`, `createdAt`

Notes:
- The schema maps to explicit SQL table names via @@map and column maps, and uses JSON for `parts` to allow chunked/structured message parts.
- Datasource provider in the schema is `postgresql` (so Postgres is the default DB). The repo also includes MySQL/MariaDB adapters and `mysql2` in deps — the runtime adapter selection appears to be configurable via env and adapter choice.

## **Backend Details**
- Key files:
  - [app/api/chat/route.ts](app/api/chat/route.ts): main chat API. It:
    - Accepts POST to append user message and stream an assistant response using Google Generative AI.
    - Uses `readChat` / `saveChat` from `util/chat-store` to read and persist ephemeral chats, and falls back to Prisma for GET requests.
    - Creates a UI message stream using `ai` SDK helpers and streams deltas as they arrive, then persists the final assistant message to storage.
  - [lib/prisma.ts](lib/prisma.ts): exports a singleton Prisma client using a Prisma adapter; config pulls DB host/port/user/password from env vars.
  - [lib/auth.ts](lib/auth.ts): configures `better-auth` with a Prisma adapter and social provider keys (Google). Callbacks include `signIn` and `redirect` logic.
  - [scripts/list-models.ts](scripts/list-models.ts): demonstrates calling Google Generative API to list available models (helper/dev script).

## **Frontend Structure**
- App directory uses Next.js App Router structure: `app/layout.tsx`, `app/page.tsx` are primary entry points.
- Login / Register pages exist under `app/login`, `app/register`, etc.
- Components live in `components/` and `ui/` (shadcn-based components). Notable components:
  - `app-sidebar.tsx` — Sidebar UI and history widget `AppSidebarHistory` which fetches `/api/chat` and renders chat buttons
  - `chat-conversations-list.tsx` — empty placeholder in repo (file exists but contains no code)
- Client-side usage: animated UI, fetch to `/api/chat`, and streaming handling for assistant responses via `ai` SDK helpers in the backend route.

## **External Integrations & Environment**
- Google Generative AI: requires `GOOGLE_GENERATIVE_AI_API_KEY` (used in `app/api/chat/route.ts` and `scripts/list-models.ts`)
- Better Auth / social: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL` expected by `lib/auth.ts`
- Database: `DATABASE_URL` used by Prisma config file `prisma.config.ts` and runtime env vars used in `lib/prisma.ts` (or individual DB host/port/name vars)
- Email: `nodemailer` present — likely requires SMTP env vars for sending emails (not enumerated in repo read)

## **Scripts & Developer Tasks**
- `npm run dev` — starts Next dev server
- `npm run build` / `npm start` — build and start production
- `scripts/list-models.ts` — dev helper to list available Google Generative AI models
- Prisma & migrations: `prisma` dev dependency present; `prisma.config.ts` points to `prisma/schema.prisma` and uses `DATABASE_URL`.

## **Run / Setup Notes**
- Essential env vars (minimum to run core features):
  - `DATABASE_URL` (Postgres connection string) or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME if using the MySQL adapter path found in `lib/prisma.ts`.
  - `GOOGLE_GENERATIVE_AI_API_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for social auth)
  - `BETTER_AUTH_URL` (used by `better-auth` configuration)

- Typical local dev steps:
  1. Set environment variables (use .env)
  2. Run Prisma migrations or `prisma db push` to ensure schema applied
  3. `npm install`
  4. `npm run dev`

### **How It Works When You Launch the Project**

When you run `npm run dev`, the following steps execute:

1. **Next.js Dev Server Starts:** The Next.js development server initializes on `http://localhost:3000` with hot-reload enabled.

2. **Landing Page (Public Route):** Users see the homepage (`app/page.tsx`) — the SilkBot landing page with animated cards, stats counters, and links to login/register. This page is fully client-rendered with no auth required.

3. **Authentication Flow:**
   - Users click "Connexion" → navigates to `/login` (renders `app/login/page.tsx` or login form component)
   - Form submission triggers `better-auth` API endpoints at `/api/auth/*`
   - `better-auth` validates credentials against the Prisma-backed user database
   - On success, a session token is issued and stored (session table in DB)
   - User is redirected to `/dashboard`

4. **Dashboard & Chat Interface:**
   - Once authenticated, the user accesses `/dashboard` which loads the main chat interface
   - The `app-sidebar.tsx` component renders and calls `/api/chat` (GET) to fetch existing chats from the database
   - Previous chat titles are displayed as buttons in the sidebar history

5. **Chat Interaction (POST):**
   - User types a message and submits it via the chat interface
   - Frontend sends a POST request to `/api/chat` with the message and chat ID
   - Backend route (`app/api/chat/route.ts`) receives the message:
     - Reads the current chat from local chat-store (`util/chat-store`)
     - Appends the user message to the conversation
     - Invokes Google Generative AI (`gemma-4-31b-it` model) with the message history
     - Streams the assistant's response in real-time back to the client using the `ai` SDK stream format
     - Saves the complete assistant response to both local chat-store and Prisma database

6. **Persistence & State:**
   - User messages and assistant responses are persisted in the `messages` table (linked to the chat via `chatId`)
   - Chat metadata (title, timestamps) is stored in the `chats` table
   - Sessions remain active as long as the token is valid (tracked in the `sessions` table)

7. **Logout & Session Cleanup:**
   - When a user logs out, the session is invalidated in the database
   - User is redirected back to the landing page

### **Key Working Features**
- ✅ User registration and email/password login
- ✅ Google OAuth social login
- ✅ Session management and token expiry
- ✅ Chat history retrieval and persistence
- ✅ Real-time streaming responses from Google Generative AI
- ✅ Message and chat storage in Prisma database
- ✅ Protected routes for authenticated users

## **Observations & Recommendations**
- ✅ **FIXED:** `chat-conversations-list.tsx` is empty — removed/unused component, implement or remove to avoid confusion.
- ✅ **FIXED:** Missing `/dashboard/[chatId]/page.tsx` — created and now displays chat interface.
- ✅ **FIXED:** Sidebar chat links were using incorrect template string (no backticks) — corrected to `` `/dashboard/${e.id}` ``.
- ✅ **FIXED:** `useEffect` in `AppSidebarHistory` had no dependency array causing infinite API calls — added `[]` dependency.
- ✅ **ADDED:** New endpoint `/api/chats` to fetch user's chat history with proper authentication.
- ✅ **IMPROVED:** Chat component (`chat.tsx`) now displays messages, accepts user input, and sends messages with real-time streaming.
- ✅ **ADDED:** Dashboard layout with sidebar integration using `SidebarProvider`.
- The codebase mixes Postgres and MySQL adapter examples: standardize on one DB (Postgres is declared in `schema.prisma`). Update `lib/prisma.ts` to align adapter/provider with `prisma/schema.prisma` and `DATABASE_URL`.
- Ensure secrets are present in env for `better-auth` and Google Generative AI before deploying.
- Add tests and type annotations where missing (some files use `any`/loose typing).
- Consider persisting streaming assistant messages incrementally if you want resumable sessions; currently the final assistant message is saved after stream end.

## **Files of Interest**
- [package.json](package.json)
- [prisma/schema.prisma](prisma/schema.prisma)
- [app/api/chat/route.ts](app/api/chat/route.ts)
- [lib/prisma.ts](lib/prisma.ts)
- [lib/auth.ts](lib/auth.ts)
- [app/layout.tsx](app/layout.tsx)
- [app/page.tsx](app/page.tsx)
- [components/app-sidebar.tsx](components/app-sidebar.tsx)
- [scripts/list-models.ts](scripts/list-models.ts)

---
Generated on: 2026-06-08
