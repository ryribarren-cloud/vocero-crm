/** Acepta respuestas afirmativas completas y rechaza correcciones o cambios de responsable. */
export function confirmsStaffBooking(message: string, staffName: string): boolean {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[.,¡!¿?]/g, " ").trim().replace(/\s+/g, " ");
  const text = normalize(message);
  const suffix = " con " + normalize(staffName);
  const reply = text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;
  return /^(?:si(?: confirmo)?|confirmo|confirmado|de acuerdo|adelante|correcto|dale|ok)(?: la cita)?$/.test(reply);
}
