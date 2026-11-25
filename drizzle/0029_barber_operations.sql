CREATE TABLE "staff_position" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "booking_org_active_slot_uq";--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "weekly_hours" jsonb;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "position_id" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "takes_appointments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_position" ADD CONSTRAINT "staff_position_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_position_org_name" ON "staff_position" USING btree ("organization_id","name");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_position_id_staff_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."staff_position"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION enforce_booking_staff_interval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assigned_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff WHERE id = NEW.assigned_staff_id AND organization_id = NEW.organization_id
  ) THEN RAISE EXCEPTION 'Ficha ajena al negocio' USING ERRCODE = '23503'; END IF;
  IF NEW.is_test OR NEW.status NOT IN ('agendada','realizada') THEN RETURN NEW; END IF;
  -- Serializa escritores del negocio; el SELECT posterior obtiene una vista fresca en READ COMMITTED.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id, 9929));
  IF EXISTS (
    SELECT 1 FROM booking b WHERE b.organization_id = NEW.organization_id AND b.id <> NEW.id
    AND NOT b.is_test AND b.status IN ('agendada','realizada')
    AND (NEW.assigned_staff_id IS NULL OR b.assigned_staff_id IS NULL OR b.assigned_staff_id = NEW.assigned_staff_id)
    AND b.scheduled_at < NEW.scheduled_at + NEW.duration_minutes * interval '1 minute'
    AND NEW.scheduled_at < b.scheduled_at + b.duration_minutes * interval '1 minute'
  ) THEN RAISE EXCEPTION 'Intervalo ocupado' USING ERRCODE = '23505'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER booking_staff_interval BEFORE INSERT OR UPDATE OF assigned_staff_id, scheduled_at, duration_minutes, status, is_test, organization_id
ON booking FOR EACH ROW EXECUTE FUNCTION enforce_booking_staff_interval();

--> statement-breakpoint
ALTER TABLE member ADD CONSTRAINT member_org_identity UNIQUE(organization_id, id);
--> statement-breakpoint
ALTER TABLE staff_position ADD CONSTRAINT position_org_identity UNIQUE(organization_id, id);
--> statement-breakpoint
ALTER TABLE staff ADD CONSTRAINT staff_org_member FOREIGN KEY (organization_id, member_id) REFERENCES member(organization_id, id);
--> statement-breakpoint
ALTER TABLE staff ADD CONSTRAINT staff_org_position FOREIGN KEY (organization_id, position_id) REFERENCES staff_position(organization_id, id);
