Quantiva Explorer

Quantiva Explorer is an interactive quantum-inspired molecular exploration system that simulates how drug candidates are discovered, filtered, and ranked within large chemical spaces using probabilistic scoring, real-time visualization, and explainable AI to accelerate candidate selection for research teams.

Quick start

- Backend:
  ```bash
  cd backend
  npm install
  npm run dev   # or npm start
  ```

- Frontend:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

Deployment (Render)
-------------------

This repository contains two services:

- `backend` — Node.js Express API (expects `MONGODB_URI`, `GEMINI_API_KEY`)
- `frontend` — Vite-built static app (output `dist`)

To deploy to Render using the provided `render.yaml`:

1. Connect your GitHub repo to Render.
2. In Render, create a new service from repository and allow using `render.yaml` (or Import using `render.yaml`).
3. For the backend service, set environment variables in Render dashboard (do NOT commit secrets to the repo): `MONGODB_URI`, `GEMINI_API_KEY`.
4. The frontend is configured as a static site: build command `cd frontend && npm install && npm run build`, publish directory `frontend/dist`.

Security note: Remove any committed secrets and rotate credentials if they were previously exposed in the repo history.

Notes
- Ensure `backend/.env` contains `PORT`, `MONGODB_URI` (optional) and `GEMINI_API_KEY` for the assistant.
- If you want one command to run both servers, I can add a root orchestrator script.
