import { expect, it } from "vitest";
import { confirmsStaffBooking } from "@/server/agenda/staff-confirmation";
it("confirma la oferta vigente y pide aclaración ante cambios", () => {
  expect(confirmsStaffBooking("Sí, confirmo la cita con Miguel", "Miguel")).toBe(true);
  expect(confirmsStaffBooking("Sí, pero con Ana", "Miguel")).toBe(false);
  expect(confirmsStaffBooking("No confirmo", "Miguel")).toBe(false);
});
