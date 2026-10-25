# Release 0.1.0 checklist (issue #19)

Everything in code is merged to `develop`. These steps need the owner or accounts, so they are not automated. Do not tag until every box is ticked.

## Owner inputs
- [ ] #6 Vercel project linked (Pro plan, see design plan section 6) and Neon database created via the Marketplace integration
- [ ] #7 Meta Business verified, WhatsApp number connected (coexistence), three templates approved
- [ ] #8 Content received: street address, map pin, phone and WhatsApp numbers, logo, photos, real service list and prices, Instagram handle, barbers
- [ ] Review the placeholder privacy text on `/privacy`

## Environment (Vercel, Production and Preview)
- [ ] `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (random 32+ chars), `BETTER_AUTH_URL` and `SITE_URL` (the real domain)
- [ ] `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`
- [ ] `NEXT_PUBLIC_MAPS_EMBED_KEY` (optional)
- [ ] `USE_PGLITE` is NOT set

## Database
- [ ] `pnpm db:migrate` against the Neon database (3 migrations)
- [ ] `pnpm db:init-shop`: writes the salon address, phone, hours and booking rules (safe to re-run)
- [ ] First admin: `pnpm admin:create <email> "<name>" "<password>"` with `DATABASE_URL` and `BETTER_AUTH_SECRET` set
- [ ] Do NOT run `pnpm db:seed` in production (demo content); enter real data in /admin instead: settings, services, barbers (with phones), hours, offers
- [ ] Create barber logins in /admin/users

## WhatsApp
- [ ] Webhook callback URL `https://<domain>/api/whatsapp`, verify token = `WA_VERIFY_TOKEN`, subscribe to `messages`
- [ ] Message the salon number: greeting and Book a slot button arrive once, again only after 24 h
- [ ] Template names match exactly: `booking_request_barber`, `booking_confirmed`, `booking_declined` (variables in PR #31)

## Verify on the preview, then production
- [ ] `pnpm test:e2e` against the preview URL (set `baseURL`, and note the demo-staff tests only apply to the local database)
- [ ] Web booking: request, barber gets WhatsApp alert, approve, customer gets confirmation, `/b/<token>` shows approved
- [ ] WhatsApp link booking (`/book?src=wa`) is recorded with source whatsapp
- [ ] Phone booking entered in /admin/bookings
- [ ] 390px and desktop pass on landing, services, book

## Release (Gitflow, see CONTRIBUTING.md)
1. `git switch develop && git switch -c release/0.1.0`, bump `package.json` version if needed, final fixes only
2. PR to `main` (merge commit), then PR back to `develop`
3. Tag `v0.1.0` on `main`, attach the custom domain in Vercel
