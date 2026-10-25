CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_id" integer NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "availability_weekday" CHECK ("availability"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "barber_services" (
	"barber_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	CONSTRAINT "barber_services_barber_id_service_id_pk" PRIMARY KEY("barber_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "barbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"photo_url" text,
	"bio" text,
	"instagram" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"barber_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"during" "tstzrange" NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"manage_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"price_minor" integer NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_manage_token_unique" UNIQUE("manage_token"),
	CONSTRAINT "bookings_range" CHECK (not isempty("bookings"."during") and lower("bookings"."during") < upper("bookings"."during"))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"wa_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'notice' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"badge" text,
	"starts_on" date,
	"ends_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Hair' NOT NULL,
	"duration_min" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "services_positive" CHECK ("services"."duration_min" > 0 and "services"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shop_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" smallint NOT NULL,
	"opens" time NOT NULL,
	"closes" time NOT NULL,
	CONSTRAINT "shop_hours_weekday_unique" UNIQUE("weekday"),
	CONSTRAINT "shop_hours_weekday" CHECK ("shop_hours"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'Krishna Hair Salon' NOT NULL,
	"tagline" text DEFAULT 'Where Style Meets Perfection' NOT NULL,
	"address" text DEFAULT 'Gotri, Vadodara' NOT NULL,
	"lat" text,
	"lng" text,
	"maps_place_id" text,
	"phone" text,
	"whatsapp_number" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"greeting_text" text DEFAULT 'Hi {name} 👋 Thanks for messaging *Krishna Hair Salon*, Gotri.
To avoid waiting, book your slot here 👇 and we''ll confirm on WhatsApp.' NOT NULL,
	"pending_ttl_min" integer DEFAULT 120 NOT NULL,
	"slot_step_min" integer DEFAULT 15 NOT NULL,
	"min_notice_min" integer DEFAULT 60 NOT NULL,
	"horizon_days" integer DEFAULT 30 NOT NULL,
	"max_open_per_phone" integer DEFAULT 2 NOT NULL,
	CONSTRAINT "shop_settings_single_row" CHECK ("shop_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "special_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"opens" time,
	"closes" time,
	"closed" boolean DEFAULT false NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	CONSTRAINT "special_hours_dates" CHECK ("special_hours"."ends_on" >= "special_hours"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" serial PRIMARY KEY NOT NULL,
	"barber_id" integer NOT NULL,
	"during" "tstzrange" NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'barber' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_inbound" (
	"wa_message_id" text PRIMARY KEY NOT NULL,
	"from_phone" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barbers" ADD CONSTRAINT "barbers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "wa_inbound_phone_idx" ON "wa_inbound" USING btree ("from_phone","received_at");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "no_overlap" EXCLUDE USING gist ("barber_id" WITH =, "during" WITH &&) WHERE ("status" IN ('pending', 'approved'));
