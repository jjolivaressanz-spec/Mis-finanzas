
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, ChevronDown, Loader2, AlertCircle } from 'lucide-react';

interface PeriodSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
  className?: string;
}

interface PeriodData {
  anyo: number;
  mes: number;
  mes_nombre: string;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ selectedYear, selectedMonth, onChange, className = '' }) => {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPeriods = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vista_periodos_disponibles')
          .select('anyo, mes, mes_nombre')
          .order('anyo', { ascending: false })
          .order('mes', { ascending: false });

        if (error) throw error;

        const periodData = data as PeriodData[];
        
        if (periodData && periodData.length > 0) {
          setPeriods(periodData);
          
          // Optional: If current selection is invalid (e.g. on first load), set to latest available
          const exists = periodData.some(p => p.anyo === selectedYear && p.mes === selectedMonth);
          if (!exists) {
            onChange(periodData[0].anyo, periodData[0].mes);
          }
        }
      } catch (err) {
        console.error('Error fetching periods:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived state for dropdowns
  const availableYears = Array.from(new Set(periods.map(p => p.anyo))).sort((a: number, b: number) => b - a);
  
  const availableMonths = periods
    .filter(p => p.anyo === selectedYear)
    .sort((a, b) => b.mes - a.mes); // Descending order for months usually better for "latest" context

  const handleYearChange = (newYear: number) => {
    // Find valid month for new year. 
    // Try to keep same month if exists, otherwise take the latest month of that year.
    const monthsForNewYear = periods.filter(p => p.anyo === newYear);
    const sameMonthExists = monthsForNewYear.find(p => p.mes === selectedMonth);
    
    if (sameMonthExists) {
      onChange(newYear, selectedMonth);
    } else if (monthsForNewYear.length > 0) {
      // Default to the latest month available for that year (first one since we sort desc in fetching or processing)
      const latestMonth = monthsForNewYear.sort((a, b) => b.mes - a.mes)[0];
      onChange(newYear, latestMonth.mes);
    } else {
      // Edge case: Year has no months? Should not happen with inner join view logic usually
      onChange(newYear, 1);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm opacity-70 cursor-wait ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error && periods.length === 0) {
    return (
        <div className="text-red-500 text-xs flex items-center gap-1 bg-red-50 p-2 rounded" title="Error cargando periodos">
            <AlertCircle className="w-4 h-4" />
            <span>Error conexión</span>
        </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      
      {/* Month Selector */}
      <div className="relative group">
         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Calendar className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => onChange(selectedYear, Number(e.target.value))}
          className="
            appearance-none 
            block 
            w-full 
            pl-10 
            pr-10 
            py-2 
            bg-white dark:bg-slate-800 
            border border-gray-300 dark:border-slate-600 
            rounded-md 
            shadow-sm 
            text-sm 
            font-medium 
            text-gray-700 dark:text-gray-200 
            hover:border-indigo-500 dark:hover:border-indigo-400
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            transition-all
            cursor-pointer
            min-w-[140px]
          "
        >
          {availableMonths.map((p) => (
            <option key={p.mes} value={p.mes}>
              {p.mes_nombre}
            </option>
          ))}
          {availableMonths.length === 0 && <option disabled>Sin datos</option>}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Year Selector */}
      <div className="relative group">
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="
            appearance-none 
            block 
            w-full 
            pl-4
            pr-10 
            py-2 
            bg-white dark:bg-slate-800 
            border border-gray-300 dark:border-slate-600 
            rounded-md 
            shadow-sm 
            text-sm 
            font-medium 
            text-gray-700 dark:text-gray-200 
            hover:border-indigo-500 dark:hover:border-indigo-400
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            transition-all
            cursor-pointer
            min-w-[100px]
          "
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

    </div>
  );
};

export default PeriodSelector;
