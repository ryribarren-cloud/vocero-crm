import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { randomUUID } from "node:crypto";

const save = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") return apiError(403, "forbidden", "Solo el propietario administra puestos");
  const body = await parseBody(req, z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(120) }));
  if (!body.ok) return body.response;
  const table = schema.staffPosition;
  const { id, name } = body.data;
  try {
    if (id) {
      const [row] = await getDb().update(table).set({ name }).where(scoped(table.organizationId, session.organizationId, eq(table.id, id))).returning({ id: table.id });
      return row ? Response.json(row) : apiError(404, "not_found", "Puesto no encontrado");
    }
    const [row] = await getDb().insert(table).values({ id: randomUUID(), organizationId: session.organizationId, name }).returning({ id: table.id });
    return Response.json(row, { status: 201 });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if ([e.code, e.cause?.code].includes("23505")) return apiError(409, "duplicate", "El puesto ya existe");
    throw error;
  }
});
export { save as POST };
