"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação irreversível/destrutiva — botão de confirmar fica vermelho. */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Substitui o `window.confirm()` nativo (popup do navegador, fora do tema,
 * bloqueia a thread) por um diálogo consistente com o resto da UI. Um único
 * provider no root layout resolve pra toda a árvore — cada chamador só troca
 * `if (!confirm("..."))` por `if (!(await confirmar({ title: "..." })))`.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null);

  const confirmar = React.useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function responder(v: boolean) {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && responder(false)}>
        {options && (
          <DialogContent hideClose>
            <DialogHeader>
              <div className="flex items-start gap-3">
                {options.destructive && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <DialogTitle>{options.title}</DialogTitle>
                  {options.description && <DialogDescription>{options.description}</DialogDescription>}
                </div>
              </div>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => responder(false)}>
                {options.cancelLabel || "Cancelar"}
              </Button>
              <Button variant={options.destructive ? "destructive" : "default"} size="sm" onClick={() => responder(true)}>
                {options.confirmLabel || "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  return ctx;
}
