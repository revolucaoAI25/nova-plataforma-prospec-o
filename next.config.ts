import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas: sem embutir a plataforma em
// sites de terceiros (clickjacking), sem adivinhar tipo de arquivo, HTTPS
// obrigatório e sem acesso a câmera/microfone.
const cabecalhosSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
