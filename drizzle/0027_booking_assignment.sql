ALTER TABLE "booking" ADD COLUMN "assigned_member_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "takes_appointments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_assigned_member_id_member_id_fk" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;