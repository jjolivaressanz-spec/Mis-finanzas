import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xnxbgsrjsrvzeyoxbyxo.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dULiIMv7TKe1MTWoZjs_XA_5ZASBal5';

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function main() {
  const { data, error } = await supabase.from('diccionario_categorias').select('*').in('patron', ['SANT CELONI', 'DRUNI SANT CELONI']);
  console.log("Dictionary Rules:", JSON.stringify(data, null, 2));
}

main();
