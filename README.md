# Barber & Hair Salon App

Mobile-first website and booking system for a hair salon. Bookings come in from the **website, WhatsApp and phone calls**, every booking is **approved by a barber**, and an **admin** manages barbers, services, hours, offers and shop details.

- Design plan: [docs/design-plan.md](docs/design-plan.md)
- Delivery plan and tracker: [docs/delivery-plan.md](docs/delivery-plan.md), [issues](https://github.com/himanshurai899/Barber-HairSalon-App/issues)
- Research & inspiration: [docs/research.md](docs/research.md)
- How we work (Gitflow + TDD): [CONTRIBUTING.md](CONTRIBUTING.md)

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS · Neon Postgres · Drizzle ORM · Better Auth · WhatsApp Cloud API · Vitest + PGlite · Playwright · Vercel.

**Status:** all code issues are done on `develop` (booking flow, staff approvals, admin, WhatsApp greeting and notifications). Waiting on the owner: Vercel and Neon (#6), Meta WhatsApp setup (#7), salon content (#8), then the release (#19, see [docs/release-checklist.md](docs/release-checklist.md)).

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Copy `.env.example` to `.env.local` and fill in values when a feature needs them.

**Try it without any accounts:** set `USE_PGLITE=1` and `BETTER_AUTH_SECRET` (any 32+ characters) in `.env.local`, then `pnpm dev`. You get an in-memory seeded database with placeholder content and demo staff (`admin@demo.test`, `hitesh@demo.test`; password in `src/lib/db/demo-staff.ts`). Data resets on restart. Never set `USE_PGLITE` in production.
