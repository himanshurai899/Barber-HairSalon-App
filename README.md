# Barber & Hair Salon App

Mobile-first website and booking system for a hair salon. Bookings come in from the **website, WhatsApp and phone calls**, every booking is **approved by a barber**, and an **admin** manages barbers, services, hours, offers and shop details.

- Design plan: [docs/design-plan.md](docs/design-plan.md)
- Research & inspiration: [docs/research.md](docs/research.md)
- How we work (Gitflow + TDD): [CONTRIBUTING.md](CONTRIBUTING.md)

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS · Neon Postgres · Drizzle ORM · Better Auth · WhatsApp Cloud API · Vitest + PGlite · Playwright · Vercel.

**Status:** scaffold done (Next.js, Tailwind, Drizzle, Vitest + PGlite, Playwright, CI). Next: `feature/data-model`.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Copy `.env.example` to `.env.local` and fill in values when a feature needs them.
