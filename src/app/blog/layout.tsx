import type { Metadata } from "next";
import { RodapeBlog } from "@/components/blog/estrutura";
import { FONTES_LP } from "@/app/conheca/fontes";
import "./blog.css";

export const metadata: Metadata = {
  title: { default: "Blog do Leadmatic", template: "%s · Blog do Leadmatic" },
  alternates: { types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: "Blog do Leadmatic" }] } },
};

export default function BlogLayout({ children }: LayoutProps<"/blog">) {
  return (
    <div className={`${FONTES_LP} flex min-h-dvh flex-col bg-background text-foreground`}>
      <div className="flex-1">{children}</div>
      <RodapeBlog />
    </div>
  );
}
