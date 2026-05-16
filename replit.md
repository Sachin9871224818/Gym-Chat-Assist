# FitPro Gym Management Chatbot

Full-stack gym management system with an AI-powered WhatsApp-style chatbot, admin panel, attendance tracking, member management, and more.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`, port 8080, path `/api`)
- Frontend: React + Vite (`artifacts/gym-chatbot`, path `/`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Hooks: `@workspace/api-client-react` (generated)
- Build: esbuild (CJS bundle)

## Where things live

- **OpenAPI spec**: `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- **DB schema**: `lib/db/src/schema/` — one file per domain (members, trainers, attendance, plans, leads, broadcasts, progress, chat)
- **API routes**: `artifacts/api-server/src/routes/` — chat, members, trainers, attendance, plans, leads, broadcasts, dashboard
- **Frontend pages**: `artifacts/gym-chatbot/src/pages/` — Dashboard, Chat, Members, MemberDetail, Trainers, TrainerDetail, Attendance, DietPlans, WorkoutPlans, Leads, Broadcasts
- **Theme**: `artifacts/gym-chatbot/src/index.css` — orange primary (`--primary: 25 95% 55%`), dark sidebar

## Architecture decisions

- Contract-first API: OpenAPI spec drives Orval codegen, ensuring type-safe hooks and Zod schemas
- Session-based chatbot: `chat_sessions` table stores conversation state (mode, pendingStep, pendingData); 30-min inactivity auto-resets
- Multi-mode bot: `botMode` field enables future services beyond gym; currently `gym` is the only mode
- Expiry computed server-side: membership expiry is computed from joiningDate + plan duration, never stored client-side
- Attendance uses date-keyed records: one record per member per day, with check_in and check_out timestamps

## Product

- **Dashboard**: live stats (members, attendance, revenue, expiring soon), weekly attendance chart, recent activity feed
- **Chatbot**: WhatsApp-style conversational interface — register members, show plans, book trainers, diet/workout plans, FAQ; session resets after 30 min
- **Members**: searchable/filterable table, add member dialog (name, phone, plan, payment), member detail with progress chart and attendance history, renewal
- **Trainers**: card grid, trainer detail with assigned members and bookings
- **Attendance**: quick check-in/out by member, filterable by date
- **Diet Plans & Workout Plans**: goal-filtered cards, create new plans
- **Leads**: status pipeline (new → contacted → converted), inline status update
- **Broadcasts**: send announcements/offers to all/active/expired members

## Membership Plans

| Plan | Duration | Price |
|------|----------|-------|
| 1 Month | 1 month | ₹2,000 |
| 3 Months | 3 months | ₹5,000 |
| 6 Months | 6 months | ₹9,000 |
| 1 Year | 12 months | ₹17,000 |

## User preferences

- Orange primary theme on dark sidebar
- Indian Rupee (₹) currency formatting
- `en-IN` locale for dates and numbers

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes
- Run `pnpm --filter @workspace/db run push` after any schema changes
- Chat session IDs are stored in localStorage (`fitpro_chat_session_id`)
- Member plan options in the select use display format `"1 Month"` — the server parses this exact string for duration/price lookups

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
