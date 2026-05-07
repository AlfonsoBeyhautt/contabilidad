-- Quitar texto demo del singleton de settings en bases ya creadas con la semilla anterior.
UPDATE public.settings
SET shop_name = ''
WHERE id = 1 AND shop_name = 'Tienda de ropa — panel interno';
