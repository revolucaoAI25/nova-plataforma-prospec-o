"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatarExibicao } from "@/lib/phone";

export interface DadosClienteValores {
  nome: string | null;
  telefone: string | null;
  empresa: string | null;
}

/**
 * Nome, telefone e empresa do cliente. O mesmo formulário serve o próprio
 * cliente (Meu perfil → PATCH /api/perfil) e o admin (conta do usuário →
 * PATCH /api/admin/users/[id]).
 */
export function DadosClienteForm({ inicial, endpoint, idPrefixo = "dados" }: {
  inicial: DadosClienteValores;
  endpoint: string;
  idPrefixo?: string;
}) {
  const router = useRouter();
  const [valores, setValores] = useState({
    nome: inicial.nome ?? "",
    telefone: inicial.telefone ? formatarExibicao(inicial.telefone) : "",
    empresa: inicial.empresa ?? "",
  });
  const [salvos, setSalvos] = useState(valores);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);

  const alterado = (Object.keys(valores) as (keyof typeof valores)[]).some((k) => valores[k].trim() !== salvos[k].trim());

  function mudar(campo: keyof typeof valores, v: string) {
    setValores((atual) => ({ ...atual, [campo]: v }));
    setAviso(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    const resp = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valores),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    setSalvando(false);
    // Sessão expirada vira redirect pro /login (HTML 200) — só vale o `ok` do JSON.
    if (!resp?.ok || data?.ok !== true) {
      setAviso({ ok: false, msg: data?.error || "Não foi possível salvar. Verifique a conexão (ou entre de novo) e tente outra vez." });
      return;
    }
    const telefone = data?.telefone ? formatarExibicao(data.telefone) : valores.telefone.trim();
    const novos = { nome: valores.nome.trim(), telefone, empresa: valores.empresa.trim() };
    setValores(novos);
    setSalvos(novos);
    setAviso({ ok: true, msg: "Dados salvos." });
    router.refresh();
  }

  const campos = [
    { id: "nome", label: "Nome", tipo: "text", auto: "name", placeholder: "" },
    { id: "telefone", label: "Telefone", tipo: "tel", auto: "tel", placeholder: "(11) 99999-9999" },
    { id: "empresa", label: "Empresa", tipo: "text", auto: "organization", placeholder: "" },
  ] as const;

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${idPrefixo}-${c.id}`}>{c.label}</Label>
            <Input
              id={`${idPrefixo}-${c.id}`} type={c.tipo} autoComplete={c.auto} placeholder={c.placeholder}
              inputMode={c.tipo === "tel" ? "tel" : undefined}
              value={valores[c.id]} onChange={(e) => mudar(c.id, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={!alterado || salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar dados
        </Button>
        {aviso?.ok && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Check className="h-3.5 w-3.5 text-primary" /> {aviso.msg}
          </span>
        )}
      </div>
      {aviso && !aviso.ok && (
        <Alert variant="destructive"><AlertDescription>{aviso.msg}</AlertDescription></Alert>
      )}
    </form>
  );
}
