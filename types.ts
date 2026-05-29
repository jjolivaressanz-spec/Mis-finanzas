
// Definiciones de tipos basadas en el esquema de base de datos y vistas

export interface ResumenMensual {
  ingresos: number;
  gastos: number;
  balance_neto: number; // Changed from balance to match PDF
  anyo: number;
  mes: number;
}

export interface GastoCategoria {
  categoria: string;
  total_gastado: number; // Changed from total to match PDF
  // porcentaje might be calculated in UI
}

export interface EvolucionSaldo {
  fecha: string; // ISO date string
  saldo: number;
  movimiento?: string;
  // anyo and mes removed as they don't exist in this view
}

export interface MovimientoDetalle {
  // Corresponds to vista_desglose_conceptos
  anyo: number;
  mes_nombre: string;
  mes: number; // Ensure this exists in the view or is derived
  categoria: string;
  concepto_reducido: string;
  tipo: 'Gasto' | 'Ingreso';
  total_absoluto: number;
  balance_neto: number;
  num_operaciones: number;
  porcentaje_sobre_categoria: number; // 0-100
}

export interface MovimientoRaw {
  id: number;
  fecha: string;
  movimiento: string;
  importe: number;
  categoria: string;
  anyo: number;
  mes: number;
}

export interface DiccionarioItem {
  id?: number; // Added optional id for easier management
  patron: string;
  categoria: string;
  concepto_reducido: string;
}

export interface FilterState {
  year: number;
  month: number;
}

export type ViewState = 'dashboard' | 'accounts' | 'training' | 'analysis' | 'dictionary';

// Utility types for UI
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
