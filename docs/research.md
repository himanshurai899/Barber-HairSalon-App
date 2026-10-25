# Research & inspiration

Collected 2026-10-25. Vendor/template pages are marketing — patterns are taken from them, claims are not.

## UI patterns worth copying

| Pattern | Why | Seen at |
|---|---|---|
| Lots of white space, one muted accent colour, two fonts max | Reads "clean cut", ages well, cheap to maintain | [InsideA – design ideas](https://insidea.com/blog/marketing/barber-shops/website-design-ideas-for-barber-shops/), [IronBlades template](https://monsterone.com/ui-elements/ironblades-barbershop-minimalistic-website-ui-template-o354606/) |
| Booking CTA front and centre, not buried in a menu | Most visitors arrive to book | [InsideA](https://insidea.com/blog/marketing/barber-shops/website-design-ideas-for-barber-shops/) |
| Sticky bottom action bar on phones (Book · WhatsApp · Call) | Most traffic is mobile, thumb reach | [TrimSync template](https://lovable.dev/ja/templates/websites/services/trimsync-premium-barbershop-booking-template) |
| Large tap targets for call / book | People browse while walking past the shop | [InsideA](https://insidea.com/blog/marketing/barber-shops/website-design-ideas-for-barber-shops/) |
| Booking in a couple of taps, no extra fields | Every extra field loses bookings | [Cyberoptik – best barber sites](https://www.cyberoptik.net/blog/best-barber-shop-websites/) |
| Consistent image treatment (same crop/filter) | Brand recognisable without loud UI | [Slider Revolution – examples](https://www.sliderrevolution.com/design/barbershop-websites/) |
| WhatsApp-first booking with real business hours enforced in UI | Matches how customers in WhatsApp-heavy markets actually book | [Contra – barbershop case study](https://contra.com/p/3eU2cP2b-most-barbershop-websites-look-exactly), [Contra – CleanCut](https://contra.com/p/BqrmkA7Q-cleancut-barbershop-website-design-and-development) |

**Avoid:** carousels, parallax, autoplay video, dark "luxury" gradients, pop-ups on load.

## WhatsApp Business Platform (Cloud API)

- Inbound messages arrive on a webhook (`messages` field subscription, verify token handshake). Meta retries, so **de-duplicate by message id**. ([Val Town auto-reply example](https://www.val.town/x/Lyte/untitled-3191), [LogRocket Cloud API guide](https://dev.to/logrocket/build-an-automated-ecommerce-app-with-whatsapp-cloud-api-and-nodejs-5g3a))
- Free-form replies are only allowed inside the 24 h customer-service window opened by the customer's message. Business-initiated messages (booking confirmations, barber alerts) need **pre-approved templates** (utility category).
- **Pricing** ([Meta docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)): billed per delivered message since July 2025. From **1 Oct 2026** service messages are charged again, but each number gets **1,000 free service messages / month** — a single salon's greeting replies fit in that. Utility templates are billed per message by country ([QuickReply guide](https://www.quickreply.ai/whatsapp-automation/whatsapp-business-api-pricing)). A payment method must be on file in Meta Business Manager.
- **Coexistence**: an existing WhatsApp Business **app** number can be connected to the Cloud API and keep working in the phone app — no second number needed. Requires Business app ≥ 2.24.17, choose the coexistence option in Embedded Signup; brand-new app accounts aren't immediately eligible. ([360dialog](https://docs.360dialog.com/docs/waba-management/embedded-signup/whatsapp-coexistence), [8x8](https://developer.8x8.com/connect/docs/whatsapp/whatsapp-business-app-coexistence), [Telnyx](https://developers.telnyx.com/docs/messaging/whatsapp/coexistence))

## Preventing double bookings

- App-level "SELECT then INSERT" races under concurrent requests. Use a **Postgres exclusion constraint** on `(barber_id WITH =, time_range WITH &&)` with `btree_gist`. ([Medium – exclusion constraints](https://java-jedi.medium.com/exclusion-constraints-b2cbd62b637a), [Vonng – SQL EXCLUDE](https://vonng.com/en/pg/sql-exclude/))
- A **partial** constraint (`WHERE status IN ('pending','approved')`) lets rejected/cancelled rows stop blocking the slot. Caveat from [Cybertec](https://www.cybertec-postgresql.com/en/exclusion-constraints-in-postgresql-and-a-tricky-problem): status changes must go through `UPDATE` on the same row so the constraint re-checks — we never "revive" an old row, we insert a new one.
- PostgreSQL 18 adds temporal `WITHOUT OVERLAPS` constraints ([Better Stack](https://betterstack.com/community/guides/databases/postgres-temporal-constraints.md)); not used because it can't be partial and Neon/PGlite support varies.

## Testing the DB layer

- [PGlite](https://pglite.dev/extensions/) (Postgres in WASM) ships `btree_gist` in the main package (`@electric-sql/pglite/contrib/btree_gist`) and has a [Drizzle driver](https://orm.drizzle.team/docs/connect-pglite) → real constraint tests in-process, no Docker.
