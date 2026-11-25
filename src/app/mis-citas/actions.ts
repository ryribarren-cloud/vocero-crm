"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
export async function markOwn(status: "realizada" | "no_show", form: FormData) {
  const session = await requireSession({ allowBarber: true });
  if (session.role !== "barber" || (status !== "realizada" && status !== "no_show")) throw new Error("Operación no permitida");
  const db = getDb();
  const { staff, booking, member } = schema;
  const linked = db.select({ id: staff.id }).from(staff).innerJoin(member, eq(member.id, staff.memberId))
    .where(and(eq(staff.organizationId, session.organizationId), eq(member.organizationId, session.organizationId), eq(member.id, session.memberId), eq(member.role, "barber")));
  const [updated] = await db.update(booking).set({ status, updatedAt: new Date() })
    .where(and(eq(booking.organizationId, session.organizationId), eq(booking.id, String(form.get("id"))), eq(booking.kind, "session"), eq(booking.status, "agendada"), inArray(booking.assignedStaffId, linked))).returning({ id: booking.id });
  if (!updated) throw new Error("La cita ya no está disponible para esta cuenta");
  revalidatePath("/mis-citas");
}
