// Schema for docs/design-plan.md section 8. Money in minor units, all times timestamptz.
// The no_overlap exclusion constraint cannot be expressed in Drizzle: it is appended by hand
// to the generated migration (see drizzle/*.sql), keep it when regenerating.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  uniqueIndex,
  integer,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

export type TimeRange = { start: Date; end: Date };

/** Postgres tstzrange, always half-open [start, end). */
const tstzrange = customType<{ data: TimeRange; driverData: string }>({
  dataType: () => "tstzrange",
  toDriver: (r) => `[${r.start.toISOString()},${r.end.toISOString()})`,
  fromDriver: (v) => {
    const [s, e] = [...v.matchAll(/"([^"]+)"/g)].map((m) => new Date(m[1].replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")));
    return { start: s, end: e };
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const bookingStatuses = ["pending", "approved", "rejected", "expired", "cancelled"] as const;
export const bookingSources = ["web", "whatsapp", "phone", "walk_in", "admin"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export type BookingSource = (typeof bookingSources)[number];

// --- Better Auth (email + password, role field) ---
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["admin", "barber"] }).notNull().default("barber"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// --- Shop ---
export const shopSettings = pgTable(
  "shop_settings",
  {
    id: integer("id").primaryKey().default(1), // single row
    name: text("name").notNull().default("Krishna Hair Salon"),
    tagline: text("tagline").notNull().default("Where Style Meets Perfection"),
    address: text("address").notNull().default("Gotri, Vadodara"),
    lat: text("lat"),
    lng: text("lng"),
    mapsPlaceId: text("maps_place_id"),
    phone: text("phone"),
    whatsappNumber: text("whatsapp_number"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    currency: text("currency").notNull().default("INR"),
    greetingText: text("greeting_text")
      .notNull()
      .default(
        "Hi {name} 👋 Thanks for messaging *Krishna Hair Salon*, Gotri.\nTo avoid waiting, book your slot here 👇 and we'll confirm on WhatsApp.",
      ),
    pendingTtlMin: integer("pending_ttl_min").notNull().default(120),
    slotStepMin: integer("slot_step_min").notNull().default(15),
    minNoticeMin: integer("min_notice_min").notNull().default(60),
    horizonDays: integer("horizon_days").notNull().default(30),
    maxOpenPerPhone: integer("max_open_per_phone").notNull().default(2),
  },
  (t) => [check("shop_settings_single_row", sql`${t.id} = 1`)],
);

export const shopHours = pgTable(
  "shop_hours",
  {
    id: serial("id").primaryKey(),
    weekday: smallint("weekday").notNull().unique(), // 0 = Sunday; no row = closed
    opens: time("opens").notNull(),
    closes: time("closes").notNull(),
  },
  (t) => [check("shop_hours_weekday", sql`${t.weekday} between 0 and 6`)],
);

export const specialHours = pgTable(
  "special_hours",
  {
    id: serial("id").primaryKey(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    opens: time("opens"),
    closes: time("closes"),
    closed: boolean("closed").notNull().default(false),
    label: text("label").notNull().default(""),
  },
  (t) => [check("special_hours_dates", sql`${t.endsOn} >= ${t.startsOn}`)],
);

export const barbers = pgTable(
  "barbers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"), // E.164, unique when set
    photoUrl: text("photo_url"),
    bio: text("bio"),
    instagram: text("instagram"),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("barbers_phone_unique").on(t.phone).where(sql`${t.phone} is not null`)],
);

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Hair"),
    durationMin: integer("duration_min").notNull(),
    priceMinor: integer("price_minor").notNull(),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [check("services_positive", sql`${t.durationMin} > 0 and ${t.priceMinor} >= 0`)],
);

export const barberServices = pgTable(
  "barber_services",
  {
    barberId: integer("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
    serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.barberId, t.serviceId] })],
);

export const availability = pgTable(
  "availability",
  {
    id: serial("id").primaryKey(),
    barberId: integer("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(), // several rows per day = breaks
  },
  (t) => [check("availability_weekday", sql`${t.weekday} between 0 and 6`)],
);

export const timeOff = pgTable("time_off", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  during: tstzrange("during").notNull(),
  reason: text("reason"),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(), // E.164
  name: text("name").notNull(),
  email: text("email"),
  notes: text("notes"), // admin-only: preferences, allergies, anything to remember
  waOptIn: boolean("wa_opt_in").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    barberId: integer("barber_id").notNull().references(() => barbers.id),
    serviceId: integer("service_id").notNull().references(() => services.id), // primary (first) service; all of them: booking_services
    during: tstzrange("during").notNull(),
    status: text("status", { enum: bookingStatuses }).notNull().default("pending"),
    source: text("source", { enum: bookingSources }).notNull(),
    note: text("note"),
    manageToken: text("manage_token")
      .notNull()
      .unique()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    priceMinor: integer("price_minor").notNull(), // total of the booked services, copied at booking time
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("bookings_range", sql`not isempty(${t.during}) and lower(${t.during}) < upper(${t.during})`),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_status_idx").on(t.status, t.createdAt),
  ],
);

// One row per service in a booking. Name, length and price are snapshots: later edits to a service never rewrite history.
export const bookingServices = pgTable(
  "booking_services",
  {
    bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: integer("service_id").notNull().references(() => services.id),
    position: smallint("position").notNull().default(0), // 0 = primary, mirrors bookings.service_id
    name: text("name").notNull(),
    durationMin: integer("duration_min").notNull(),
    priceMinor: integer("price_minor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.serviceId] })],
);

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  kind: text("kind", { enum: ["offer", "notice"] }).notNull().default("notice"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  badge: text("badge"),
  startsOn: date("starts_on", { mode: "string" }),
  endsOn: date("ends_on", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const waInbound = pgTable(
  "wa_inbound",
  {
    waMessageId: text("wa_message_id").primaryKey(),
    fromPhone: text("from_phone").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
    greetedAt: ts("greeted_at"), // set when we sent the booking-link greeting for this message
  },
  (t) => [index("wa_inbound_phone_idx").on(t.fromPhone, t.receivedAt)],
);

// Outbound WhatsApp template messages, so failures are visible in admin.
export const waOutbound = pgTable(
  "wa_outbound",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    toPhone: text("to_phone"),
    template: text("template").notNull(),
    status: text("status", { enum: ["sent", "failed", "skipped"] }).notNull(),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("wa_outbound_created_idx").on(t.createdAt)],
);
