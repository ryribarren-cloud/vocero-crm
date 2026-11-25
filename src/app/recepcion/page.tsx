import { redirect } from "next/navigation";
import BookingsPage from "../(app)/bookings/page";
import { getSessionOrNull } from "@/lib/auth/session";
import { SignOutButton } from "../mis-citas/sign-out-button";
import { ReceptionContact } from "./contact";
export const dynamic = "force-dynamic";
export default async function Reception(props: Parameters<typeof BookingsPage>[0]) {
  const session = await getSessionOrNull({ allowReception: true });
  if (!session) redirect("/login");
  if (session.role !== "reception") redirect("/bookings");
  return <main className="mx-auto max-w-screen-xl p-3"><header className="flex items-center justify-between"><h1>Recepción</h1><SignOutButton /></header><ReceptionContact /><BookingsPage {...props} /></main>;
}
