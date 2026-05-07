/**
 * Contrato para persistencia futura (Supabase / Postgres).
 * El panel usa DataProvider + `local-storage-app-data` en el navegador.
 */

import { APP_DATA_STORAGE_KEY } from "./local-storage-app-data";
import type { AppData } from "./types";

export interface AppRepository {
  fetchAll(): Promise<AppData>;
  persist(data: AppData): Promise<void>;
}

export class LocalStorageRepository implements AppRepository {
  private readonly key: string;

  constructor(key: string = APP_DATA_STORAGE_KEY) {
    this.key = key;
  }

  async fetchAll(): Promise<AppData> {
    if (typeof window === "undefined") {
      throw new Error("LocalStorageRepository solo en cliente");
    }
    const raw = localStorage.getItem(this.key);
    if (!raw) throw new Error("Sin datos");
    return JSON.parse(raw) as AppData;
  }

  async persist(data: AppData): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}
