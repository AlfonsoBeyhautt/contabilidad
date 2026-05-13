import type { AppData } from "./types";

/** Estado inicial sin datos de negocio (sin demo). */
export function emptyAppData(): AppData {
  return {
    productFamilies: [],
    products: [],
    customers: [],
    sales: [],
    purchases: [],
    expenses: [],
    expenseRecurrences: [],
    defectives: [],
    stockMovements: [],
    scheduledPayments: [],
    settings: {
      shopName: "",
      currency: "ARS",
      lowStockAlerts: true,
    },
  };
}
