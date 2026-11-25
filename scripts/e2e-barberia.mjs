import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { chromium, request } from "playwright";

const baseURL = process.env.APP_BASE_URL;
const dbURL = process.env.DATABASE_URL;
if (![baseURL, dbURL].every(value => value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) throw Error("Usa una instancia local de prueba");
const db = postgres(dbURL,{connection:{TimeZone:"UTC"}});
const contexts = [];
async function session() {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  contexts.push(ctx); return ctx;
}
async function call(ctx, method, path, data, expected) {
  const res = await ctx.fetch(path, { method, data, timeout: 120000 });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status(), expected, method + " " + path + " " + (body.error?.message ?? body.message ?? ""));
  return body;
}
const stamp = Date.now();
const password = randomUUID();
const email = name => name.toLowerCase() + stamp + "@example.test";
const owner = await session(), reception = await session(), barber = await session();
try {
  assert.equal((await db`select count(*)::int as n from organization`)[0].n,0,"Usa una base desechable recién migrada");
  await call(owner,"POST","/api/auth/sign-up/email",{ name:"Owner", email:email("owner"),password },200);
  async function team(name, ctx, role) {
    await call(owner,"POST","/api/settings/team",{name,email:email(name),password},201);
    await call(ctx,"POST","/api/auth/sign-in/email",{email:email(name),password},200);
    const member = (await call(owner,"GET","/api/settings/team",undefined,200)).members.find(m=>m.email === email(name));
    assert.equal(member.role,"member");
    await call(ctx,"GET","/api/bookings",undefined,200);
    await call(owner,"PATCH","/api/settings/team",{id:member.id,takesAppointments:true,accessRole:role},200);
    return member.id;
  }
  const mid = await team("Miguel",barber,"barber");
  await team("Recepcion",reception,"reception");
  await call(barber,"GET","/api/bookings",undefined,401);
  assert.match(await (await barber.get("/mis-citas")).text(),/vinculada a una ficha/);
  const position = await call(owner,"POST","/api/settings/positions",{name:"Barbería "+stamp},201);
  const staff = (name,memberId) => ({name,memberId,positionId:position.id,takesAppointments:true});
  const miguel = await call(owner,"POST","/api/settings/staff",staff("Miguel",mid),201);
  const ana = await call(owner,"POST","/api/settings/staff",staff("Ana",null),201);
  await call(owner,"POST","/api/settings/staff",staff("Duplicado",mid),409);
  assert.match(await (await barber.get("/mis-citas")).text(),/Todavía no tienes citas/);
  console.log("PASS sesiones Miembro → Recepción y Barbero, ficha vacía, vínculo único");
  const client = await call(reception,"POST","/api/contacts",{name:"Cliente sintético "+stamp,phone:String(stamp)},201);
  const slots = (await call(reception,"GET","/api/calendar/availability?staffId="+miguel.id,undefined,200)).slots;
  assert.ok(slots.length>=6);
  const book = (staffId,slot) => ({kind:"session",contactId:client.contact.id,assignedStaffId:staffId,startUtc:slots[slot].startUtc});
  const both = await Promise.all([miguel.id,ana.id].map(id=>call(reception,"POST","/api/bookings",book(id,0),201)));
  const race = await Promise.all([1,2].map(()=>reception.post("/api/bookings",{data:book(miguel.id,1)})));
  assert.deepEqual(race.map(r=>r.status()).sort(),[201,409]);
  console.log("PASS citas concurrentes mismo barbero 201/409 y distintos 201/201");
  const patch = (id,data,status) => call(reception,"PATCH","/api/bookings/"+id,data,status);
  await patch(both[1].booking.id,{action:"cancel"},200);
  await patch(both[0].booking.id,{action:"reschedule",startUtc:slots[2].startUtc},200);
  await call(reception,"POST","/api/bookings",{kind:"block",assignedStaffId:miguel.id,startUtc:slots[3].startUtc,durationMinutes:30},201);
  await patch(both[0].booking.id,{action:"reschedule",startUtc:slots[3].startUtc},409);
  await call(owner,"PATCH","/api/settings/staff",{...staff("Miguel",mid),id:miguel.id,weeklyHours:{}},200);
  await patch(both[0].booking.id,{action:"reschedule",startUtc:slots[4].startUtc},409);
  await call(owner,"PATCH","/api/settings/staff",{...staff("Miguel",null),id:miguel.id,weeklyHours:null},200);
  assert.match(await (await barber.get("/mis-citas")).text(),/vinculada a una ficha/);
  await call(owner,"PATCH","/api/settings/staff",{...staff("Miguel",mid),id:miguel.id},200);
  console.log("PASS reagendar, cancelar, bloqueo individual, horario cerrado, desvincular sesión abierta");
  const legacy = await call(reception,"POST","/api/bookings",book(null,6),201);
  await call(reception,"POST","/api/bookings",book(ana.id,6),409);
  await patch(legacy.booking.id,{action:"assign",staffId:ana.id},200);
  await call(reception,"POST","/api/bookings",book(miguel.id,6),201);
  await call(barber,"PATCH","/api/bookings/"+legacy.booking.id,{action:"status",status:"no_show"},401);
  assert.ok(!(await (await barber.get("/mis-citas")).text()).includes(legacy.booking.id));
  console.log("PASS cita sin asignar bloquea las dos fichas, se asigna y libera la otra; cita ajena denegada");
  const [persisted] = await db`select organization_id,assigned_staff_id from booking where id=${both[0].booking.id}`;
  assert.equal(persisted.assigned_staff_id,miguel.id);
  const [foreign] = await db`insert into organization(id,name) values (${randomUUID()},'Segundo negocio') returning id`;
  const [outsider] = await db`insert into member(id,organization_id,user_id) select ${randomUUID()},${foreign.id},user_id from member where id=${mid} returning id`;
  await call(owner,"PATCH","/api/settings/staff",{...staff("Miguel",outsider.id),id:miguel.id},422);
  const lab = await call(owner,"POST","/api/lab/runs",{},409); console.log("Laboratorio:",lab.error.code);
  await call(owner,"PUT","/api/settings/whatsapp",{wabaId:"WABA-E2E",phoneNumberId:"PN-E2E-1",token:"tok-e2e"},200);
  const phone = "52" + String(stamp).slice(-10);
  const inbound = async text => {
    const waMessageId = "wamid.qa." + randomUUID();
    await call(owner,"POST","/api/dev/wa-mock/inbound",{from:phone,phoneNumberId:"PN-E2E-1",name:"Cliente WA "+stamp,text,waMessageId},200);
    for(let i=0;i<50;i++) {
      const [m] = await db`select conversation_id from message where wa_message_id=${waMessageId}`;
      if(m) return m.conversation_id;
      await new Promise(r=>setTimeout(r,200));
    }
    throw Error("El webhook no persistió el mensaje de prueba");
  };
  const conv = await inbound("Quiero una cita");
  const bot = await request.newContext({baseURL,extraHTTPHeaders:{"X-API-Key":process.env.BOT_API_KEY}}); contexts.push(bot);
  const availability = () => call(bot,"GET","/api/bot/availability?conversationId="+conv,undefined,200);
  const options = await availability(); assert.ok(options.staffOptions.some(p=>p.id===miguel.id));
  await inbound("Quiero cita con Miguel");
  const offers = await availability(); const slot = offers.slots[0]; assert.equal(slot.assignedStaffId,miguel.id);
  const reserve = status=>call(bot,"POST","/api/bot/bookings",{conversationId:conv,startUtc:slot.startUtc},status);
  await reserve(422);
  await inbound("Sí, confirmo la cita con Miguel");
  const booked = await reserve(201);
  const [row] = await db`select assigned_staff_id,is_test from booking where id=${booked.bookingId}`;
  assert.deepEqual([row.assigned_staff_id,row.is_test],[miguel.id,false]);
  assert.ok((await call(reception,"GET","/api/bookings",undefined,200)).bookings.some(b=>b.id===booked.bookingId && b.assignee.id===miguel.id));
  assert.match(await (await barber.get("/mis-citas")).text(),new RegExp(booked.bookingId));
  console.log("PASS WhatsApp simulado → PostgreSQL → ambas agendas", booked.bookingId, miguel.id);
  const browser = await chromium.launch({ ...(process.env.BROWSER_PATH ? { executablePath:process.env.BROWSER_PATH } : {}),headless:true });
  try {
    const mobile = await browser.newContext({ viewport:{width:390,height:844},storageState: await reception.storageState() });
    const pg = await mobile.newPage();
    await pg.goto(baseURL+"/recepcion");
    await pg.getByText("Registrar cliente",{exact:true}).click();
    await pg.locator('input[name="name"]').fill("Móvil "+stamp);
    await pg.locator('input[name="phone"]').fill("51"+String(stamp).slice(-9));
    await pg.getByRole("button",{name:"Guardar cliente"}).click();
    await pg.getByText("Cliente registrado",{exact:true}).waitFor();
    await pg.getByRole("button",{name:"Nueva cita"}).click();
    await pg.locator("#cita-buscar-contacto").fill("Móvil "+stamp);
    await pg.locator("#cita-contacto").selectOption({label:"Móvil "+stamp+" · "+"51"+String(stamp).slice(-9)});
    await pg.locator("#cita-atiende").selectOption(ana.id);
    await pg.locator("#bloqueo-dia").fill(slots[5].dayIso);
    await pg.locator("#bloqueo-hora").fill(slots[5].time);
    const response = pg.waitForResponse(r=>r.url().endsWith("/api/bookings") && r.request().method()==="POST");
    await pg.getByRole("button",{name:"Crear cita",exact:true}).click();
    assert.equal((await response).status(),201);
    const mine = await browser.newContext({ storageState: await barber.storageState() });
    const view = await mine.newPage(); await view.goto(baseURL+"/mis-citas");
    const own = view.locator("li").filter({has:view.locator('input[value="'+booked.bookingId+'"]')});
    await own.getByRole("button",{name:"Atendida"}).click();
    await own.getByRole("button",{name:"Atendida"}).waitFor({state:"detached"});
    assert.equal((await db`select status from booking where id=${booked.bookingId}`)[0].status,"realizada");
    const pending = view.locator("li").filter({has:view.locator('input[value="'+both[0].booking.id+'"]')});
    await pending.getByRole("button",{name:"No asistió"}).click();
    await pending.getByRole("button",{name:"No asistió"}).waitFor({state:"detached"});
    assert.equal((await db`select status from booking where id=${both[0].booking.id}`)[0].status,"no_show");
    const stale = await call(reception,"POST","/api/bookings",book(miguel.id,8),201);
    await view.reload();
    const oldControl = view.locator("li").filter({has:view.locator('input[value="'+stale.booking.id+'"]')}).getByRole("button",{name:"Atendida"});
    await oldControl.waitFor();
    await call(owner,"PATCH","/api/settings/staff",{...staff("Miguel",null),id:miguel.id},200);
    const oldResponse = view.waitForResponse(r=>r.request().method()==="POST");
    await oldControl.click(); await oldResponse;
    assert.equal((await db`select status from booking where id=${stale.booking.id}`)[0].status,"agendada");
    console.log("PASS sesión anterior conserva el bloqueo de escritura al perder el vínculo");
    console.log("PASS recepción móvil 390×844 crea cliente y cita; barbero marca Atendida");
  } finally { await browser.close(); }
  console.log("PASS prueba del contrato del agente: selección, confirmación, PostgreSQL, agenda general y Mis citas",booked.bookingId,miguel.id);
} finally { await Promise.all(contexts.map(c=>c.dispose())); await db.end(); }
