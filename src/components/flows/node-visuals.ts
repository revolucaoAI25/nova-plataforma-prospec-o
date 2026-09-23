import {
  CalendarClock, Filter, Sheet, FileSpreadsheet, Play, Building2, MapPin, MapPinned, AtSign,
  UserSearch, History, BrainCircuit, SlidersHorizontal, Hourglass, Send, Mail, type LucideIcon,
} from "lucide-react";
import type { LucideIconName, FlowNodeCategoria } from "@/lib/flow/node-types";

export const FLOW_NODE_ICONS: Record<LucideIconName, LucideIcon> = {
  CalendarClock, Filter, Sheet, FileSpreadsheet, Play, Building2, MapPin, MapPinned, AtSign,
  UserSearch, History, BrainCircuit, SlidersHorizontal, Hourglass, Send, Mail,
};

export const FLOW_CATEGORIA_CORES: Record<FlowNodeCategoria, { border: string; bg: string; text: string; dot: string }> = {
  gatilho: { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  extracao: { border: "border-sky-500/40", bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400" },
  enriquecimento: { border: "border-violet-500/40", bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
  controle: { border: "border-orange-500/40", bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  disparo: { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  destino: { border: "border-fuchsia-500/40", bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", dot: "bg-fuchsia-400" },
};
