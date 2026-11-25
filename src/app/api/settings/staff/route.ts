import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

const staffInput = z.object({
  name: z.string().trim().min(1).max(120),
  memberId: z.string().min(1).nullable(),
});

export const POST = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") return apiError(403, "forbidden", "Solo el propietario administra la plantilla");
  const body = await parseBody(req, staffInput);
  if (!body.ok) return body.response;
  const db = getDb();
  if (body.data.memberId) {
    const [member] = await db.select({ id: schema.member.id }).from(schema.member)
      .where(scoped(schema.member.organizationId, session.organizationId, eq(schema.member.id, body.data.memberId)));
    if (!member) return apiError(422, "invalid", "La cuenta no pertenece al negocio");
  }
  const [staff] = await db.insert(schema.staff)
    .values({ ...body.data, id: newId("staff"), organizationId: session.organizationId })
    .onConflictDoNothing({ target: schema.staff.memberId }).returning({ id: schema.staff.id });
  if (!staff) return apiError(409, "duplicate", "La cuenta ya está vinculada a la plantilla");
  return Response.json({ id: staff.id }, { status: 201 });
});
