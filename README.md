 QUANTIVA EXPLORER

**Team: VORTEX CORE**

Health‑Tech | Quantum‑Inspired Exploration of Drug Candidate Search Spaces

---

## One‑Line Pitch
QUANTIVA EXPLORER is a quantum‑inspired, visual platform that helps students and early researchers explore massive molecular search spaces, probabilistically prioritize drug candidates, and save reproducible experiments and simulation histories.

## Team
**VORTEX CORE** — creators of QUANTIVA EXPLORER

---

<img width="1920" height="4177" alt="image" src="https://github.com/user-attachments/assets/7f69150c-c810-423c-a619-169a6e5ac5f2" />

## Problem Statement
Drug discovery requires exploring extremely large molecular spaces to identify promising candidates. Traditional methods treat discovery as a linear filtering pipeline, making it slow, expensive, and difficult to interpret.

## Core Challenge
Students and early researchers struggle to understand drug discovery workflows because many existing tools rely on complex mathematical models rather than intuitive visual exploration and experiment tracking.

## Our Approach
- Probabilistic evaluation and ranking (quantum‑inspired ideas) to prioritize molecules.
- Parallel exploration and ranking logic to surface promising candidates faster.
- Rich 2D and 3D molecule visualizations with interactive viewers.
- Per‑user persistence: sign up/login, JWT auth, hashed passwords, and user‑scoped storage for experiments, configs, simulation history, disease experiment runs, and generated reports.

## Key Features
- Signup / Login with secure password hashing and JWT.
- Protected exploration routes (only signed‑in researchers can run/save experiments).
- Save/load experiments, weight configurations, simulation history, disease experiment sets, and reports per user.
- 2D molecule images, 3D popouts, molecule sketching, and analytics dashboards.
- Beautiful sign‑in UI with animated molecule background for better UX.

---

## Tech Stack
- Frontend: React + TypeScript, Vite
- Styling: Tailwind / CSS
- Backend: Node.js, Express, Mongoose (MongoDB)
- Auth: JWT, `bcryptjs` for password hashing
- Dev: npm, vite

---

## Quick Start (Local Development)

Clone the repo and install dependencies:

```bash
git clone <your-repo-url>
cd quantum-vista-explore-main
```

Backend

```bash
cd backend
npm install
# create backend/.env with values from the example below
npm run dev
```

Frontend

```bash
cd ../frontend
npm install
npm run dev
# open the Vite dev URL shown in the terminal (default http://localhost:5173)
```

### Example environment variables
Create `backend/.env`:

```text
PORT=8080
MONGODB_URI=mongodb://localhost:27017/quantiva
JWT_SECRET=your-secret-key
```

Create `frontend/.env`:

```text
VITE_API_BASE=http://localhost:8080
```

Note: If MongoDB is not available, the backend provides a JSON fallback in some demo flows, but persistence requires a running MongoDB instance.

---

## API Quick Reference

- POST `/signup` — body: { name, email, password }
- POST `/login` — body: { email, password } → returns JWT
- GET `/me` — header: `Authorization: Bearer <token>`
- POST `/user/experiments` — save user experiment (auth required)
- GET `/user/experiments` — list saved experiments (auth required)

Refer to `backend/server/index.js` for full endpoint details.

---

## How to Record a Short GIF of the 3D Viewer
1. Use a screen recorder like OBS, ShareX, or macOS QuickTime.
2. Record a 5–8 second interaction of the 3D viewer rotating or highlighting a molecule.
3. Export as GIF or MP4 (MP4 recommended for quality). Place file in `docs/gifs/` and embed with:


---

## Contributing
- Fork → branch → PR. Please include screenshots for UI changes and update the gallery.

## License
Add your preferred license (we suggest MIT for hackathon demos).

## Contact
- Team: **VORTEX CORE**
- Maintainters / Contact: add your emails or GitHub handles here.

---

Thank you for exploring QUANTIVA EXPLORER — feel free to ask me to commit this file, add the `docs/screenshots/` folder, or generate a gallery README for the screenshots directory.
