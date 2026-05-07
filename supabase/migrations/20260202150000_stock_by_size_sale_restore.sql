-- stock_by_size: inventario por talle dentro de la misma variante (fila products = modelo).
-- sale_items.size: talle vendido (vacío = bucket interno '_' en stock_by_size).
-- Notas en clientes.
-- Se eliminan triggers automáticos de stock en ventas/compras: el cliente aplica cambios
-- y replica con patchProduct + insert/delete de ventas (evita doble descuento).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_by_size JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.products
SET stock_by_size = jsonb_build_object(
  CASE
    WHEN trim(coalesce(size, '')) = '' THEN '_'
    ELSE trim(size)
  END,
  stock
)
WHERE stock_by_size = '{}'::jsonb;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

DROP TRIGGER IF EXISTS trg_sale_items_apply_stock ON public.sale_items;
DROP TRIGGER IF EXISTS trg_sale_items_restore_stock ON public.sale_items;
DROP TRIGGER IF EXISTS trg_purchase_items_apply_stock ON public.purchase_items;
