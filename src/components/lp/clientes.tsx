import Image from "next/image";
import { Revela } from "./revela";

// Mesmas imagens da vitrine do site do Revolução AI (src/components/ui/ClientLogos.tsx no repositório do site).
const LOGOS = [
  { nome: "Governo de Minas Gerais", src: "/lp/clientes/minas-gerais.png", w: 1280, h: 270 },
  { nome: "Casoca", src: "/lp/clientes/casoca.png", w: 554, h: 554 },
  { nome: "Bubble Box", src: "/lp/clientes/bubble-box.png", w: 554, h: 554 },
  { nome: "Guedes & Cruz Advogados", src: "/lp/clientes/guedes-cruz.png", w: 303, h: 167 },
  { nome: "GiO Estética Avançada", src: "/lp/clientes/gio-estetica.png", w: 225, h: 225 },
  { nome: "Kanpai", src: "/lp/clientes/kanpai.png", w: 500, h: 500 },
  { nome: "CBM Agro & Gestão de Passivos", src: "/lp/clientes/cbm-agro.png", w: 225, h: 225 },
  { nome: "Bar do Lopes", src: "/lp/clientes/bar-do-lopes.png", w: 225, h: 225 },
];

const PERFIS = [
  { nome: "Patricia Davidson", src: "/lp/clientes/patricia-davidson.png", w: 1170, h: 696 },
  { nome: "Luiz Guedes", src: "/lp/clientes/luiz-guedes.png", w: 1170, h: 467 },
  { nome: "Paulo Bernardo", src: "/lp/clientes/paulo-bernardo.png", w: 1170, h: 463 },
  { nome: "Benjamim Morais", src: "/lp/clientes/benjamim-morais.png", w: 1170, h: 456 },
  { nome: "Andreia Antoniolli", src: "/lp/clientes/andreia-antoniolli.png", w: 1170, h: 913 },
  { nome: "Willian Celso", src: "/lp/clientes/willian-celso.png", w: 1170, h: 835 },
  { nome: "Dra. Ryuza Gonçalves", src: "/lp/clientes/ryuza-goncalves.png", w: 1170, h: 902 },
];

const ALTURA_LOGO = 72;
const ALTURA_PERFIL = 112;

export function Clientes() {
  return (
    <section className="relative overflow-hidden border-t border-lp-line py-20 sm:py-24" aria-labelledby="clientes-titulo">
      <Revela className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="font-lp-mono text-[12px] uppercase tracking-[0.18em] text-lp-accent">Quem está por trás</p>
        <h2 id="clientes-titulo" className="mt-4 font-lp-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
          Centenas de empresas e profissionais{" "}
          <span className="font-lp-serif font-normal italic text-lp-glow">já confiaram no Revolução AI.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-lp-muted">
          O Leadmatic foi criado pelo Revolução AI, que implementa automação comercial e inteligência artificial em negócios de
          portes muito diferentes, de franquias a escritórios de advocacia e clínicas.
        </p>
      </Revela>

      <div className="mt-12 flex flex-col gap-4" aria-label="Clientes atendidos pelo Revolução AI">
        <div className="lp-letreiro">
          <div className="lp-letreiro-faixa gap-4 pr-4" style={{ animationDuration: "48s" }}>
            {[...LOGOS, ...LOGOS].map((c, i) => {
              const largura = Math.min(260, Math.round((c.w / c.h) * ALTURA_LOGO));
              return (
                <div
                  key={`${c.nome}-${i}`}
                  aria-hidden={i >= LOGOS.length}
                  title={c.nome}
                  className="flex shrink-0 items-center justify-center rounded-2xl border border-lp-line bg-lp-surface px-6"
                  style={{ height: ALTURA_LOGO + 32 }}
                >
                  <Image
                    src={c.src}
                    alt={i >= LOGOS.length ? "" : c.nome}
                    width={largura}
                    height={ALTURA_LOGO}
                    className="rounded-md object-contain"
                    style={{ height: ALTURA_LOGO, width: largura }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="lp-letreiro">
          <div className="lp-letreiro-faixa lp-letreiro-reverso gap-4 pr-4" style={{ animationDuration: "56s" }}>
            {[...PERFIS, ...PERFIS].map((c, i) => {
              const largura = Math.round((c.w / c.h) * ALTURA_PERFIL);
              return (
                <div
                  key={`${c.nome}-${i}`}
                  aria-hidden={i >= PERFIS.length}
                  title={c.nome}
                  className="shrink-0 overflow-hidden rounded-2xl border border-lp-line"
                  style={{ height: ALTURA_PERFIL }}
                >
                  <Image
                    src={c.src}
                    alt={i >= PERFIS.length ? "" : c.nome}
                    width={largura}
                    height={ALTURA_PERFIL}
                    className="object-cover opacity-80 saturate-[0.85]"
                    style={{ height: ALTURA_PERFIL, width: largura }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
