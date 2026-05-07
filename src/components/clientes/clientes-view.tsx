"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAppData } from "@/contexts/data-context";
import { customerMetrics } from "@/lib/data/finance-calcs";
import type { Customer } from "@/lib/data/types";
import { formatCurrency, formatDate } from "@/lib/format";

export function ClientesView() {
  const { data, addCustomer, updateCustomer, deleteCustomer } = useAppData();
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<
    "todos" | "frecuente" | "nuevo" | "inactivo"
  >("todos");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const rows = useMemo(() => {
    return data.customers
      .map((c) => ({
        c,
        ...customerMetrics(c, data.sales, data.products),
      }))
      .filter(({ c, segment: seg }) => {
        const notes = (c.notes ?? "").toLowerCase();
        const ok =
          q === "" ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.email.toLowerCase().includes(q.toLowerCase()) ||
          c.phone.includes(q) ||
          notes.includes(q.toLowerCase());
        if (segment === "todos") return ok;
        return ok && seg === segment;
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [data.customers, data.sales, data.products, q, segment]);

  function handleDelete(c: Customer) {
    if (
      !confirm(
        `¿Eliminar a ${c.name}? Las ventas asociadas quedarán sin cliente.`,
      )
    ) {
      return;
    }
    deleteCustomer(c.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar nombre, email, teléfono o notas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as typeof segment)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="todos">Todos</option>
          <option value="frecuente">Frecuentes</option>
          <option value="nuevo">Nuevos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      <Card>
        <CardHeader
          title="Clientes"
          subtitle="Alta manual, edición y asociación a ventas"
        />
        <CardContent className="overflow-x-auto p-0">
          <div className="space-y-3 p-3 md:hidden">
            {rows.map(
              ({ c, totalSpent, purchaseCount, lastPurchase, segment: seg }) => (
                <div key={c.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{c.name}</p>
                    <span className="capitalize text-xs text-zinc-500">{seg}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {c.phone || "—"} · {c.email || "—"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p>
                      <span className="text-zinc-500">Total:</span>{" "}
                      <span className="font-medium tabular-nums">{formatCurrency(totalSpent)}</span>
                    </p>
                    <p>
                      <span className="text-zinc-500">Compras:</span>{" "}
                      <span className="font-medium tabular-nums">{purchaseCount}</span>
                    </p>
                    <p className="col-span-2">
                      <span className="text-zinc-500">Última compra:</span>{" "}
                      <span className="font-medium">{lastPurchase ? formatDate(lastPurchase) : "—"}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                      aria-label="Editar cliente"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      aria-label="Eliminar cliente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
          <table className="hidden w-full min-w-[960px] text-left text-sm md:table">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-right">Total gastado</th>
                <th className="px-4 py-3 text-right">Compras</th>
                <th className="px-4 py-3">Última compra</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map(
                ({ c, totalSpent, purchaseCount, lastPurchase, segment: seg }) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {c.phone || "—"} · {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {purchaseCount}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {lastPurchase ? formatDate(lastPurchase) : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{seg}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          aria-label="Editar cliente"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          aria-label="Eliminar cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No hay clientes que coincidan. Podés crear uno con &quot;Nuevo
              cliente&quot;.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {creating ? (
        <CustomerModal
          title="Nuevo cliente"
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            addCustomer(payload);
            setCreating(false);
          }}
        />
      ) : null}

      {editing ? (
        <CustomerModal
          title="Editar cliente"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(payload) => {
            updateCustomer(editing.id, payload);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: Customer;
  onClose: () => void;
  onSave: (payload: Omit<Customer, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [registeredAt, setRegisteredAt] = useState(
    () => initial?.registeredAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader title={title} />
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onSave({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                notes: notes.trim() || undefined,
                registeredAt,
              });
            }}
          >
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nombre
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Teléfono
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Notas (opcional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Fecha de alta
              <input
                type="date"
                value={registeredAt}
                onChange={(e) => setRegisteredAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
