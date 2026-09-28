# Instructor demo script (≈ 5 minutes)

## Live showcase (preferred)

Open the deployed app — no local setup required:

**App:** [https://teleprojectmanager-three.vercel.app](https://teleprojectmanager-three.vercel.app)

Login: **admin@ethiotelecom.et** / **password123**

---

## Local alternative

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Login: **admin@ethiotelecom.et** / **password123**  
Swagger (show NestJS): http://localhost:4000/api/docs

---

## Walkthrough

### 1. Brand + architecture (30s)
- Open the app → EthioTelecom logo + **Project Manager**
- Mention stack: **Next.js frontend** (`apps/web`) + **NestJS API** (`apps/api`) + **Neon/Postgres** (`packages/database`)

### 2. Dashboard (45s)
- Show Active / Completed projects, task status summary, charts
- Point out overdue badge if present

### 3. Projects list (45s)
- Progress rings (33% Fiber, 100% Telebirr)
- Completed vs Active badges
- Click **Addis Fiber Expansion**

### 4. Project detail — the money shot (2 min)
- Progress ring + Kanban (TODO / IN_PROGRESS / DONE)
- Members panel: Owner / Member + invite
- Mark remaining tasks **Done** via the column dropdowns
- Watch:
  - progress → **100%**
  - status badge → **Completed**
  - activity: **auto-completed this project (all tasks done)**

### 5. Reopen (30s)
- Move one task back to **In Progress**
- Project returns to **Active** (system reopen)

### 6. NestJS proof (30s)
- Open Swagger `/api/docs`
- Authorize with JWT from login (or login via Swagger `/auth/login`)
- Show `GET /projects/{id}/progress`

### 7. Admin (optional 30s)
- `/admin` → users, divisions, link to API docs

---

## Talking points

- “When every task is done, the **backend** auto-completes the project — not a UI-only trick.”
- “Deployable as two apps: frontend and API folders are separate.”
- “Database is Neon-ready Postgres via Prisma.”
