import { createClient } from '@supabase/supabase-js';

// Usar variables de entorno de Vite o las credenciales proporcionadas directamente
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xnxbgsrjsrvzeyoxbyxo.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dULiIMv7TKe1MTWoZjs_XA_5ZASBal5';

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function main() {
  const { data, error } = await supabase.from('diccionario_categorias').select('*');
  console.log("Dictionary Rules:", JSON.stringify(data, null, 2));
  
  const { data: mv, error: err } = await supabase.from('movimientos_bancarios').select('*').ilike('movimiento', '%DRUNI SANT CELONI%');
  console.log("Movimientos matches:", JSON.stringify(mv, null, 2));
}

main();
