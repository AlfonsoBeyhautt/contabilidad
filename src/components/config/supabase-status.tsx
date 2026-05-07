"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pingSupabase } from "@/lib/supabase/health";

type Conn = "idle" | "checking" | "ok" | "fail";

export function SupabaseStatusSection() {
  const configured = isSupabaseConfigured();
  const [conn, setConn] = useState<Conn>(() =>
    configured ? "checking" : "idle",
  );

  useEffect(() => {
    if (!configured) {
      setConn("idle");
      return;
    }
    let cancelled = false;
    setConn("checking");
    pingSupabase()
      .then((ok) => {
        if (!cancelled) setConn(ok ? "ok" : "fail");
      })
      .catch(() => {
        if (!cancelled) setConn("fail");
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const credLabel = configured ? "Variables presentes" : "Sin configurar";
  const connLabel =
    conn === "idle"
      ? "—"
      : conn === "checking"
        ? "Comprobando…"
        : conn === "ok"
          ? "Conectado"
          : "No responde o error";

  return (
    <Card>
      <CardHeader title="Supabase · Postgres" subtitle="Backend del dueño único — sin usuarios externos" />
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-2 text-zinc-700 dark:text-zinc-300">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">
              Credenciales (URL + anon key)
            </dt>
            <dd className="font-medium">
              <span
                className={
                  configured
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-800 dark:text-amber-400"
                }
              >
                {credLabel}
              </span>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Conexión (health_check)</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {connLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Estado en el navegador</dt>
            <dd className="font-medium">
              {configured && conn === "ok"
                ? "Datos en memoria; respaldo local opcional"
                : "Memoria + localStorage si no hay nube"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Persistencia remota</dt>
            <dd className="font-medium">
              {configured && conn === "ok"
                ? "Supabase (el panel lee y escribe aquí)"
                : configured
                  ? "No verificada"
                  : "No usada hasta configurar env"}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          El acceso al panel es con <strong>Supabase Auth</strong> (cuenta propia). Las
          tablas usan RLS: hace falta sesión iniciada. El esquema está pensado para{" "}
          <strong>un solo operador</strong> (sin alta pública de clientes en esta app).
        </p>
      </CardContent>
    </Card>
  );
}
