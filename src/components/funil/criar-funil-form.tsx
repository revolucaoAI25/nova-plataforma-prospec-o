"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CriarFunilForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const resp = await fetch("/api/funis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const data = await resp.json();
    setLoading(false);
    if (!resp.ok) {
      setErro(data.error || "Não foi possível criar o funil.");
      return;
    }
    setNome("");
    setOpen(false);
    router.push(`/funil/${data.id}`);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus className="h-4 w-4" /> Novo funil
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Input
          autoFocus
          placeholder="Nome do funil (ex: Prospecção SP)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-64"
        />
      </div>
      <Button type="submit" disabled={loading || !nome.trim()}>{loading ? "Criando…" : "Criar"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      {erro && (
        <div className="w-full">
          <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>
        </div>
      )}
    </form>
  );
}
