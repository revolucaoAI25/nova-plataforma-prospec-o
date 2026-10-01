"use client";

import { Clock, Mail, MessageCircle, Contact, MessagesSquare, FlaskConical } from "lucide-react";
import type { MensagensPlano } from "@/lib/onboarding/ia";

function atraso(horas: number): string {
  if (horas <= 0) return "Logo na entrada";
  if (horas < 24) return `${horas}h depois`;
  const dias = Math.round(horas / 24);
  return `${dias} dia${dias > 1 ? "s" : ""} depois`;
}

/** Destaca {{variaveis}} pra ficar claro o que é personalizado por lead. */
function ComVariaveis({ texto }: { texto: string }) {
  const partes = texto.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {partes.map((parte, i) =>
        /^\{\{[^}]+\}\}$/.test(parte) ? (
          <span key={i} className="rounded bg-info-soft px-1 font-mono text-[0.8em] text-info" title={parte.includes("|") ? `Se vier vazio: "${parte.slice(2, -2).split("|")[1]}"` : undefined}>
            {parte.slice(2, -2).split("|")[0]}
          </span>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}

function Rotulo({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /> {children}
    </p>
  );
}

export function MensagensPreview({ mensagens }: { mensagens: MensagensPlano }) {
  const temAlgo = mensagens.whatsapp.length || mensagens.email.length || mensagens.linkedinNota || mensagens.linkedinMensagens.length || mensagens.roteiroDm;
  if (!temAlgo) return <p className="text-sm text-muted-foreground">Esta sugestão não envia mensagens automáticas.</p>;
  // Sugestões geradas antes do teste A/B não têm o campo.
  const ab = mensagens.testeAB ?? null;

  return (
    <div className="flex flex-col gap-6">
      {mensagens.whatsapp.length > 0 && (
        <div className="flex flex-col gap-3">
          <Rotulo icon={MessageCircle}>WhatsApp</Rotulo>
          <div className="flex flex-col gap-3 rounded-2xl bg-secondary/40 p-4">
            {mensagens.whatsapp.map((m, i) => (
              <div key={i} className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1 text-[11px] text-muted-2"><Clock className="h-3 w-3" /> {atraso(m.atrasoHoras)}</span>
                <div className="max-w-[92%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-primary/15 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                  <ComVariaveis texto={m.texto} />
                </div>
                {i === 0 && ab?.whatsappAbertura && (
                  <div className="mt-1 flex max-w-[92%] flex-col items-end gap-1">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-primary"><FlaskConical className="h-3 w-3" /> Versão B (metade dos leads)</span>
                    <div className="whitespace-pre-line rounded-2xl rounded-tr-sm border border-dashed border-primary/40 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                      <ComVariaveis texto={ab.whatsappAbertura} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mensagens.email.length > 0 && (
        <div className="flex flex-col gap-3">
          <Rotulo icon={Mail}>E-mail</Rotulo>
          {mensagens.email.map((m, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2">
                <span className="flex flex-col text-sm font-semibold text-foreground">
                  <ComVariaveis texto={m.assunto} />
                  {i === 0 && ab?.emailAssunto && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary"><FlaskConical className="h-3 w-3" /> Assunto B: <ComVariaveis texto={ab.emailAssunto} /></span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-2"><Clock className="h-3 w-3" /> {atraso(m.atrasoHoras)}</span>
              </div>
              <p className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-foreground"><ComVariaveis texto={m.corpo} /></p>
            </div>
          ))}
        </div>
      )}

      {(mensagens.linkedinNota || mensagens.linkedinMensagens.length > 0) && (
        <div className="flex flex-col gap-3">
          <Rotulo icon={Contact}>LinkedIn</Rotulo>
          {mensagens.linkedinNota && (
            <div className="rounded-xl border border-dashed border-border px-4 py-3">
              <p className="mb-1 text-[11px] font-medium text-muted-2">Nota do convite</p>
              <p className="text-sm text-foreground"><ComVariaveis texto={mensagens.linkedinNota} /></p>
              {ab?.linkedinNota && (
                <p className="mt-2 border-t border-dashed border-border pt-2 text-sm text-foreground">
                  <span className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-primary"><FlaskConical className="h-3 w-3" /> Nota B (metade dos convites)</span>
                  <ComVariaveis texto={ab.linkedinNota} />
                </p>
              )}
            </div>
          )}
          {mensagens.linkedinMensagens.map((m, i) => (
            <div key={i} className="rounded-xl border border-border px-4 py-3">
              <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-2"><Clock className="h-3 w-3" /> Após o aceite · {atraso(m.atrasoHoras)}</p>
              <p className="whitespace-pre-line text-sm text-foreground"><ComVariaveis texto={m.texto} /></p>
            </div>
          ))}
        </div>
      )}

      {mensagens.roteiroDm && (
        <div className="flex flex-col gap-3">
          <Rotulo icon={MessagesSquare}>Roteiro de abordagem manual</Rotulo>
          <p className="whitespace-pre-line rounded-xl border border-border px-4 py-3 text-sm leading-relaxed text-foreground">
            <ComVariaveis texto={mensagens.roteiroDm} />
          </p>
        </div>
      )}
      <p className="text-xs text-muted-2">
        Trechos em <span className="rounded bg-info-soft px-1 font-mono text-info">azul</span> são trocados pelos dados de cada lead. Você edita tudo na campanha depois de usar a sugestão.
      </p>
    </div>
  );
}
