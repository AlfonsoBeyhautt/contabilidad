"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyRecurringExpenseTick } from "@/lib/data/recurring-expense-tick";
import { emptyAppData } from "@/lib/data/empty-app-data";
import { productFullPatch } from "@/lib/data/product-mirror-payload";
import {
  buildVariantDisplayName,
  generateVariantSku,
} from "@/lib/data/product-display";
import {
  applyPurchaseToProduct,
  applySaleLineToProduct,
  revertPurchaseFromProduct,
  adjustStockBySizeKey,
  normalizeProductStockShape,
  revertSaleLineFromProduct,
  stockMapFromSizeRows,
  STOCK_BUCKET_DEFAULT,
} from "@/lib/data/stock-helpers";
import {
  clearAppDataLocalStorage,
  writeAppDataToLocalStorage,
} from "@/lib/data/local-storage-app-data";
import { cascadeRelationsAfterProductRemoval } from "@/lib/data/product-removal-cascade";
import {
  mirrorAfterProductRemovalAsync,
  mirrorCustomerDeleteAsync,
  mirrorCustomerInsertAsync,
  mirrorCustomerPatchAsync,
  mirrorDefectiveDeleteAsync,
  mirrorDefectiveInsertAsync,
  mirrorExpenseAsync,
  mirrorExpenseDeleteAsync,
  mirrorExpensePatchAsync,
  mirrorExpenseRecurrenceDeleteAsync,
  mirrorExpenseRecurrenceInsertAsync,
  mirrorExpenseRecurrencePatchAsync,
  mirrorProductFamilyPatchAsync,
  mirrorProductFamilyWithVariantsAsync,
  mirrorProductInsertAsync,
  mirrorProductPatchAsync,
  mirrorPurchaseAsync,
  mirrorPurchaseDeleteAsync,
  mirrorPurchasePatchAsync,
  mirrorSaleAsync,
  mirrorSaleDeleteAsync,
  mirrorSaleReplaceAsync,
  mirrorSettingsAsync,
  loadInitialAppDataWithMeta,
  type AppDataLoadSource,
  APP_DATA_PERSIST_ERROR_EVENT,
} from "@/lib/supabase/mirror-app-data";
import { isSupabaseClientReady } from "@/lib/supabase/is-supabase-client-ready";
import type {
  AppData,
  AppSettings,
  Customer,
  DefectiveEntry,
  Expense,
  ExpenseRecurrence,
  InventoryPurchase,
  Product,
  ProductCategory,
  ProductFamily,
  Sale,
} from "@/lib/data/types";

export type VariantSizeStockInput = { size: string; stock: number };

export type ProductVariantInput = {
  model: string;
  sizeStocks: VariantSizeStockInput[];
  purchaseCost: number;
  salePrice: number;
  minStock: number;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

type DataContextValue = {
  data: AppData;
  dataSource: AppDataLoadSource;
  setData: (d: AppData) => void;
  addSale: (input: Omit<Sale, "id">) => void;
  updateSale: (id: string, input: Omit<Sale, "id">) => void;
  deleteSale: (id: string) => void;
  addProductFamilyWithVariants: (input: {
    name: string;
    category: ProductCategory;
    entryDate: string;
    variants: ProductVariantInput[];
  }) => void;
  addVariantToFamily: (familyId: string, v: ProductVariantInput) => void;
  updateProductFamily: (
    familyId: string,
    patch: Partial<Pick<ProductFamily, "name" | "category" | "entryDate">>,
  ) => void;
  deleteProductFamily: (familyId: string) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, delta: number, sizeKey?: string) => void;
  addExpense: (input: Omit<Expense, "id">) => void;
  updateExpense: (row: Expense) => void;
  deleteExpense: (id: string) => void;
  addDefectiveEntry: (input: Omit<DefectiveEntry, "id" | "recordedAt">) => void;
  deleteDefectiveEntry: (id: string) => void;
  addExpenseRecurrence: (input: Omit<ExpenseRecurrence, "id">) => void;
  updateExpenseRecurrence: (
    id: string,
    patch: Partial<ExpenseRecurrence>,
  ) => void;
  deleteExpenseRecurrence: (id: string) => void;
  addPurchase: (input: Omit<InventoryPurchase, "id">) => void;
  updatePurchase: (id: string, input: Omit<InventoryPurchase, "id">) => void;
  deletePurchase: (id: string) => void;
  addCustomer: (input: Omit<Customer, "id">) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Borra caché local y vuelve a cargar desde Supabase (o vacío / LS si falla). */
  reloadAppData: () => Promise<void>;
  /** Ejecuta un tick de gastos recurrentes (emitir vencidos y actualizar fechas). */
  runExpenseRecurrenceTickNow: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Estado en memoria + escrituras a Supabase en cada mutación (`mirror*`).
 * Carga inicial: Supabase si está configurado; localStorage solo si falla la lectura remota.
 * Con Supabase activo, localStorage es copia de respaldo (debounce + al ocultar pestaña).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => emptyAppData());
  const [dataSource, setDataSource] = useState<AppDataLoadSource>("empty_fallback");
  const [persistReady, setPersistReady] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const onErr = (ev: Event) => {
      const ce = ev as CustomEvent<{ label: string; message: string }>;
      const d = ce.detail;
      setPersistError(
        `No se pudo sincronizar con la nube (${d.label}): ${d.message}. Los datos siguen en esta sesión; si recargás sin copia local, podrían faltar cambios remotos.`,
      );
    };
    window.addEventListener(APP_DATA_PERSIST_ERROR_EVENT, onErr);
    return () =>
      window.removeEventListener(APP_DATA_PERSIST_ERROR_EVENT, onErr);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadInitialAppDataWithMeta();
      if (!cancelled) {
        setData(result.data);
        setDataSource(result.source);
      }
      if (!cancelled) {
        setPersistReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    if (dataSource === "supabase") return;
    if (!isSupabaseClientReady()) return;
    let cancelled = false;
    const retry = async () => {
      const result = await loadInitialAppDataWithMeta();
      if (cancelled) return;
      if (result.source === "supabase") {
        setData(result.data);
        setDataSource("supabase");
      }
    };
    const id = window.setInterval(() => {
      void retry();
    }, 5000);
    void retry();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [persistReady, dataSource]);

  useEffect(() => {
    if (!persistReady) return;
    if (!isSupabaseClientReady()) {
      writeAppDataToLocalStorage(dataRef.current);
      return;
    }
    const id = window.setTimeout(() => {
      writeAppDataToLocalStorage(dataRef.current);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [data, persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    if (!isSupabaseClientReady()) return;
    const flush = () => writeAppDataToLocalStorage(dataRef.current);
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    const tick = () => {
      setData((d) => {
        const { data: next, newExpenses, updatedRecurrences } =
          applyRecurringExpenseTick(d);
        if (newExpenses.length === 0 && updatedRecurrences.length === 0) {
          return d;
        }
        queueMicrotask(() => {
          for (const e of newExpenses) {
            mirrorExpenseAsync(e);
          }
          for (const r of updatedRecurrences) {
            mirrorExpenseRecurrencePatchAsync(r.id, {
              nextRunAt: r.nextRunAt,
            });
          }
        });
        return next;
      });
    };
    tick();
    const interval = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistReady]);

  const addSale = useCallback((input: Omit<Sale, "id">) => {
    const sale: Sale = { ...input, id: newId() };
    setData((d) => {
      let products = d.products;
      for (const line of sale.lines) {
        products = products.map((p) =>
          line.productId === p.id ? applySaleLineToProduct(p, line) : p,
        );
      }
      const touched = new Set(sale.lines.map((l) => l.productId));
      queueMicrotask(() => {
        mirrorSaleAsync(sale);
        for (const pid of touched) {
          const p = products.find((x) => x.id === pid);
          if (p) mirrorProductPatchAsync(pid, productFullPatch(p));
        }
      });
      return { ...d, products, sales: [...d.sales, sale] };
    });
  }, []);

  const updateSale = useCallback((id: string, input: Omit<Sale, "id">) => {
    setData((d) => {
      const old = d.sales.find((s) => s.id === id);
      if (!old) return d;
      let products = d.products;
      for (const line of old.lines) {
        products = products.map((p) =>
          line.productId === p.id ? revertSaleLineFromProduct(p, line) : p,
        );
      }
      const newSale: Sale = { ...input, id };
      for (const line of newSale.lines) {
        products = products.map((p) =>
          line.productId === p.id ? applySaleLineToProduct(p, line) : p,
        );
      }
      const touched = new Set<string>([
        ...old.lines.map((l) => l.productId),
        ...newSale.lines.map((l) => l.productId),
      ]);
      queueMicrotask(() => {
        mirrorSaleReplaceAsync(newSale);
        for (const pid of touched) {
          const p = products.find((x) => x.id === pid);
          if (p) mirrorProductPatchAsync(pid, productFullPatch(p));
        }
      });
      return {
        ...d,
        products,
        sales: d.sales.map((s) => (s.id === id ? newSale : s)),
      };
    });
  }, []);

  const deleteSale = useCallback((id: string) => {
    setData((d) => {
      const sale = d.sales.find((s) => s.id === id);
      if (!sale) return d;
      let products = d.products;
      for (const line of sale.lines) {
        products = products.map((p) =>
          line.productId === p.id ? revertSaleLineFromProduct(p, line) : p,
        );
      }
      const touched = new Set(sale.lines.map((l) => l.productId));
      queueMicrotask(() => {
        mirrorSaleDeleteAsync(id);
        for (const pid of touched) {
          const p = products.find((x) => x.id === pid);
          if (p) mirrorProductPatchAsync(pid, productFullPatch(p));
        }
      });
      return { ...d, products, sales: d.sales.filter((s) => s.id !== id) };
    });
  }, []);

  const addProductFamilyWithVariants = useCallback(
    (input: {
      name: string;
      category: ProductCategory;
      entryDate: string;
      variants: ProductVariantInput[];
    }) => {
      const familyId = newId();
      const entryDate = input.entryDate.slice(0, 10);
      const family: ProductFamily = {
        id: familyId,
        name: input.name.trim(),
        category: input.category,
        entryDate,
      };
      const variants: Product[] = input.variants.map((v) => {
        const stockBySize = stockMapFromSizeRows(v.sizeStocks);
        return normalizeProductStockShape({
          id: newId(),
          familyId,
          sku: generateVariantSku(),
          name: buildVariantDisplayName(family.name, v.model.trim()),
          category: input.category,
          size: "",
          model: v.model.trim(),
          supplier: "",
          purchaseCost: v.purchaseCost,
          salePrice: v.salePrice,
          stock: 0,
          minStock: v.minStock,
          entryDate,
          stockBySize,
        });
      });
      setData((d) => ({
        ...d,
        productFamilies: [...d.productFamilies, family],
        products: [...d.products, ...variants],
      }));
      mirrorProductFamilyWithVariantsAsync(family, variants);
    },
    [],
  );

  const addVariantToFamily = useCallback(
    (familyId: string, v: ProductVariantInput) => {
      setData((d) => {
        const fam = d.productFamilies.find((f) => f.id === familyId);
        if (!fam) return d;
        const stockBySize = stockMapFromSizeRows(v.sizeStocks);
        const product = normalizeProductStockShape({
          id: newId(),
          familyId,
          sku: generateVariantSku(),
          name: buildVariantDisplayName(fam.name, v.model.trim()),
          category: fam.category,
          size: "",
          model: v.model.trim(),
          supplier: "",
          purchaseCost: v.purchaseCost,
          salePrice: v.salePrice,
          stock: 0,
          minStock: v.minStock,
          entryDate: fam.entryDate.slice(0, 10),
          stockBySize,
        });
        queueMicrotask(() => mirrorProductInsertAsync(product));
        return { ...d, products: [...d.products, product] };
      });
    },
    [],
  );

  const updateProductFamily = useCallback(
    (
      familyId: string,
      patch: Partial<Pick<ProductFamily, "name" | "category" | "entryDate">>,
    ) => {
      setData((d) => {
        const families = d.productFamilies.map((f) =>
          f.id === familyId ? { ...f, ...patch } : f,
        );
        const fam = families.find((f) => f.id === familyId);
        if (!fam) return { ...d, productFamilies: families };
        const products = d.products.map((p) => {
          if (p.familyId !== familyId) return p;
          return {
            ...p,
            category: fam.category,
            entryDate: fam.entryDate.slice(0, 10),
            name: buildVariantDisplayName(fam.name, p.model),
          };
        });
        return { ...d, productFamilies: families, products };
      });
      mirrorProductFamilyPatchAsync(familyId, patch);
    },
    [],
  );

  const deleteProductFamily = useCallback((familyId: string) => {
    setData((d) => {
      const removedProductIds = new Set(
        d.products.filter((p) => p.familyId === familyId).map((p) => p.id),
      );
      const { mirror, sales, purchases, defectives } =
        cascadeRelationsAfterProductRemoval(d, removedProductIds);
      queueMicrotask(() =>
        mirrorAfterProductRemovalAsync(mirror, {
          kind: "family",
          familyId,
        }),
      );
      return {
        ...d,
        sales,
        purchases,
        defectives,
        productFamilies: d.productFamilies.filter((f) => f.id !== familyId),
        products: d.products.filter((p) => p.familyId !== familyId),
      };
    });
  }, []);

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setData((d) => {
      const products = d.products.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        const fam = d.productFamilies.find((f) => f.id === merged.familyId);
        const next = normalizeProductStockShape({
          ...merged,
          name: buildVariantDisplayName(fam?.name ?? "", merged.model),
        });
        queueMicrotask(() =>
          mirrorProductPatchAsync(id, productFullPatch(next)),
        );
        return next;
      });
      return { ...d, products };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData((d) => {
      const target = d.products.find((p) => p.id === id);
      if (!target) return d;
      const sibs = d.products.filter((p) => p.familyId === target.familyId);
      const familyToDelete = sibs.length <= 1 ? target.familyId : null;

      const removedProductIds = new Set<string>();
      if (familyToDelete) {
        for (const p of d.products) {
          if (p.familyId === familyToDelete) removedProductIds.add(p.id);
        }
      } else {
        removedProductIds.add(id);
      }

      const { mirror, sales, purchases, defectives } =
        cascadeRelationsAfterProductRemoval(d, removedProductIds);

      const nextProducts =
        familyToDelete !== null
          ? d.products.filter((p) => p.familyId !== familyToDelete)
          : d.products.filter((p) => p.id !== id);
      const nextFamilies =
        familyToDelete !== null
          ? d.productFamilies.filter((f) => f.id !== familyToDelete)
          : d.productFamilies;

      queueMicrotask(() =>
        mirrorAfterProductRemovalAsync(
          mirror,
          familyToDelete
            ? { kind: "family", familyId: familyToDelete }
            : { kind: "product", productId: id },
        ),
      );

      return {
        ...d,
        sales,
        purchases,
        defectives,
        products: nextProducts,
        productFamilies: nextFamilies,
      };
    });
  }, []);

  const adjustStock = useCallback(
    (productId: string, delta: number, sizeKey?: string) => {
      setData((d) => {
        let updated: Product | null = null;
        const products = d.products.map((p) => {
          if (p.id !== productId) return p;
          const next = adjustStockBySizeKey(
            p,
            sizeKey ?? STOCK_BUCKET_DEFAULT,
            delta,
          );
          updated = next;
          return next;
        });
        if (updated) {
          queueMicrotask(() =>
            mirrorProductPatchAsync(productId, productFullPatch(updated!)),
          );
        }
        return { ...d, products };
      });
    },
    [],
  );

  const addExpense = useCallback((input: Omit<Expense, "id">) => {
    const row: Expense = { ...input, id: newId() };
    setData((d) => ({ ...d, expenses: [...d.expenses, row] }));
    mirrorExpenseAsync(row);
  }, []);

  const updateExpense = useCallback((row: Expense) => {
    setData((d) => ({
      ...d,
      expenses: d.expenses.map((e) => (e.id === row.id ? row : e)),
    }));
    mirrorExpensePatchAsync(row);
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      expenses: d.expenses.filter((e) => e.id !== id),
    }));
    mirrorExpenseDeleteAsync(id);
  }, []);

  const addDefectiveEntry = useCallback(
    (input: Omit<DefectiveEntry, "id" | "recordedAt">) => {
      const row: DefectiveEntry = {
        ...input,
        id: newId(),
        recordedAt: new Date().toISOString(),
      };
      setData((d) => ({
        ...d,
        defectives: [...(d.defectives ?? []), row],
      }));
      mirrorDefectiveInsertAsync(row);
    },
    [],
  );

  const deleteDefectiveEntry = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      defectives: (d.defectives ?? []).filter((x) => x.id !== id),
    }));
    mirrorDefectiveDeleteAsync(id);
  }, []);

  const runExpenseRecurrenceTickNow = useCallback(() => {
    setData((d) => {
      const { data: next, newExpenses, updatedRecurrences } =
        applyRecurringExpenseTick(d);
      if (newExpenses.length === 0 && updatedRecurrences.length === 0) {
        return d;
      }
      queueMicrotask(() => {
        for (const e of newExpenses) {
          mirrorExpenseAsync(e);
        }
        for (const r of updatedRecurrences) {
          mirrorExpenseRecurrencePatchAsync(r.id, {
            nextRunAt: r.nextRunAt,
          });
        }
      });
      return next;
    });
  }, []);

  const addExpenseRecurrence = useCallback(
    (input: Omit<ExpenseRecurrence, "id">) => {
      const row: ExpenseRecurrence = { ...input, id: newId() };
      setData((d) => {
        const withRec: AppData = {
          ...d,
          expenseRecurrences: [...(d.expenseRecurrences ?? []), row],
        };
        const { data: next, newExpenses, updatedRecurrences } =
          applyRecurringExpenseTick(withRec);
        queueMicrotask(() => {
          mirrorExpenseRecurrenceInsertAsync(row);
          for (const e of newExpenses) {
            mirrorExpenseAsync(e);
          }
          for (const r of updatedRecurrences) {
            mirrorExpenseRecurrencePatchAsync(r.id, {
              nextRunAt: r.nextRunAt,
            });
          }
        });
        return next;
      });
    },
    [],
  );

  const updateExpenseRecurrence = useCallback(
    (id: string, patch: Partial<ExpenseRecurrence>) => {
      setData((d) => ({
        ...d,
        expenseRecurrences: (d.expenseRecurrences ?? []).map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }));
      mirrorExpenseRecurrencePatchAsync(id, patch);
    },
    [],
  );

  const deleteExpenseRecurrence = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      expenseRecurrences: (d.expenseRecurrences ?? []).filter((r) => r.id !== id),
    }));
    mirrorExpenseRecurrenceDeleteAsync(id);
  }, []);

  const addPurchase = useCallback((input: Omit<InventoryPurchase, "id">) => {
    const purchase: InventoryPurchase = { ...input, id: newId() };
    setData((d) => {
      const pid = purchase.productId;
      const products = d.products.map((p) =>
        p.id === pid ? applyPurchaseToProduct(p, purchase.quantity) : p,
      );
      const updated = products.find((x) => x.id === pid);
      queueMicrotask(() => {
        mirrorPurchaseAsync(purchase);
        if (updated) mirrorProductPatchAsync(pid, productFullPatch(updated));
      });
      return { ...d, purchases: [...d.purchases, purchase], products };
    });
  }, []);

  const updatePurchase = useCallback(
    (id: string, input: Omit<InventoryPurchase, "id">) => {
      setData((d) => {
        const old = d.purchases.find((p) => p.id === id);
        if (!old) return d;
        const merged: InventoryPurchase = { ...old, ...input, id };
        const products = d.products
          .map((p) =>
            p.id === old.productId
              ? revertPurchaseFromProduct(p, old.quantity)
              : p,
          )
          .map((p) =>
            p.id === merged.productId
              ? applyPurchaseToProduct(p, merged.quantity)
              : p,
          );
        const purchases = d.purchases.map((p) =>
          p.id === id ? merged : p,
        );
        const syncIds = new Set([old.productId, merged.productId]);
        queueMicrotask(() => {
          mirrorPurchasePatchAsync(merged);
          for (const pid of syncIds) {
            const pr = products.find((x) => x.id === pid);
            if (pr) mirrorProductPatchAsync(pid, productFullPatch(pr));
          }
        });
        return { ...d, purchases, products };
      });
    },
    [],
  );

  const deletePurchase = useCallback((id: string) => {
    setData((d) => {
      const old = d.purchases.find((p) => p.id === id);
      if (!old) return d;
      const products = d.products.map((p) =>
        p.id === old.productId
          ? revertPurchaseFromProduct(p, old.quantity)
          : p,
      );
      const updated = products.find((x) => x.id === old.productId);
      queueMicrotask(() => {
        mirrorPurchaseDeleteAsync(id);
        if (updated) {
          mirrorProductPatchAsync(
            old.productId,
            productFullPatch(updated),
          );
        }
      });
      return {
        ...d,
        purchases: d.purchases.filter((p) => p.id !== id),
        products,
      };
    });
  }, []);

  const addCustomer = useCallback((input: Omit<Customer, "id">) => {
    const row: Customer = { ...input, id: newId() };
    setData((d) => ({ ...d, customers: [...d.customers, row] }));
    mirrorCustomerInsertAsync(row);
  }, []);

  const updateCustomer = useCallback((id: string, patch: Partial<Customer>) => {
    setData((d) => ({
      ...d,
      customers: d.customers.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
    mirrorCustomerPatchAsync(id, patch);
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      sales: d.sales.map((s) =>
        s.customerId === id ? { ...s, customerId: null } : s,
      ),
    }));
    mirrorCustomerDeleteAsync(id);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setData((d) => {
      const settings = { ...d.settings, ...patch };
      mirrorSettingsAsync(settings);
      return { ...d, settings };
    });
  }, []);

  const reloadAppData = useCallback(async () => {
    clearAppDataLocalStorage();
    const result = await loadInitialAppDataWithMeta();
    setData(result.data);
    setDataSource(result.source);
  }, []);

  const setDataExternal = useCallback((d: AppData) => {
    setData(d);
  }, []);

  const value = useMemo(
    () => ({
      data,
      dataSource,
      setData: setDataExternal,
      addSale,
      updateSale,
      deleteSale,
      addProductFamilyWithVariants,
      addVariantToFamily,
      updateProductFamily,
      deleteProductFamily,
      updateProduct,
      deleteProduct,
      adjustStock,
      addExpense,
      updateExpense,
      deleteExpense,
      addDefectiveEntry,
      deleteDefectiveEntry,
      addExpenseRecurrence,
      updateExpenseRecurrence,
      deleteExpenseRecurrence,
      runExpenseRecurrenceTickNow,
      addPurchase,
      updatePurchase,
      deletePurchase,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      updateSettings,
      reloadAppData,
    }),
    [
      data,
      dataSource,
      setDataExternal,
      addSale,
      updateSale,
      deleteSale,
      addProductFamilyWithVariants,
      addVariantToFamily,
      updateProductFamily,
      deleteProductFamily,
      updateProduct,
      deleteProduct,
      adjustStock,
      addExpense,
      updateExpense,
      deleteExpense,
      addDefectiveEntry,
      deleteDefectiveEntry,
      addExpenseRecurrence,
      updateExpenseRecurrence,
      deleteExpenseRecurrence,
      runExpenseRecurrenceTickNow,
      addPurchase,
      updatePurchase,
      deletePurchase,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      updateSettings,
      reloadAppData,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {persistError ? (
        <div
          role="alert"
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950 shadow-lg dark:border-red-900 dark:bg-red-950/90 dark:text-red-50"
        >
          <p className="font-medium">No se pudo replicar en Supabase</p>
          <p className="mt-1 opacity-90">{persistError}</p>
          <p className="mt-2 text-xs opacity-80">
            Si los cambios se ven en la app, quedaron en esta sesión y en copia
            local; cerrá sesión y volvé a entrar si el mensaje menciona permisos
            o JWT. Asegurate de haber aplicado las migraciones SQL en tu proyecto.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-semibold underline"
            onClick={() => setPersistError(null)}
          >
            Cerrar
          </button>
        </div>
      ) : null}
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de DataProvider");
  return ctx;
}
