-- Familias de producto (nombre prenda) + variantes en `products` (modelo, talle, stock, precios).
-- Gastos: categorías reducidas a producción, marketing, envíos, otros.

-- ---------------------------------------------------------------------------
-- product_families
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS product_families_set_updated_at ON public.product_families;
CREATE TRIGGER product_families_set_updated_at
BEFORE UPDATE ON public.product_families
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_product_families" ON public.product_families;
CREATE POLICY "authenticated_full_product_families" ON public.product_families
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- products: color → model, family_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'color'
  ) THEN
    ALTER TABLE public.products RENAME COLUMN color TO model;
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.product_families (id) ON DELETE CASCADE;

-- Backfill: una familia por fila existente (sin tocar ids de producto = ventas/compras siguen válidas).
DO $$
DECLARE
  r RECORD;
  new_fid UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'family_id'
  ) THEN
    FOR r IN SELECT id, name, category, entry_date FROM public.products WHERE family_id IS NULL
    LOOP
      new_fid := gen_random_uuid();
      INSERT INTO public.product_families (id, name, category, entry_date)
      VALUES (new_fid, r.name, r.category, r.entry_date);
      UPDATE public.products SET family_id = new_fid WHERE id = r.id;
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.products ALTER COLUMN family_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Gastos: solo producción | marketing | envíos | otros
-- ---------------------------------------------------------------------------
UPDATE public.expenses
SET category = 'producción'
WHERE category IN ('packaging', 'proveedores', 'sueldos');

UPDATE public.expenses
SET category = 'otros'
WHERE category IN ('alquiler', 'impuestos', 'servicios', 'mantenimiento');

UPDATE public.expenses
SET category = 'envíos'
WHERE category IN ('envios');

UPDATE public.expenses
SET category = 'otros'
WHERE category NOT IN ('producción', 'marketing', 'envíos', 'otros');
