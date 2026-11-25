import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { listBookings } from "@/server/agenda/queries";
import { statusLabel } from "@/components/bookings/booking-look";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const session = await getSessionOrNull({ allowBarber: true });
  if (!session) redirect("/login");
  if (session.role !== "barber") redirect("/");

  const bookings = await listBookings(session.organizationId, undefined, session.memberId);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Mis citas</h1>
        <SignOutButton />
      </header>
      {bookings.length === 0 ? (
        <p role="status">Todavía no tienes citas asignadas.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((booking) => (
            <li key={booking.id} className="rounded-lg border bg-card p-4">
              <p className="font-medium">{booking.contact?.name || "Sin contacto"}</p>
              <p className="text-sm">{booking.date} · {booking.time} · {statusLabel(booking)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
