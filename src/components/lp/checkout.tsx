"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { mascararCpfCnpj } from "@/lib/cpf-cnpj";
import { brl, num, type PlanoLP } from "./dados";

function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const ETAPAS = [
  ["Crie a sua conta", "Preencha os dados do formulário. Leva menos de um minuto."],
  ["Conclua o pagamento", "Por Pix, boleto ou cartão, em ambiente seguro."],
  ["Comece a prospectar", "Com o pagamento confirmado, os créditos são liberados e a IA monta a sua estratégia."],
] as const;

const SEMPRE = ["Busca por CNPJ e Google Maps", "Estratégia criada por IA", "Funil, automações e cadências"];

function Campo({
  id, rotulo, ajuda, children,
}: { id: string; rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-lp-text">{rotulo}</label>
      {children}
      {ajuda && <p className="text-[12.5px] text-lp-muted-2">{ajuda}</p>}
    </div>
  );
}

const estiloInput =
  "h-12 w-full rounded-xl border border-lp-line-2 bg-lp-bg/60 px-4 text-base text-lp-text sm:text-[15px] outline-none transition-colors placeholder:text-lp-muted-2 focus:border-lp-accent/70 focus:bg-lp-bg";

export function Checkout({
  planos, planoInicial, cicloInicial,
}: {
  planos: PlanoLP[];
  planoInicial: string | null;
  cicloInicial: "mensal" | "anual";
}) {
  const router = useRouter();
  const recomendado = planos[Math.floor(planos.length / 2)]?.id;
  const [planoId, setPlanoId] = useState(planos.some((p) => p.id === planoInicial) ? (planoInicial as string) : recomendado);
  const plano = planos.find((p) => p.id === planoId) ?? planos[0];
  const temAnual = planos.some((p) => p.precoAnual);
  const [ciclo, setCiclo] = useState<"mensal" | "anual">(cicloInicial);
  const anual = ciclo === "anual" && plano.precoAnual !== null;

  const [form, setForm] = useState({ nome: "", email: "", telefone: "", empresa: "", cpfCnpj: "", senha: "", site: "" });
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; entrar?: boolean } | null>(null);

  const mudar = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (campo === "telefone") v = mascararTelefone(v);
    if (campo === "cpfCnpj") v = mascararCpfCnpj(v);
    setForm((f) => ({ ...f, [campo]: v }));
    setErro(null);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resp = await fetch("/api/assinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, planId: plano.id, ciclo: anual ? "anual" : "mensal" }),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    if (!resp?.ok || data?.ok !== true) {
      setEnviando(false);
      setErro({ msg: data?.error || "Não foi possível concluir agora. Verifique a conexão e tente novamente.", entrar: data?.entrar });
      return;
    }
    router.push(data.proximo || "/bem-vindo");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      <div>
        <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Contratação</p>
        <h1 className="mt-3 font-lp-display text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-5xl">
          Crie a sua conta{" "}
          <span className="font-lp-serif font-normal italic text-lp-glow">e comece hoje.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-lp-muted">
          Preencha os dados abaixo. Em seguida, você será direcionado para o pagamento e, assim que ele for confirmado, o acesso é liberado.
        </p>

        <form onSubmit={enviar} className="mt-8 flex flex-col gap-5 rounded-[28px] border border-lp-line bg-lp-surface p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo id="ck-nome" rotulo="Nome completo">
              <input id="ck-nome" required minLength={3} autoComplete="name" value={form.nome} onChange={mudar("nome")} className={estiloInput} />
            </Campo>
            <Campo id="ck-empresa" rotulo="Empresa">
              <input id="ck-empresa" required minLength={2} autoComplete="organization" value={form.empresa} onChange={mudar("empresa")} className={estiloInput} />
            </Campo>
            <Campo id="ck-email" rotulo="E-mail" ajuda="Será o seu login na plataforma.">
              <input id="ck-email" type="email" required autoComplete="email" value={form.email} onChange={mudar("email")} className={estiloInput} />
            </Campo>
            <Campo id="ck-telefone" rotulo="WhatsApp">
              <input
                id="ck-telefone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="(11) 99999-9999"
                value={form.telefone} onChange={mudar("telefone")} className={estiloInput}
              />
            </Campo>
            <Campo id="ck-doc" rotulo="CPF ou CNPJ" ajuda="Usado apenas para emitir a cobrança.">
              <input
                id="ck-doc" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                value={form.cpfCnpj} onChange={mudar("cpfCnpj")} className={estiloInput}
              />
            </Campo>
            <Campo id="ck-senha" rotulo="Crie uma senha" ajuda="Mínimo de 8 caracteres.">
              <div className="relative">
                <input
                  id="ck-senha" type={verSenha ? "text" : "password"} required minLength={8} autoComplete="new-password"
                  value={form.senha} onChange={mudar("senha")} className={cn(estiloInput, "pr-12")}
                />
                <button
                  type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-lp-muted transition-colors hover:text-lp-text"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Campo>
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="ck-site">Site</label>
            <input id="ck-site" tabIndex={-1} autoComplete="off" value={form.site} onChange={mudar("site")} />
          </div>

          {erro && (
            <div role="alert" className="rounded-xl border border-lp-warn/40 bg-lp-warn/10 px-4 py-3 text-sm text-[#ffb59f]">
              {erro.msg}
              {erro.entrar && (
                <>
                  {" "}
                  <Link href="/login?next=/creditos" className="font-semibold text-lp-text underline underline-offset-4">Entrar agora</Link>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lp-accent px-6 text-base font-semibold text-[#04140a] shadow-[0_18px_50px_-14px_rgba(0,200,83,0.7)] transition-colors hover:bg-lp-glow disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lp-glow"
          >
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {enviando ? "Criando a sua conta…" : "Criar conta e ir para o pagamento"}
            {!enviando && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />}
          </button>
          <p className="text-center text-[12.5px] leading-relaxed text-lp-muted-2">
            Ao continuar, você autoriza a cobrança {anual ? "anual" : "mensal"} do plano {plano.nome}.
            {anual ? " A renovação acontece a cada 12 meses." : " O plano mensal pode ser cancelado a qualquer momento, sem multa."}
          </p>
        </form>
      </div>

      <aside>
        <div className="flex flex-col gap-5 rounded-[28px] border border-lp-accent/40 bg-gradient-to-b from-[#0c2318] to-lp-surface p-6 shadow-[0_30px_80px_-40px_rgba(0,200,83,0.6)] sm:p-7 lg:sticky lg:top-8">
          <div className="flex items-center justify-between gap-3">
            <p className="font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">Plano escolhido</p>
            {temAnual && (
              <div className="inline-flex rounded-full border border-lp-line-2 bg-lp-bg/60 p-0.5" role="radiogroup" aria-label="Forma de cobrança">
                {(["mensal", "anual"] as const).map((c) => (
                  <button
                    key={c} type="button" role="radio" aria-checked={ciclo === c} onClick={() => setCiclo(c)}
                    className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors", ciclo === c ? "bg-lp-accent text-[#04140a]" : "text-lp-muted hover:text-lp-text")}
                  >
                    {c === "mensal" ? "Mensal" : "Anual"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2" role="radiogroup" aria-label="Plano">
            {planos.map((p) => {
              const ativo = p.id === plano.id;
              const preco = ciclo === "anual" && p.precoAnual ? p.precoAnual / 12 : p.precoMes;
              return (
                <button
                  key={p.id} type="button" role="radio" aria-checked={ativo} onClick={() => setPlanoId(p.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    ativo ? "border-lp-accent bg-lp-accent-soft" : "border-lp-line bg-lp-bg/40 hover:border-lp-line-2",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", ativo ? "border-lp-glow bg-lp-accent text-[#04140a]" : "border-lp-line-2")}>
                      {ativo && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block font-lp-display text-base font-bold">{p.nome}</span>
                      <span className="block text-[12px] text-lp-muted">{num(p.creditosMes)} créditos por mês</span>
                    </span>
                  </span>
                  <span className="lp-numero text-right text-sm font-semibold">
                    {brl(preco)}<span className="text-lp-muted">/mês</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-lp-line bg-lp-bg/50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-lp-muted">{anual ? "Total anual" : "Total mensal"}</span>
              <span className="lp-numero font-lp-display text-2xl font-extrabold">{brl(anual ? (plano.precoAnual as number) : plano.precoMes)}</span>
            </div>
            <ul className="mt-4 flex flex-col gap-2 border-t border-lp-line pt-4">
              {[...SEMPRE, ...plano.recursos].map((r) => (
                <li key={r} className="flex items-start gap-2 text-[13.5px] text-lp-text/90">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-accent" /> {r}
                </li>
              ))}
            </ul>
          </div>

          <ol className="flex flex-col gap-3">
            {ETAPAS.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-lp-accent/40 font-lp-mono text-[11px] text-lp-glow">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold text-lp-text">{titulo}</span>
                  <span className="block text-[12.5px] leading-relaxed text-lp-muted">{texto}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="flex items-center gap-2 text-[12.5px] text-lp-muted-2">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Pagamento seguro, com Pix, boleto ou cartão de crédito.
          </p>
        </div>
      </aside>
    </div>
  );
}
