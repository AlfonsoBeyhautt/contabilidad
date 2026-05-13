-- ============================================================================
-- Catch-up schema (idempotente)
--
-- Pegá este archivo entero en el SQL editor de Supabase y ejecutá. Es 100%
-- seguro re-ejecutarlo: usa "IF NOT EXISTS", "DO blocks" y "DROP POLICY IF EXISTS"
-- antes de cada CREATE POLICY. No borra datos existentes; sólo agrega columnas,
-- tablas, índices, RLS y políticas faltantes.
--
-- Cubre todo lo que la app espera hoy (mayo 2026):
--   • sale_items.size
--   • customers.notes
--   • products.stock_by_size
--   • expense_recurrences (tabla)
--   • expenses.from_recurrence_id
--   • defective_entries (tabla)
--   • stock_movements (tabla)
--   • settings.logo_data_url, settings.legal_footer
--   • scheduled_payments (tabla)
--   • RLS y policies en todas las tablas
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Utilidad: trigger compartido para updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- products.stock_by_size  (talles dentro de cada variante)
-- -----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_by_size JSONB NOT NULL DEFAULT '{}'::jsonb;

-- backfill: si todavía está vacío y la columna size existe, derivar el bucket
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'size'
  ) THEN
    UPDATE public.products
    SET stock_by_size = jsonb_build_object(
      CASE
        WHEN trim(coalesce(size, '')) = '' THEN '_'
        ELSE trim(size)
      END,
      stock
    )
    WHERE stock_by_size = '{}'::jsonb;
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- sale_items.size
-- -----------------------------------------------------------------------------
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '';

-- -----------------------------------------------------------------------------
-- customers.notes
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- -----------------------------------------------------------------------------
-- Triggers de stock automáticos: nos los sacamos porque el cliente aplica
-- mutaciones directas (evitaba doble descuento). Es seguro intentar borrarlos.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sale_items_apply_stock ON public.sale_items;
DROP TRIGGER IF EXISTS trg_sale_items_restore_stock ON public.sale_items;
DROP TRIGGER IF EXISTS trg_purchase_items_apply_stock ON public.purchase_items;

-- -----------------------------------------------------------------------------
-- expense_recurrences (recurrencias)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14, 2) NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable' CHECK (kind IN ('fijo', 'variable')),
  frequency TEXT NOT NULL CHECK (
    frequency IN ('semanal', 'quincenal', 'mensual', 'trimestral', 'anual')
  ),
  start_date DATE NOT NULL,
  next_run_at DATE NOT NULL,
  end_date DATE,
  paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'expense_recurrences_set_updated_at'
  ) THEN
    CREATE TRIGGER expense_recurrences_set_updated_at
    BEFORE UPDATE ON public.expense_recurrences
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- expenses.from_recurrence_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS from_recurrence_id UUID
    REFERENCES public.expense_recurrences (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurrence_emit_day
ON public.expenses (
  from_recurrence_id,
  ((expense_date AT TIME ZONE 'UTC')::date)
)
WHERE from_recurrence_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- defective_entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.defective_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('agujero', 'costura_fallada', 'otro')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'defective_entries_set_updated_at'
  ) THEN
    CREATE TRIGGER defective_entries_set_updated_at
    BEFORE UPDATE ON public.defective_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS defective_entries_product_id_idx
  ON public.defective_entries (product_id);
CREATE INDEX IF NOT EXISTS defective_entries_recorded_at_idx
  ON public.defective_entries (recorded_at);

-- -----------------------------------------------------------------------------
-- stock_movements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  size_key TEXT NOT NULL DEFAULT '_',
  kind TEXT NOT NULL CHECK (
    kind IN (
      'compra',
      'compra_revert',
      'venta',
      'venta_revert',
      'defectuoso',
      'ajuste_manual',
      'alta_producto',
      'cascade_borrado'
    )
  ),
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  ref_kind TEXT,
  ref_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_id_created_at_idx
  ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx
  ON public.stock_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_kind_idx
  ON public.stock_movements (kind);

-- -----------------------------------------------------------------------------
-- settings.logo_data_url, settings.legal_footer
-- -----------------------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
  ADD COLUMN IF NOT EXISTS legal_footer TEXT;

-- -----------------------------------------------------------------------------
-- scheduled_payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable' CHECK (kind IN ('fijo', 'variable')),
  due_date DATE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  paid_expense_id UUID REFERENCES public.expenses (id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'scheduled_payments_set_updated_at'
  ) THEN
    CREATE TRIGGER scheduled_payments_set_updated_at
    BEFORE UPDATE ON public.scheduled_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS scheduled_payments_due_date_idx
  ON public.scheduled_payments (due_date);
CREATE INDEX IF NOT EXISTS scheduled_payments_paid_idx
  ON public.scheduled_payments (paid, due_date);

-- -----------------------------------------------------------------------------
-- RLS — activamos en todas las tablas nuevas
-- -----------------------------------------------------------------------------
ALTER TABLE public.expense_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defective_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_expense_recurrences" ON public.expense_recurrences;
CREATE POLICY "authenticated_full_expense_recurrences" ON public.expense_recurrences
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_full_defective_entries" ON public.defective_entries;
CREATE POLICY "authenticated_full_defective_entries" ON public.defective_entries
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_full_stock_movements" ON public.stock_movements;
CREATE POLICY "authenticated_full_stock_movements" ON public.stock_movements
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_full_scheduled_payments" ON public.scheduled_payments;
CREATE POLICY "authenticated_full_scheduled_payments" ON public.scheduled_payments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- Fin.  Después de correr esto, dale al "Recargar caché" en Supabase si tu
-- conexión usa schema cache (PostgREST recarga automático en ~10s).
-- -----------------------------------------------------------------------------
