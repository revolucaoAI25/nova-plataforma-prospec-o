"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, UserCog } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { UserStatsRow } from "@/lib/database.types";
import { formatarExibicao } from "@/lib/phone";

function UserRow({ user, isSelf }: { user: UserStatsRow; isSelf: boolean }) {
  const router = useRouter();
  const [creditos, setCreditos] = useState(user.creditos);
  const [monthlyCreditos, setMonthlyCreditos] = useState(user.monthly_creditos);
  const [instagramVisible, setInstagramVisible] = useState(user.instagram_visible);
  const [linkedinVisible, setLinkedinVisible] = useState(user.linkedin_visible);
  const [disparoHabilitado, setDisparoHabilitado] = useState(user.disparo_habilitado);
  const [emailDisparoHabilitado, setEmailDisparoHabilitado] = useState(user.email_disparo_habilitado);
  const [linkedinDisparoHabilitado, setLinkedinDisparoHabilitado] = useState(user.linkedin_disparo_habilitado);
  const [enriquecimentoIa, setEnriquecimentoIa] = useState(user.enriquecimento_ia_habilitado);
  const [bigdatacorpEnrichment, setBigdatacorpEnrichment] = useState(user.bigdatacorp_enrichment_habilitado);
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
        creditos,
        monthly_creditos: monthlyCreditos,
        instagram_visible: instagramVisible,
        linkedin_visible: linkedinVisible,
        disparo_habilitado: disparoHabilitado,
        email_disparo_habilitado: emailDisparoHabilitado,
        linkedin_disparo_habilitado: linkedinDisparoHabilitado,
        enriquecimento_ia_habilitado: enriquecimentoIa,
        bigdatacorp_enrichment_habilitado: bigdatacorpEnrichment,
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
      <TableCell className="max-w-[240px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground" title={user.nome || user.email}>{user.nome || user.email}</span>
            {user.conta_teste && <Badge variant="outline">Teste</Badge>}
            {user.teste_gratis && <Badge variant="outline">Teste grátis</Badge>}
          </span>
          {user.nome && <span className="truncate text-xs text-muted-foreground" title={user.email}>{user.email}</span>}
          {(user.empresa || user.telefone) && (
            <span className="truncate text-xs text-muted-foreground">
              {[user.empresa, user.telefone && formatarExibicao(user.telefone)].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
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
        <Input type="number" className="h-8 w-24" value={creditos} onChange={(e) => markDirty(setCreditos)(Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Input type="number" className="h-8 w-24" value={monthlyCreditos} onChange={(e) => markDirty(setMonthlyCreditos)(Number(e.target.value))} />
      </TableCell>
      <TableCell>
        <Switch checked={instagramVisible} onCheckedChange={markDirty(setInstagramVisible)} />
      </TableCell>
      <TableCell>
        <Switch checked={linkedinVisible} onCheckedChange={markDirty(setLinkedinVisible)} />
      </TableCell>
      <TableCell>
        <Switch checked={disparoHabilitado} onCheckedChange={markDirty(setDisparoHabilitado)} />
      </TableCell>
      <TableCell>
        <Switch checked={emailDisparoHabilitado} onCheckedChange={markDirty(setEmailDisparoHabilitado)} />
      </TableCell>
      <TableCell>
        <Switch checked={linkedinDisparoHabilitado} onCheckedChange={markDirty(setLinkedinDisparoHabilitado)} disabled={user.conta_teste} />
      </TableCell>
      <TableCell>
        <Switch checked={enriquecimentoIa} onCheckedChange={markDirty(setEnriquecimentoIa)} />
      </TableCell>
      <TableCell>
        <Switch checked={bigdatacorpEnrichment} onCheckedChange={markDirty(setBigdatacorpEnrichment)} />
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{user.total_searches}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{user.total_leads}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button asChild size="sm" variant="ghost" title="Dados do cliente e conta de teste">
            <Link href={`/admin/${user.id}`}>
              <UserCog className="h-4 w-4" />
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Créditos</TableHead>
          <TableHead>Renovação mensal</TableHead>
          <TableHead>Instagram</TableHead>
          <TableHead>LinkedIn</TableHead>
          <TableHead>Disparo</TableHead>
          <TableHead>Disparo E-mail</TableHead>
          <TableHead>Disparo LinkedIn</TableHead>
          <TableHead>Enriq. IA</TableHead>
          <TableHead>Enriq. BigDataCorp</TableHead>
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
  );
}
