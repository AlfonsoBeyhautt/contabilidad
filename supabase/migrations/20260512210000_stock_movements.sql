-- Ledger inmutable de movimientos de stock para reconstruir cómo se llegó al
-- stock actual de cada producto / talle. Cada fila representa un evento:
-- venta, compra, ajuste manual, defectivo, reversión por edición, etc.
-- `ref_id` apunta a la entidad origen (sale.id / purchase.id / defective.id /
-- product.id) sin FK estricta, para no romper el historial si el evento original
-- se borra (en ese caso, la reversión queda registrada en el ledger).

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  size_key TEXT NOT NULL DEFAULT '_',
  kind TEXT NOT NULL CHECK (kind IN (
    'compra',
    'compra_revert',
    'venta',
    'venta_revert',
    'defectuoso',
    'ajuste_manual',
    'alta_producto',
    'cascade_borrado'
  )),
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  ref_kind TEXT CHECK (ref_kind IN ('sale','purchase','defective','manual','system')),
  ref_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_product_id_idx
  ON public.stock_movements (product_id, created_at DESC);

CREATE INDEX stock_movements_created_at_idx
  ON public.stock_movements (created_at DESC);

CREATE INDEX stock_movements_kind_idx
  ON public.stock_movements (kind);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_stock_movements" ON public.stock_movements
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.stock_movements IS
  'Ledger inmutable de movimientos de stock; reconstruye la historia de cada (producto, talle).';
COMMENT ON COLUMN public.stock_movements.size_key IS
  'Coincide con la clave usada en products.stock_by_size; "_" = sin talle.';
COMMENT ON COLUMN public.stock_movements.stock_after IS
  'Stock total del producto después de aplicar este movimiento (suma de todos los talles).';
COMMENT ON COLUMN public.stock_movements.ref_id IS
  'Referencia opcional a la entidad origen (sale_id / purchase_id / defective_id / product_id); sin FK para tolerar borrados.';
