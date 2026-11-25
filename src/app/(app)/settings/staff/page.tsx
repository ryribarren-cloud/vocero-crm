import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { Positions } from "./positions";
import { StaffForm } from "./staff-form";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/bookings");
  const db = getDb();
  const [staff, members, positions] = await Promise.all([
    db.select().from(schema.staff)
      .where(scoped(schema.staff.organizationId, session.organizationId)).orderBy(asc(schema.staff.name)),
    db.select({ id: schema.member.id, name: schema.user.name }).from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(scoped(schema.member.organizationId, session.organizationId)).orderBy(asc(schema.user.name)),
    db.select().from(schema.staffPosition).where(eq(schema.staffPosition.organizationId, session.organizationId)).orderBy(asc(schema.staffPosition.name)),
  ]);
  const memberNames = new Map(members.map(({ id, name }) => [id, name]));
  return (
    <section className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Plantilla laboral</h1>
      <Positions positions={positions} />
      <StaffForm positions={positions} members={members.filter(({ id }) => !staff.some((person) => person.memberId === id))} />
      <ul className="space-y-2">
        {staff.map((person) => (
          <li className="rounded-lg border p-3" key={person.id}>
            <div className="font-medium">{person.name}</div>
            <div className="text-sm text-muted-foreground">
              {person.memberId ? memberNames.get(person.memberId) : "Sin cuenta vinculada"}
            </div>
            <details><summary>Editar ficha</summary><StaffForm person={person} positions={positions} members={members.filter(m => m.id === person.memberId || !staff.some(s => s.memberId === m.id))} /></details>
          </li>
        ))}
      </ul>
    </section>
  );
}
