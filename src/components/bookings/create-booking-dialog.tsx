"use client";

import { useEffect, useState } from "react";
import { blockStartUtc } from "@/lib/time/calendar";
import type { ContactDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600];

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function CreateBookingDialog({
  kind,
  assignees,
  initialDay,
  initialTime,
  timezone,
  onCancel,
  onCreated,
}: {
  kind: "block" | "session";
  assignees: { id: string; name: string }[];
  initialDay: string;
  initialTime: string;
  timezone: string;
  onCancel: () => void;
  onCreated: (day: string) => void;
}) {
  const isSession = kind === "session";
  const [assignee, setAssignee] = useState("");
  const [query, setQuery] = useState("");
  const [contactId, setContactId] = useState("");
  const [results, setResults] = useState<{ query: string; contacts: ContactDto[] | null } | null>(null);
  const contacts = results?.query === query ? results.contacts : undefined;
  const [day, setDay] = useState(initialDay);
  const [time, setTime] = useState(initialTime);
  const [minutes, setMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    if (!isSession) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim() });
      try {
        const res = await fetch(`/api/contacts?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("No se pudieron cargar los contactos");
        const data = (await res.json()) as { contacts: ContactDto[] };
        if (!controller.signal.aborted) setResults({ query, contacts: data.contacts });
      } catch {
        if (!controller.signal.aborted) setResults({ query, contacts: null });
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isSession, query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (isSession && !contactId)) return;
    // Interpretar la hora en la zona del negocio.
    const startUtc = blockStartUtc(day, time, timezone);
    if (!startUtc) {
      setError("Esa hora no existe en la zona del negocio");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startUtc,
        notes: notes.trim() || null,
        ...(isSession ? { kind, contactId, assignedStaffId: assignee || null } : { kind, durationMinutes: minutes, assignedStaffId: assignee || null }),
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status !== 201) {
      const data = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? (isSession ? "No se pudo crear la cita" : "No se pudo bloquear ese horario"));
      return;
    }
    onCreated(day);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crear-reserva-titulo"
      onClick={busy ? undefined : onCancel}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] overflow-y-auto w-full max-w-sm space-y-4 rounded-lg border bg-popover p-5 shadow-pop"
      >
        <div>
          <h3 id="crear-reserva-titulo" className="text-[16px] font-bold">
            {isSession ? "Nueva cita" : "Bloquear horario"}
          </h3>
          {!isSession && (
            <p className="mt-1 text-sm text-text-3">
              Para compromisos que viven fuera del CRM: ese tiempo deja de ofrecerse.
            </p>
          )}
        </div>

        {isSession && (
          <div className="space-y-1.5">
            <Label htmlFor="cita-buscar-contacto">Buscar contacto</Label>
            <Input
              id="cita-buscar-contacto"
              value={query}
              placeholder="Nombre o teléfono"
              onChange={(e) => {
                setContactId("");
                setQuery(e.target.value);
              }}
            />
            <Label htmlFor="cita-contacto">Contacto</Label>
            <select
              id="cita-contacto"
              required
              value={contactId}
              disabled={!contacts?.length}
              onChange={(e) => setContactId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {contacts === undefined ? "Cargando contactos…" : contacts === null
                  ? "No se pudieron cargar los contactos" : contacts.length
                    ? "Elige un contacto" : "No hay contactos para esta búsqueda"}
              </option>
              {contacts?.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}{contact.phone ? ` · ${contact.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {(
          <div className="space-y-1.5">
            <Label htmlFor="cita-atiende">Atiende</Label>
            <select id="cita-atiende" value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Sin asignar</option>
              {assignees.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bloqueo-dia">Día</Label>
            <Input id="bloqueo-dia" type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bloqueo-hora">Hora</Label>
            <Input
              id="bloqueo-hora"
              type="time"
              required
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {!isSession && (
          <div className="space-y-1.5">
            <Label htmlFor="bloqueo-duracion">Duración</Label>
            <select
              id="bloqueo-duracion"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="bloqueo-nota">{isSession ? "Nota (opcional)" : "Motivo (opcional)"}</Label>
          <Input
            id="bloqueo-nota"
            value={notes}
            maxLength={120}
            placeholder={isSession ? undefined : "Comida con proveedor"}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <p className="text-xs text-text-3">Hora de la zona del negocio ({timezone}).</p>

        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !day || !time || (isSession && !contactId)}>
            {isSession ? (busy ? "Guardando…" : "Crear cita") : (busy ? "Bloqueando…" : "Bloquear")}
          </Button>
        </div>
      </form>
    </div>
  );
}
