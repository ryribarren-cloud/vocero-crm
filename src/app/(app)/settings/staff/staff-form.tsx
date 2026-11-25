"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffForm({ members, positions, person }: { members: { id: string; name: string }[]; positions: { id: string; name: string }[]; person?: { id: string; name: string; memberId: string | null; weeklyHours: import("@/server/agenda/settings").WeeklyHours | null; positionId: string | null; takesAppointments: boolean } }) {
  const router = useRouter();
  const [name, setName] = useState(person?.name ?? "");
  const [memberId, setMemberId] = useState(person?.memberId ?? "");
  const [positionId, setPosition] = useState(person?.positionId ?? "");
  const [eligible, setEligible] = useState(person?.takesAppointments ?? true);
  const weekdays = ["mon","tue","wed","thu","fri","sat","sun"] as const;
  const labels = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  const [custom, setCustom] = useState(!!person?.weeklyHours);
  const [hours, setHours] = useState(weekdays.map(day => (person?.weeklyHours?.[day] ?? []).map(i => i.start + "-" + i.end).join(", ")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/staff", {
        method: person ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weeklyHours: custom ? Object.fromEntries(weekdays.map((d,i) => [d, (hours[i] ?? "").trim() ? (hours[i] ?? "").split(",").map(range => { const [start,end] = range.trim().split("-"); return {start,end}; }) : []])) : null, id: person?.id, name, memberId: memberId || null, positionId: positionId || null, takesAppointments: eligible }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error?.message || "No se pudo guardar");
        return;
      }
      if (!person) { setName(""); setMemberId(""); setPosition(""); setEligible(true); }
      router.refresh();
    } catch {
      setError("No se pudo conectar con Vocero");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border p-4">
      <Label htmlFor={`staff-name-${person?.id ?? "new"}`}>Nombre de quien atiende</Label>
      <Input id={`staff-name-${person?.id ?? "new"}`} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor={`staff-account-${person?.id ?? "new"}`}>Vincular cuenta (opcional)</Label>
      <select id={`staff-account-${person?.id ?? "new"}`} className="block w-full rounded-md border bg-background p-2"
        value={memberId} onChange={(event) => setMemberId(event.target.value)}>
        <option value="">Sin cuenta</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <label className="block">Puesto <select value={positionId} onChange={e => setPosition(e.target.value)}>
        <option value="">Sin puesto</option>{positions.map(pos => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
      </select></label>
      <label className="block"><input type="checkbox" checked={eligible} onChange={e => setEligible(e.target.checked)} /> Atiende citas</label>
      <label className="block"><input type="checkbox" checked={custom} onChange={e => setCustom(e.target.checked)} /> Horario propio</label>
      {custom && <fieldset><legend>Intervalos por día (09:00-13:00, 15:00-18:00). Vacío indica descanso.</legend>{weekdays.map((d,i) => <label className="block" key={d}>{labels[i]} <input value={hours[i]} onChange={e => setHours(hours.map((v,j) => i === j ? e.target.value : v))} /></label>)}</fieldset>}
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      <Button disabled={busy || !name.trim()}>{busy ? "Guardando…" : person ? "Guardar ficha" : "Agregar a plantilla"}</Button>
    </form>
  );
}
