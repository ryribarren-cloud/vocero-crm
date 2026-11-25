"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffForm({ members }: { members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, memberId: memberId || null }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error?.message || "No se pudo guardar");
        return;
      }
      setName("");
      setMemberId("");
      router.refresh();
    } catch {
      setError("No se pudo conectar con Vocero");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border p-4">
      <Label htmlFor="staff-name">Nombre de quien atiende</Label>
      <Input id="staff-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor="staff-account">Vincular cuenta (opcional)</Label>
      <select id="staff-account" className="block w-full rounded-md border bg-background p-2"
        value={memberId} onChange={(event) => setMemberId(event.target.value)}>
        <option value="">Sin cuenta</option>
        {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      <Button disabled={busy || !name.trim()}>{busy ? "Guardando…" : "Agregar a plantilla"}</Button>
    </form>
  );
}
