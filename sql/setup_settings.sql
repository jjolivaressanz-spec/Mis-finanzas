-- 1. Crear tabla de cuenta de ahorro
CREATE TABLE IF NOT EXISTS cuenta_ahorro (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    savings_amount NUMERIC NOT NULL DEFAULT 100000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asignar configuración por defecto a usuarios existentes que no la tengan
INSERT INTO cuenta_ahorro (user_id, savings_amount)
SELECT id, 100000
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM cuenta_ahorro)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Activar RLS (Row Level Security)
ALTER TABLE cuenta_ahorro ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas (Policies)
DROP POLICY IF EXISTS "Usuarios ven su propia configuracion" ON cuenta_ahorro;
CREATE POLICY "Usuarios ven su propia configuracion"
ON cuenta_ahorro FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios pueden insertar su propia configuracion" ON cuenta_ahorro;
CREATE POLICY "Usuarios pueden insertar su propia configuracion"
ON cuenta_ahorro FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propia configuracion" ON cuenta_ahorro;
CREATE POLICY "Usuarios pueden actualizar su propia configuracion"
ON cuenta_ahorro FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Trigger para actualizar la fecha de modificacion (opcional pero recomendado)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cuenta_ahorro_modtime ON cuenta_ahorro;
CREATE TRIGGER update_cuenta_ahorro_modtime
BEFORE UPDATE ON cuenta_ahorro
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
