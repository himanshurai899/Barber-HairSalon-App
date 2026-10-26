ALTER TABLE "customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE UNIQUE INDEX "barbers_phone_unique" ON "barbers" USING btree ("phone") WHERE "barbers"."phone" is not null;