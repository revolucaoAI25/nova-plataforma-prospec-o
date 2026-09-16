"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, KeyRound } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { UserStatsRow } from "@/lib/database.types";

function UserRow({ user, isSelf }: { user: UserStatsRow; isSelf: boolean }) {
  const router = useRouter();
  const [cddCredits, setCddCredits] = useState(user.cdd_credits);
  const [monthlyCdd, setMonthlyCdd] = useState(user.monthly_cdd_credits);
  const [mapsCredits, setMapsCredits] = useState(user.maps_credits);
  const [mapsEnabled, setMapsEnabled] = useState(user.maps_credits_enabled);
  const [instagramVisible, setInstagramVisible] = useState(user.instagram_visible);
  const [disparoHabilitado, setDisparoHabilitado] = useState(user.disparo_habilitado);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function salvar() {
    setSaving(true);
    const resp = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cdd_credits: cddCredits,
        monthly_cdd_credits: monthlyCdd,
        maps_credits: mapsCredits,
        maps_credits_enabled: mapsEnabled,
        instagram_visible: instagramVisible,
        disparo_habilitado: disparoHabilitado,
        role,
      }),
    });
    setSaving(false);
    if (resp.ok) {
      setDirty(false);
      router.refresh();
    }
  }

  return (
    <TableRow>
      <TableCell className="max-w-[200px] truncate font-medium">
        {user.email}
        {user.conta_teste && <Badge variant="outline" className="ml-2">Teste</Badge>}
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => markDirty(setRole)(v as "user" | "admin")} disabled={isSelf}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="number" className="h-8 w-24" value={cddCredits} onChange={(e) => markDirty(setCddCredits)(Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" className="h-8 w-24" value={monthlyCdd} onChange={(e) => markDirty(setMonthlyCdd)(Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" className="h-8 w-24" value={mapsCredits} onChange={(e) => markDirty(setMapsCredits)(Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Switch checked={mapsEnabled} onCheckedChange={markDirty(setMapsEnabled)} />
      </TableCell>
      <TableCell>
        <Switch checked={instagramVisible} onCheckedChange={markDirty(setInstagramVisible)} />
      </TableCell>
      <TableCell>
        <Switch checked={disparoHabilitado} onCheckedChange={markDirty(setDisparoHabilitado)} />
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{user.total_searches}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{user.total_leads}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button asChild size="sm" variant="ghost" title="Chaves administradas">
            <Link href={`/admin/${user.id}`}>
              <KeyRound className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || saving} onClick={salvar}>
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminUsersTable({ users, currentUserId }: { users: UserStatsRow[]; currentUserId: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Créditos CNPJ</TableHead>
            <TableHead>Renovação mensal</TableHead>
            <TableHead>Créditos Maps</TableHead>
            <TableHead>Debita Maps?</TableHead>
            <TableHead>Instagram</TableHead>
            <TableHead>Disparo</TableHead>
            <TableHead>Buscas</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
