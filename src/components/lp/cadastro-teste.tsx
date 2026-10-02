"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, Eye, EyeOff, Loader2, Lock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Campo, estiloInput, mascararTelefone } from "./checkout";
import { num } from "./dados";

const BLOQUEADOS = ["Estratégia de prospecção criada por IA", "Disparos por WhatsApp, e-mail e LinkedIn", "Funil, automações e cadências", "Enriquecimento e contato do decisor"];

export function CadastroTeste({ creditos }: { creditos: number }) {
  const router = useRouter();
  // Com créditos de teste (padrão 100), o teste extrai empresas; se o admin
  // zerar os créditos, o teste serve só para conhecer a plataforma.
  const extrai = creditos > 0;
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", empresa: "", senha: "", site: "" });
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; entrar?: boolean } | null>(null);

  const mudar = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = campo === "telefone" ? mascararTelefone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [campo]: v }));
    setErro(null);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resp = await fetch("/api/teste-gratis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = await resp?.json().catch(() => ({}));
    if (!resp?.ok || data?.ok !== true) {
      setEnviando(false);
      setErro({ msg: data?.error || "Não foi possível concluir agora. Verifique a conexão e tente novamente.", entrar: data?.entrar });
      return;
    }
    router.push(data.proximo || "/");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      <div>
        <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Teste grátis</p>
        <h1 className="mt-3 font-lp-display text-4xl font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-5xl">
          {extrai ? "Veja a qualidade dos contatos" : "Conheça o Leadmatic por dentro"}{" "}
          <span className="font-lp-serif font-normal italic text-lp-glow">antes de assinar.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-lp-muted">
          {extrai
            ? "Crie a sua conta e extraia empresas do seu público por CNPJ ou Google Maps. Sem cartão e sem compromisso."
            : "Crie a sua conta e explore as buscas, os disparos, o funil e as automações. Sem cartão e sem compromisso."}
        </p>

        <form onSubmit={enviar} className="mt-8 flex flex-col gap-5 rounded-[28px] border border-lp-line bg-lp-surface p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo id="tg-nome" rotulo="Nome completo">
              <input id="tg-nome" required minLength={3} autoComplete="name" value={form.nome} onChange={mudar("nome")} className={estiloInput} />
            </Campo>
            <Campo id="tg-empresa" rotulo="Empresa">
              <input id="tg-empresa" required minLength={2} autoComplete="organization" value={form.empresa} onChange={mudar("empresa")} className={estiloInput} />
            </Campo>
            <Campo id="tg-email" rotulo="E-mail" ajuda="Será o seu login na plataforma.">
              <input id="tg-email" type="email" required autoComplete="email" value={form.email} onChange={mudar("email")} className={estiloInput} />
            </Campo>
            <Campo id="tg-telefone" rotulo="WhatsApp">
              <input
                id="tg-telefone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="(11) 99999-9999"
                value={form.telefone} onChange={mudar("telefone")} className={estiloInput}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo id="tg-senha" rotulo="Crie uma senha" ajuda="Mínimo de 8 caracteres.">
                <div className="relative">
                  <input
                    id="tg-senha" type={verSenha ? "text" : "password"} required minLength={8} autoComplete="new-password"
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
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="tg-site">Site</label>
            <input id="tg-site" tabIndex={-1} autoComplete="off" value={form.site} onChange={mudar("site")} />
          </div>

          {erro && (
            <div role="alert" className="rounded-xl border border-lp-warn/40 bg-lp-warn/10 px-4 py-3 text-sm text-[#ffb59f]">
              {erro.msg}
              {erro.entrar && (
                <>
                  {" "}
                  <Link href="/login" className="font-semibold text-lp-text underline underline-offset-4">Entrar agora</Link>
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
            {enviando ? "Criando a sua conta…" : "Começar o teste grátis"}
            {!enviando && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />}
          </button>
          <p className="text-center text-[12.5px] leading-relaxed text-lp-muted-2">
            Um teste por pessoa. Nenhuma cobrança é feita no teste grátis.
          </p>
        </form>
      </div>

      <aside>
        <div className="flex flex-col gap-5 rounded-[28px] border border-lp-accent/40 bg-gradient-to-b from-[#0c2318] to-lp-surface p-6 shadow-[0_30px_80px_-40px_rgba(0,200,83,0.6)] sm:p-7 lg:sticky lg:top-8">
          {extrai ? (
            <>
              <div>
                <p className="font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">Incluído no teste</p>
                <p className="mt-2 lp-numero font-lp-display text-3xl font-extrabold tracking-tight text-lp-glow">{num(creditos)} créditos</p>
                <p className="mt-1 text-sm text-lp-muted">para extrair empresas do seu público e ver os contatos que a plataforma encontra.</p>
              </div>
              <ul className="flex flex-col gap-2.5 border-t border-lp-line pt-4">
                <li className="flex items-start gap-2.5 text-[14px] text-lp-text/90"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-lp-accent" /> Busca de empresas por CNPJ</li>
                <li className="flex items-start gap-2.5 text-[14px] text-lp-text/90"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lp-accent" /> Busca de empresas no Google Maps</li>
                <li className="flex items-start gap-2.5 text-[14px] text-lp-text/90"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lp-accent" /> Histórico com os contatos extraídos</li>
              </ul>
            </>
          ) : (
            <div>
              <p className="font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted">Incluído no teste</p>
              <p className="mt-2 font-lp-display text-2xl font-extrabold tracking-tight text-lp-glow">Acesso a todas as telas</p>
              <p className="mt-1 text-sm text-lp-muted">Navegue pelas buscas, pelos disparos, pelo funil e pelas automações e veja como a prospecção funciona antes de contratar.</p>
            </div>
          )}
          <div className="border-t border-lp-line pt-4">
            <p className="font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-muted-2">Liberado ao assinar</p>
            <ul className="mt-3 flex flex-col gap-2">
              {(extrai ? BLOQUEADOS : ["Créditos para extrair empresas por CNPJ, Google Maps, Instagram e LinkedIn", ...BLOQUEADOS]).map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-[13.5px] text-lp-muted">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-muted-2" /> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
