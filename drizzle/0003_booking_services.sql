CREATE TABLE "booking_services" (
	"booking_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_minor" integer NOT NULL,
	CONSTRAINT "booking_services_booking_id_service_id_pk" PRIMARY KEY("booking_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill (hand-written, additive): every existing booking gets one line from bookings.service_id.
-- Length and price are what the booking itself recorded; the name is the service's current name.
INSERT INTO "booking_services" ("booking_id", "service_id", "position", "name", "duration_min", "price_minor")
SELECT b."id", b."service_id", 0, s."name",
       GREATEST(1, round(extract(epoch FROM (upper(b."during") - lower(b."during"))) / 60))::integer,
       b."price_minor"
FROM "bookings" b
JOIN "services" s ON s."id" = b."service_id"
ON CONFLICT DO NOTHING;