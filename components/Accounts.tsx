
import React, { useState, useEffect } from 'react';
import { supabase, formatCurrency } from '../services/supabase';
import { EvolucionSaldo } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Wallet, TrendingUp, PiggyBank, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSettings, updateSavingsAmount } from '../services/settings';

interface AccountsProps {
  onError: (msg: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl ring-1 ring-white/10 backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-semibold">
          {new Date(label).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-sm font-bold text-blue-400">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const Accounts: React.FC<AccountsProps> = ({ onError }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [evolucion, setEvolucion] = useState<EvolucionSaldo[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [savingsAmount, setSavingsAmount] = useState(100000);
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  const [tempSavingsAmount, setTempSavingsAmount] = useState('100000');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Evolution Data from the new 24m view
      const { data: evoData, error: evoError } = await supabase
        .from('vista_evolucion_saldo_24m')
        .select('fecha, saldo')
        .order('fecha', { ascending: true });

      if (evoError) throw evoError;
      
      const data: EvolucionSaldo[] = (evoData || []).map(item => ({
        fecha: item.fecha,
        saldo: Number(item.saldo)
      }));

      setEvolucion(data);

      // 2. Fetch Current Balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('vista_saldo_actual')
        .select('saldo, ultima_actualizacion')
        .maybeSingle();

      if (balanceError) throw balanceError;

      if (balanceData) {
        setCurrentBalance(balanceData.saldo);
        setLastUpdate(balanceData.ultima_actualizacion);
      }

      // 3. Fetch User Settings
      if (user) {
        const settings = await getSettings(user.id);
        setSavingsAmount(settings.savings_amount);
        setTempSavingsAmount(settings.savings_amount.toString());
      }
    } catch (err: any) {
      console.error("--> Accounts Error:", err);
      onError(err.message || 'Error cargando datos de cuentas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSavings = async () => {
    try {
      if (!user) return;
      const numValue = Number(tempSavingsAmount);
      if (isNaN(numValue)) {
        onError('Valor inválido para ahorro');
        return;
      }
      await updateSavingsAmount(user.id, numValue);
      setSavingsAmount(numValue);
      setIsEditingSavings(false);
    } catch (err: any) {
      onError('Error guardando cartera de ahorro');
    }
  };

  const totalAssets = currentBalance + savingsAmount;

  // Formatting for Y Axis: "28,5k"
  const formatYAxis = (val: number) => {
    if (val === 0) return '0';
    return `${(val / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`;
  };

  // Formatting for X Axis: "Feb 24"
  const formatXAxis = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Premium Emerald Banner */}
      <div className="bg-emerald-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Wallet className="w-8 h-8" />
            Estado de Cuentas
          </h2>
          <p className="mt-2 text-emerald-100 max-w-xl">
            Visión global de tu patrimonio consolidado y evolución de tesorería histórica de los últimos 24 meses.
          </p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <Wallet className="w-72 h-72" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Checking Account */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl shadow-lg border border-blue-500/30 flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-20 text-white transition-transform group-hover:scale-110 duration-300">
            <Wallet className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Cuenta Corriente</p>
            <h3 className="text-3xl font-bold text-white mt-2">
              {loading ? <div className="h-8 bg-white/20 rounded w-32 animate-pulse"></div> : formatCurrency(currentBalance)}
            </h3>
            <p className="text-[11px] text-blue-200 mt-1 flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
               {lastUpdate 
                 ? `Sincronizado: ${new Date(lastUpdate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}` 
                 : 'Sincronizando...'}
            </p>
          </div>
        </div>

        {/* Savings Account */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-xl shadow-lg border border-orange-400/30 flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-20 text-white transition-transform group-hover:scale-110 duration-300">
            <PiggyBank className="w-24 h-24 -mr-4 -mt-4" />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-orange-100 uppercase tracking-widest">Cartera Ahorro</p>
            {isEditingSavings ? (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="number"
                  value={tempSavingsAmount}
                  onChange={(e) => setTempSavingsAmount(e.target.value)}
                  className="w-32 px-2 py-1 text-lg font-bold border border-white/30 rounded bg-white/20 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSavings();
                    if (e.key === 'Escape') {
                       setIsEditingSavings(false);
                       setTempSavingsAmount(savingsAmount.toString());
                    }
                  }}
                />
                <button onClick={handleSaveSavings} className="p-1.5 text-white hover:bg-white/20 rounded">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => { setIsEditingSavings(false); setTempSavingsAmount(savingsAmount.toString()); }} className="p-1.5 text-white hover:bg-white/20 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <h3 className="text-3xl font-bold text-white">
                  {loading ? <div className="h-8 bg-white/20 rounded w-32 animate-pulse"></div> : formatCurrency(savingsAmount)}
                </h3>
                <button 
                  onClick={() => setIsEditingSavings(true)}
                  className="p-1.5 text-orange-100 hover:text-white hover:bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Editar saldo de ahorro"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Total Assets */}
        <div className="bg-slate-900 dark:bg-blue-600 p-6 rounded-xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-20 text-white transition-transform group-hover:scale-110 duration-300">
            <TrendingUp className="w-24 h-24 -mr-4 -mt-4 text-white" />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 dark:text-blue-100 uppercase tracking-widest">Patrimonio Neto</p>
            <h3 className="text-3xl font-bold text-white mt-2">
              {loading ? <div className="h-8 bg-slate-700 dark:bg-blue-400 rounded w-32 animate-pulse"></div> : formatCurrency(totalAssets)}
            </h3>
          </div>
        </div>
      </div>

      {/* Evolution Chart */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
        <div className="flex justify-between items-center mb-8">
           <h3 className="text-lg font-bold text-gray-800 dark:text-white">Evolución Histórica</h3>
           <div className="flex items-center gap-4 text-xs font-semibold text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span>Saldo Real</span>
              </div>
           </div>
        </div>
        
        {loading ? (
             <div className="h-[400px] w-full p-2">
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>
             </div>
        ) : evolucion.length === 0 ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-slate-900/20 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
              <TrendingUp className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-medium">Sin datos históricos disponibles</p>
            </div>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucion} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" opacity={0.2} />
                <XAxis 
                  dataKey="fecha" 
                  tickFormatter={formatXAxis}
                  minTickGap={80}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatYAxis}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  domain={['dataMin - 1000', 'auto']} 
                  dx={-10}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSaldo)" 
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/50 flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
           <span>Data Source: vista_evolucion_saldo_24m</span>
           <span>Sincronización Automática</span>
        </div>
      </div>
    </div>
  );
};

export default Accounts;
