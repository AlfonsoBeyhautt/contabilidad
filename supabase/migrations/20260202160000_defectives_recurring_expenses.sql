-- Registro de unidades defectuosas (costo de producción no vendible).
-- Gastos recurrentes y vínculo opcional en expenses.

-- ---------------------------------------------------------------------------
-- Recurrencias de gasto (plantillas)
-- ---------------------------------------------------------------------------
CREATE TABLE public.expense_recurrences (
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

CREATE TRIGGER expense_recurrences_set_updated_at
BEFORE UPDATE ON public.expense_recurrences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS from_recurrence_id UUID REFERENCES public.expense_recurrences (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurrence_emit_day
ON public.expenses (from_recurrence_id, ((expense_date AT TIME ZONE 'UTC')::date))
WHERE from_recurrence_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Defectuosos / imperfectos
-- ---------------------------------------------------------------------------
CREATE TABLE public.defective_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('agujero', 'costura_fallada', 'otro')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER defective_entries_set_updated_at
BEFORE UPDATE ON public.defective_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX defective_entries_product_id_idx ON public.defective_entries (product_id);
CREATE INDEX defective_entries_recorded_at_idx ON public.defective_entries (recorded_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defective_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_expense_recurrences" ON public.expense_recurrences
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_full_defective_entries" ON public.defective_entries
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
