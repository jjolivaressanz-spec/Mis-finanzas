import { createClient } from '@supabase/supabase-js';

// Usar variables de entorno de Vite o las credenciales proporcionadas directamente
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xnxbgsrjsrvzeyoxbyxo.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dULiIMv7TKe1MTWoZjs_XA_5ZASBal5';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan credenciales de Supabase");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatPercent = (val: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(val / 100);
};

export const getMonthName = (month: number) => {
  // Create a date object specifically for the 1st of the requested month
  // using a fixed year (e.g., 2024 is a leap year, but day 1 is safe for all)
  const date = new Date(2024, month - 1, 1);
  return date.toLocaleString('es-ES', { month: 'long' });
};