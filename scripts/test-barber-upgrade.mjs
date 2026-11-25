import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = new URL(process.env.DATABASE_URL);
if (!["localhost","127.0.0.1"].includes(url.hostname)) throw Error("Requiere PostgreSQL local de prueba");
const admin = postgres(url.toString());
const database = "upgrade_" + randomUUID().replaceAll("-","");
await admin`create database ${admin(database)}`;
url.pathname = "/" + database;
const sql = postgres(url.toString());
const folder = await mkdtemp(join(tmpdir(),"vocero-upgrade-"));
try {
  await cp("drizzle",folder,{recursive:true});
  const journalPath = join(folder,"meta","_journal.json");
  const journal = JSON.parse(await readFile(journalPath,"utf8"));
  await writeFile(journalPath,JSON.stringify({...journal,entries:journal.entries.filter(e=>e.idx<=28)}));
  await migrate(drizzle(sql),{migrationsFolder:folder});
  await sql`insert into organization(id,name) values ('org','Negocio')`;
  await sql`insert into "user"(id,name,email) values ('u','Miguel','m@example.test')`;
  await sql`insert into member(id,organization_id,user_id,role) values ('m','org','u','member')`;
  await sql`insert into contact(id,organization_id,wa_identity,name) values ('c','org','canal-prueba','Cliente')`;
  await sql`insert into staff(id,organization_id,name,member_id) values ('s','org','Miguel','m')`;
  await sql`insert into booking(id,organization_id,contact_id,assigned_staff_id,scheduled_at,duration_minutes) values ('b','org','c','s','2030-01-01',30),('legacy','org','c',null,'2030-01-02',30)`;
  const snapshot = () => sql`select b.id,b.contact_id,b.assigned_staff_id,s.member_id,m.role,u.email,c.name from booking b join contact c on c.id=b.contact_id left join staff s on s.id=b.assigned_staff_id left join member m on m.id=s.member_id left join "user" u on u.id=m.user_id order by b.id`;
  const before = await snapshot();
  await migrate(drizzle(sql),{migrationsFolder:"drizzle"});
  assert.deepEqual(Array.from(await snapshot()),Array.from(before));
  const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  assert.equal(applied[0].n,journal.entries.length);
  console.log("PASS actualización 0028 →",journal.entries.at(-1).tag,"; dos citas, asignación, ficha, vínculo, contacto y usuario conservados");
} finally {
  await sql.end(); await admin`drop database ${admin(database)}`; await admin.end(); await rm(folder,{recursive:true,force:true});
}
