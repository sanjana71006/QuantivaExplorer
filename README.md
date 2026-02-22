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

Notes
- Ensure `backend/.env` contains `PORT`, `MONGODB_URI` (optional) and `GEMINI_API_KEY` for the assistant.
- If you want one command to run both servers, I can add a root orchestrator script.
