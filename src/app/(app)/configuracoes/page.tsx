import { redirect } from "next/navigation";

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ sheets?: string }> }) {
  const { sheets } = await searchParams;
  redirect(sheets ? `/conexoes?sheets=${encodeURIComponent(sheets)}#sheets` : "/conexoes");
}
