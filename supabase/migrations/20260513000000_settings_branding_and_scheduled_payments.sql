-- Branding del negocio + tabla de pagos programados.
-- 1) `settings.logo_data_url` y `settings.legal_footer` para los PDFs.
-- 2) `scheduled_payments`: pagos planificados (puntuales) con estado.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
  ADD COLUMN IF NOT EXISTS legal_footer TEXT;

COMMENT ON COLUMN public.settings.logo_data_url IS
  'Logo del negocio inline como data URL (data:image/png;base64,...). Se usa en encabezados de PDFs.';
COMMENT ON COLUMN public.settings.legal_footer IS
  'Slogan / leyenda corta opcional para el pie de los PDFs.';

-- ---------------------------------------------------------------------------
-- Pagos programados (planificados puntuales: sueldo, marketing, producción, etc.)
-- A diferencia de `expense_recurrences`, esto es una sola ocurrencia futura que
-- puede marcarse como pagada. Al pagar se crea un `expenses` y se vincula con
-- paid_expense_id; al borrar el gasto, el pago vuelve a estado pendiente.
-- ---------------------------------------------------------------------------
CREATE TABLE public.scheduled_payments (
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

CREATE TRIGGER scheduled_payments_set_updated_at
BEFORE UPDATE ON public.scheduled_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX scheduled_payments_due_date_idx
  ON public.scheduled_payments (due_date);

CREATE INDEX scheduled_payments_paid_idx
  ON public.scheduled_payments (paid, due_date);

ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_scheduled_payments" ON public.scheduled_payments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.scheduled_payments IS
  'Pagos programados (planificados puntuales). Al pagar se crea un expense y se enlaza con paid_expense_id.';
