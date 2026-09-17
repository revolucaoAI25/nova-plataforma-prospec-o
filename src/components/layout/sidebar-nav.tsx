"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection, NavLeaf, NavGroupNode } from "./nav-items";

function isPrefixMatch(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vence o prefixo mais específico — evita que "/disparo" fique ativo junto de "/disparo/solicitar-oficial". */
function findActiveHref(pathname: string, allHrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of allHrefs) {
    if (isPrefixMatch(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

function flattenHrefs(sections: NavSection[]): string[] {
  const hrefs: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.type === "link") hrefs.push(item.href);
      else item.children.forEach((c) => hrefs.push(c.href));
    }
  }
  return hrefs;
}

export function SidebarNav({
  sections,
  collapsed = false,
  onNavigate,
}: {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const allHrefs = useMemo(() => flattenHrefs(sections), [sections]);
  const activeHref = findActiveHref(pathname, allHrefs);

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto p-3">
      {sections.map((section, i) => (
        <div key={section.label ?? `s${i}`} className="flex flex-col gap-0.5">
          {section.label && !collapsed && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
              {section.label}
            </p>
          )}
          {section.items.map((item) =>
            item.type === "link" ? (
              <NavLink
                key={item.href}
                item={item}
                active={item.href === activeHref}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ) : (
              <NavGroup
                key={item.label}
                item={item}
                activeHref={activeHref}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  indent = false,
  onNavigate,
}: {
  item: NavLeaf;
  active: boolean;
  collapsed: boolean;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        indent && "py-1.5 text-[13px]",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className={cn("shrink-0", indent ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {!collapsed && item.label}
    </Link>
  );
}

function NavGroup({
  item,
  activeHref,
  collapsed,
  onNavigate,
}: {
  item: NavGroupNode;
  activeHref: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const hasActiveChild = item.children.some((c) => c.href === activeHref);
  const [open, setOpen] = useState(hasActiveChild);

  // Reabre o grupo automaticamente ao navegar para um filho — ajuste durante
  // a renderização (não em efeito) para não disparar um render extra.
  const [lastHasActiveChild, setLastHasActiveChild] = useState(hasActiveChild);
  if (hasActiveChild !== lastHasActiveChild) {
    setLastHasActiveChild(hasActiveChild);
    if (hasActiveChild) setOpen(true);
  }

  const Icon = item.icon;

  if (collapsed) {
    const target = item.children.find((c) => c.href === activeHref)?.href ?? item.children[0]?.href ?? "#";
    return (
      <Link
        href={target}
        title={item.label}
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-center rounded-xl px-0 py-2 text-sm font-medium transition-colors",
          hasActiveChild
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          hasActiveChild && "text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              active={child.href === activeHref}
              collapsed={false}
              indent
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
