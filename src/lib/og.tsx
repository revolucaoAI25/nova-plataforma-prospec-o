import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Imagem de compartilhamento (1200×630) no visual da página de vendas: fundo escuro, verde da marca e a fonte dos títulos. */
export const TAMANHO_OG = { width: 1200, height: 630 };

async function recursos() {
  const [negrito, regular, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-Regular.ttf")),
    readFile(join(process.cwd(), "public/logo.png"), "base64"),
  ]);
  return { negrito, regular, logo: `data:image/png;base64,${logo}` };
}

export async function imagemOg({ selo, titulo, rodape }: { selo: string; titulo: string; rodape: string }) {
  const { negrito, regular, logo } = await recursos();
  const tamanhoTitulo = titulo.length > 90 ? 52 : titulo.length > 60 ? 60 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(90% 90% at 0% 0%, #0f3a22 0%, #050706 60%)",
          color: "#f2f5f3",
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={56} height={56} style={{ borderRadius: 999 }} alt="" />
          <span style={{ fontSize: 34, fontWeight: 700 }}>Leadmatic</span>
          <span
            style={{
              marginLeft: 10,
              fontSize: 22,
              color: "#5dffa0",
              border: "2px solid rgba(93,255,160,0.45)",
              borderRadius: 999,
              padding: "6px 18px",
            }}
          >
            {selo}
          </span>
        </div>
        <div style={{ display: "flex", fontSize: tamanhoTitulo, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1040 }}>
          {titulo}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#9aa69f", fontWeight: 400 }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "#00c853" }} />
          {rodape}
        </div>
      </div>
    ),
    {
      ...TAMANHO_OG,
      fonts: [
        { name: "Bricolage", data: negrito, weight: 700, style: "normal" },
        { name: "Bricolage", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
