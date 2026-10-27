"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface RecursosCliente {
  role: "user" | "admin";
  creditos: number;
  monthly_creditos: number;
  instagram_visible: boolean;
  linkedin_visible: boolean;
  disparo_habilitado: boolean;
  email_disparo_habilitado: boolean;
  linkedin_disparo_habilitado: boolean;
  enriquecimento_ia_habilitado: boolean;
  bigdatacorp_enrichment_habilitado: boolean;
  whatsapp_oficial_habilitado: boolean;
}

type Flag = Exclude<keyof RecursosCliente, "role" | "creditos" | "monthly_creditos">;

const FLAGS: { chave: Flag; rotulo: string; dica: string }[] = [
  { chave: "instagram_visible", rotulo: "Busca no Instagram", dica: "Aba de busca de perfis do Instagram." },
  { chave: "linkedin_visible", rotulo: "Busca no LinkedIn", dica: "Aba de busca de perfis do LinkedIn." },
  { chave: "enriquecimento_ia_habilitado", rotulo: "Enriquecimento com IA", dica: "Resumo e dados extras do lead." },
  { chave: "bigdatacorp_enrichment_habilitado", rotulo: "Celular do sócio", dica: "Busca o celular dos sócios pelo CNPJ." },
  { chave: "disparo_habilitado", rotulo: "Disparo WhatsApp", dica: "Campanhas pelo WhatsApp (QR Code)." },
  { chave: "whatsapp_oficial_habilitado", rotulo: "WhatsApp oficial", dica: "Conectar o número pela API oficial." },
  { chave: "email_disparo_habilitado", rotulo: "Disparo de e-mail", dica: "Campanhas por e-mail." },
  { chave: "linkedin_disparo_habilitado", rotulo: "Disparo no LinkedIn", dica: "Convites e mensagens no LinkedIn." },
];

/** Créditos, papel e recursos liberados de um cliente (antes era uma linha da tabela de usuários). */
export function RecursosClienteForm({
  userId, inicial, isSelf, contaTeste,
}: { userId: string; inicial: RecursosCliente; isSelf: boolean; contaTeste: boolean }) {
  const router = useRouter();
  const [valores, setValores] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const alterado = (Object.keys(inicial) as (keyof RecursosCliente)[]).some((k) => valores[k] !== inicial[k]);

  function mudar<K extends keyof RecursosCliente>(chave: K, valor: RecursosCliente[K]) {
    setValores((v) => ({ ...v, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const resp = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valores),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setSalvando(false);
    if (!resp?.ok) return setErro(json?.error ?? "Não foi possível salvar.");
    setSalvo(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Créditos e recursos</CardTitle>
        <CardDescription>O que a conta pode usar. A assinatura ajusta isso sozinha quando o plano muda; aqui é para exceções.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-creditos">Créditos agora</Label>
            <Input id="rc-creditos" type="number" min={0} value={valores.creditos} onChange={(e) => mudar("creditos", Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-mensal">Renovação mensal</Label>
            <Input id="rc-mensal" type="number" min={0} value={valores.monthly_creditos} onChange={(e) => mudar("monthly_creditos", Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rc-papel">Papel</Label>
            <Select value={valores.role} onValueChange={(v) => mudar("role", v as RecursosCliente["role"])} disabled={isSelf}>
              <SelectTrigger id="rc-papel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Cliente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {FLAGS.map(({ chave, rotulo, dica }) => {
            const bloqueado = chave === "linkedin_disparo_habilitado" && contaTeste;
            return (
              <label key={chave} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 hover:bg-secondary/50">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{rotulo}</span>
                  <span className="block text-xs text-muted-foreground">{bloqueado ? "Indisponível em conta de teste." : dica}</span>
                </span>
                <Switch checked={valores[chave]} onCheckedChange={(v) => mudar(chave, v)} disabled={bloqueado} />
              </label>
            );
          })}
        </div>

        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        <div className="flex items-center gap-3">
          <Button onClick={salvar} disabled={!alterado || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
          </Button>
          {salvo && !alterado && (
            <span className="flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" /> Salvo</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
