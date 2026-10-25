CREATE TABLE "wa_outbound" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"to_phone" text,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wa_outbound" ADD CONSTRAINT "wa_outbound_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wa_outbound_created_idx" ON "wa_outbound" USING btree ("created_at");