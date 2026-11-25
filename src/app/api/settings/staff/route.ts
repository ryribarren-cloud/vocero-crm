import { eq } from "drizzle-orm";
import { isValidInterval } from "@/lib/time/slots";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

const staffInput = z.object({
  name: z.string().trim().min(1).max(120),
  id: z.string().min(1).optional(),
  weeklyHours: z.partialRecord(z.enum(["mon","tue","wed","thu","fri","sat","sun"]), z.array(z.object({ start: z.string(), end: z.string() }).refine(isValidInterval)).max(12)).nullable().optional(),
  positionId: z.string().min(1).nullable().optional(),
  takesAppointments: z.boolean().optional(),
  memberId: z.string().min(1).nullable(),
});

const save = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") return apiError(403, "forbidden", "Solo el propietario administra la plantilla");
  const body = await parseBody(req, staffInput);
  if (!body.ok) return body.response;
  const db = getDb();
  if (body.data.memberId) {
    const [member] = await db.select({ id: schema.member.id }).from(schema.member)
      .where(scoped(schema.member.organizationId, session.organizationId, eq(schema.member.id, body.data.memberId)));
    if (!member) return apiError(422, "invalid", "La cuenta no pertenece al negocio");
  }
  const { id, ...values } = body.data;
  if (values.positionId) {
    const [position] = await db.select({ id: schema.staffPosition.id }).from(schema.staffPosition)
      .where(scoped(schema.staffPosition.organizationId, session.organizationId, eq(schema.staffPosition.id, values.positionId)));
    if (!position) return apiError(422, "invalid", "Puesto ajeno al negocio");
  }
  if (req.method === "PATCH") {
    if (!id) return apiError(422, "invalid", "Falta la ficha");
    try {
      const [updated] = await db.update(schema.staff).set(values)
        .where(scoped(schema.staff.organizationId, session.organizationId, eq(schema.staff.id, id)))
        .returning({ id: schema.staff.id });
      return updated ? Response.json(updated) : apiError(404, "not_found", "Ficha no encontrada");
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      if ([e.code, e.cause?.code].includes("23505")) return apiError(409, "duplicate", "Cuenta ya vinculada");
      throw error;
    }
  }
  const [staff] = await db.insert(schema.staff)
    .values({ ...values, id: newId("staff"), organizationId: session.organizationId })
    .onConflictDoNothing({ target: schema.staff.memberId }).returning({ id: schema.staff.id });
  if (!staff) return apiError(409, "duplicate", "La cuenta ya está vinculada a la plantilla");
  return Response.json({ id: staff.id }, { status: 201 });
});

export { save as PATCH, save as POST };
