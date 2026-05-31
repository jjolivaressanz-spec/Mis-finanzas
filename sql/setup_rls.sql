-- 1. Añadimos la columna user_id
ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE diccionario_categorias ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Asignamos los datos existentes a tu usuario
UPDATE movimientos_bancarios SET user_id = 'c0ea5184-01d9-490e-92fb-613a9d4d4eeb' WHERE user_id IS NULL;
UPDATE diccionario_categorias SET user_id = 'c0ea5184-01d9-490e-92fb-613a9d4d4eeb' WHERE user_id IS NULL;

-- 3. Activamos Row Level Security (RLS)
ALTER TABLE movimientos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE diccionario_categorias ENABLE ROW LEVEL SECURITY;

-- 4. Creamos las políticas (Policies) para Movimientos
DROP POLICY IF EXISTS "Los usuarios ven sus propios movimientos" ON movimientos_bancarios;
CREATE POLICY "Los usuarios ven sus propios movimientos" 
ON movimientos_bancarios FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar sus movimientos" ON movimientos_bancarios;
CREATE POLICY "Los usuarios pueden insertar sus movimientos" 
ON movimientos_bancarios FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden modificar sus movimientos" ON movimientos_bancarios;
CREATE POLICY "Los usuarios pueden modificar sus movimientos" 
ON movimientos_bancarios FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden borrar sus movimientos" ON movimientos_bancarios;
CREATE POLICY "Los usuarios pueden borrar sus movimientos" 
ON movimientos_bancarios FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Creamos las políticas (Policies) para el Diccionario
DROP POLICY IF EXISTS "Los usuarios ven su diccionario" ON diccionario_categorias;
CREATE POLICY "Los usuarios ven su diccionario" 
ON diccionario_categorias FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden insertar en su diccionario" ON diccionario_categorias;
CREATE POLICY "Los usuarios pueden insertar en su diccionario" 
ON diccionario_categorias FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden modificar su diccionario" ON diccionario_categorias;
CREATE POLICY "Los usuarios pueden modificar su diccionario" 
ON diccionario_categorias FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden borrar de su diccionario" ON diccionario_categorias;
CREATE POLICY "Los usuarios pueden borrar de su diccionario" 
ON diccionario_categorias FOR DELETE 
USING (auth.uid() = user_id);

-- 6. Actualizamos TODAS las vistas para que respeten RLS (Propiedad security_invoker en PostgreSQL 15+)
ALTER VIEW vista_evolucion_saldo_24m SET (security_invoker = true);
ALTER VIEW vista_saldo_actual SET (security_invoker = true);
ALTER VIEW vista_resumen_mensual SET (security_invoker = true);
ALTER VIEW vista_gastos_por_categoria SET (security_invoker = true);
ALTER VIEW vista_periodos_disponibles SET (security_invoker = true);
ALTER VIEW vista_anyos_disponibles SET (security_invoker = true);

-- Nuevas vistas para arreglar los warnings
ALTER VIEW public.vista_desglose_conceptos SET (security_invoker = true);
ALTER VIEW app_trabajo.vista_resumen_horas_helpdesk SET (security_invoker = true);
ALTER VIEW public.vista_evolucion_saldo SET (security_invoker = true);
ALTER VIEW public.vista_por_categoria SET (security_invoker = true);

-- Funciones para arreglar los warnings de "Security Definer Function"
ALTER FUNCTION public.reprocesar_clasificacion() SECURITY INVOKER;
ALTER FUNCTION public.reprocesar_todo_diccionario() SECURITY INVOKER;

-- Arreglar warning "Function Search Path Mutable"
ALTER FUNCTION public.categorizar_movimiento_final SET search_path = public;
