"use client";
import { useState } from "react";
export function ReceptionContact() {
  const [message, setMessage] = useState("");
  return <details className="py-3"><summary>Registrar cliente</summary><form className="grid max-w-sm gap-2" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget;
    try {
      const res = await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      setMessage(res.ok ? "Cliente registrado" : (await res.json()).error?.message || "Error al registrar");
      if (res.ok) form.reset();
    } catch { setMessage("No se pudo conectar con Vocero"); }
  }}><label>Nombre <input name="name" required maxLength={120} /></label><label>Teléfono con código de país <input name="phone" type="tel" pattern="[0-9]{7,15}" required /></label><button>Guardar cliente</button><p role="status">{message}</p></form></details>;
}
