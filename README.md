# AI Resume Helper

A full-stack MERN application that provides conversational AI career help across three modes: Resume Improvement, Job Matching, and Interview Prep. Users must register/log in (JWT-based auth) before chatting. Each conversation thread is stored privately in MongoDB, separated by user and mode. Runs on a free, local LLM via **Ollama** — no paid API key required.

## Features

- **Authentication** — Register and log in with email + password (passwords hashed with bcrypt, sessions handled via JWT).
- **Resume Improvement Chat** — Paste resume content and get conversational, back-and-forth feedback on phrasing, metrics, and keywords.
- **Job Matching Chat** — Paste a job description and discuss how well your background matches it, including gaps.
- **Interview Prep Chat** — Practice mock interview Q&A, one question at a time, with feedback after each answer.
- **Multi-turn Conversations** — Each mode keeps its own separate conversation threads with full message history, stored in MongoDB.
- **Per-user, Per-mode History** — A sidebar lists your past threads for the active mode; click one to resume it.
- **Free & Local AI** — Powered by [Ollama](https://ollama.com) running a local LLM (default: `llama3.2`). No OpenAI key, no usage costs.
- **HTTP-only** — No WebSockets; simple REST calls with axios.

## Tech Stack

| Layer    | Technology                                  |
|----------|----------------------------------------------|
| Frontend | React.js, Vite, Tailwind CSS, Axios          |
| Backend  | Node.js, Express.js                          |
| Database | MongoDB Atlas + Mongoose                     |
| AI       | Ollama (local LLM, default `llama3.2`)      |
| Auth     | JWT (`jsonwebtoken`) + `bcryptjs`             |

## Project Structure

```
resume-helper/
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Chat.jsx
│   │   ├── api.js            # axios instance + token interceptor
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── package.json
│
├── backend/                  # Node + Express + MongoDB
│   ├── models/
│   │   ├── User.js
│   │   └── Chat.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── analyze.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── analyzeController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

## Getting Started Locally

### Prerequisites
- Node.js 18+ (uses native `fetch`, no extra HTTP library needed for Ollama calls)
- A MongoDB Atlas connection string (or local MongoDB instance)
- [Ollama](https://ollama.com) installed locally, with a model pulled:
  ```bash
  ollama pull llama3.2
  ollama serve     # starts the local server on http://localhost:11434
  ```

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your real values:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_secret_string
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Run the backend:

```bash
npm run dev      # uses nodemon, auto-restarts on changes
# or
npm start
```

The API will be available at `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` if needed (defaults to local backend):

```
VITE_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Try It Out
1. Make sure `ollama serve` is running in a terminal (leave it running).
2. Open `http://localhost:5173`.
3. Register a new account.
4. Pick a mode tab — **Resume Improvement**, **Job Matching**, or **Interview Prep** — and start chatting.
5. Use "+ New Conversation" to start a fresh thread, or click a past thread in the sidebar to resume it.

## API Reference

### Auth

| Method | Endpoint             | Body                              | Description                  |
|--------|-----------------------|------------------------------------|-------------------------------|
| POST   | `/api/auth/register`  | `{ email, password }`              | Creates a user, returns JWT  |
| POST   | `/api/auth/login`     | `{ email, password }`              | Verifies credentials, returns JWT |

### Chat (requires `Authorization: Bearer <token>` header)

| Method | Endpoint                  | Body / Query                              | Description                                  |
|--------|----------------------------|---------------------------------------------|-----------------------------------------------|
| POST   | `/api/analyze`             | `{ text, mode, conversationId? }`           | `mode` is `"resume"`, `"jobmatch"`, or `"interview"`. Calls Ollama, saves the turn to the conversation thread, returns AI reply + `conversationId`. Omit `conversationId` to start a new thread. |
| GET    | `/api/history?mode=resume` | Query param `mode` (optional)               | Returns the logged-in user's conversation threads, optionally filtered by mode, newest first. |
| GET    | `/api/conversation/:id`    | —                                            | Returns the full message history for a single conversation thread. |

## Deployment

> **Note on Ollama in production:** Ollama runs as a local process, so a standard Render web service can't run it directly (no GPU/persistent local model storage on free tiers). For a deployed demo, either (a) run Ollama on a separate machine/VPS you control and point `OLLAMA_BASE_URL` at it, or (b) keep AI features local-only and only deploy the auth/UI shell for demo purposes. This is a known tradeoff of using a free local model instead of a paid hosted API.

### Backend → Render
1. Push the `backend/` folder to a GitHub repo.
2. Create a new **Web Service** on Render, point it at the repo/folder.
3. Build command: `npm install` — Start command: `npm start`.
4. Add environment variables in Render's dashboard: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (set this to your deployed Vercel URL), `OLLAMA_BASE_URL` (pointing to wherever Ollama is reachable), `OLLAMA_MODEL`.

### Frontend → Vercel
1. Push the `frontend/` folder to a GitHub repo (or same repo, different root).
2. Import the project into Vercel.
3. Set the environment variable `VITE_API_URL` to your deployed Render backend URL.
4. Deploy.

### Database → MongoDB Atlas
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Whitelist `0.0.0.0/0` (or Render's IPs) under Network Access.
3. Create a database user and copy the connection string into `MONGO_URI`.

## Security Notes
- Passwords are hashed with `bcryptjs` before storage — plaintext passwords are never saved.
- All chat routes are protected by JWT middleware; requests without a valid token receive `401 Unauthorized`.
- Each user can only read their own conversation threads (`Chat.find({ userId: req.userId })`), and `getConversation` checks both `_id` and `userId` before returning a thread.
- `.env` files are excluded from version control via `.gitignore`.

## Known Limitations (by design, per project scope)
- No WebSockets — all communication is plain HTTP/REST (each message is a full request/response, not streamed token-by-token).
- No PDF upload/download — text is pasted directly.
- No profile page or password reset flow.
- Ollama's local model (default `llama3.2`) is smaller and less capable than hosted GPT-4-class models — expect more variable answer quality, especially on longer resumes or nuanced interview feedback.
- Conversation history is sent in full to Ollama on every turn, so very long threads may eventually hit the model's context window limit.
