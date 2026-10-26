"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Troca de senha em Meu perfil: pede a atual e encerra as sessões em outros aparelhos. */
export function AlterarSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (nova.length < 8) return setAviso({ tipo: "erro", texto: "A nova senha precisa ter pelo menos 8 caracteres." });
    if (nova !== confirmacao) return setAviso({ tipo: "erro", texto: "A confirmação não é igual à nova senha." });
    setSalvando(true);
    const resp = await fetch("/api/perfil/senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atual, nova }),
    }).catch(() => null);
    const json = await resp?.json().catch(() => null);
    setSalvando(false);
    if (!resp?.ok) return setAviso({ tipo: "erro", texto: json?.error ?? "Não foi possível trocar a senha agora." });
    setAtual("");
    setNova("");
    setConfirmacao("");
    setAviso({ tipo: "ok", texto: "Senha trocada. As sessões em outros aparelhos foram encerradas." });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><KeyRound className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Senha</h2>
          <p className="text-xs text-muted-foreground">Para trocar, confirme a senha atual.</p>
        </div>
      </div>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {aviso && (
          <Alert variant={aviso.tipo === "ok" ? "success" : "destructive"}>
            <AlertDescription>{aviso.texto}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha-atual">Senha atual</Label>
            <Input id="senha-atual" type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha-nova">Nova senha</Label>
            <Input id="senha-nova" type="password" autoComplete="new-password" required minLength={8} value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha-confirmacao">Confirme a nova senha</Label>
            <Input id="senha-confirmacao" type="password" autoComplete="new-password" required minLength={8} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Trocar senha"}</Button>
        </div>
      </form>
    </section>
  );
}
