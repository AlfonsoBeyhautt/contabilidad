import { Suspense } from "react";
import { GastosView } from "@/components/gastos/gastos-view";

export default function GastosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
          Cargando gastos…
        </div>
      }
    >
      <GastosView />
    </Suspense>
  );
}
