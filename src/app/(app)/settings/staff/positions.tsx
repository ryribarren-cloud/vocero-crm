"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Positions({ positions }: { positions: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return <details><summary>Puestos del negocio</summary>
    {[...positions, { id: "", name: "" }].map(p => <form className="flex flex-wrap gap-2 py-2" key={p.id} onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      try {
        const response = await fetch("/api/settings/positions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id || undefined, name: new FormData(form).get("name") }) });
        if (!response.ok) { setError((await response.json()).error?.message || "Error al guardar"); return; }
        setError(""); if (!p.id) form.reset(); router.refresh();
      } catch { setError("No se pudo conectar con Vocero"); }
    }}><input aria-label={p.name || "Nuevo puesto"} required maxLength={120} name="name" defaultValue={p.name} /><button>{p.id ? "Renombrar" : "Crear puesto"}</button></form>)}
    {error && <p role="alert">{error}</p>}
  </details>;
}
