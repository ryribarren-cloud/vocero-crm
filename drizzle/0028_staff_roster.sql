CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"member_id" text,
	CONSTRAINT "staff_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "assigned_staff_id" text;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "staff" ("id", "organization_id", "name", "member_id")
SELECT 'staff_legacy_' || m."id", m."organization_id", u."name", m."id"
FROM "member" m JOIN "user" u ON u."id" = m."user_id"
WHERE m."takes_appointments" OR EXISTS (
  SELECT 1 FROM "booking" b WHERE b."assigned_member_id" = m."id"
    AND b."organization_id" = m."organization_id"
);
--> statement-breakpoint
UPDATE "booking" b SET "assigned_staff_id" = s."id"
FROM "staff" s WHERE s."member_id" = b."assigned_member_id"
AND s."organization_id" = b."organization_id";
