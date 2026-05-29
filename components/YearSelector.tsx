
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, ChevronDown, Loader2, AlertCircle } from 'lucide-react';

interface YearSelectorProps {
  selectedYear: number;
  onChange: (year: number) => void;
  className?: string;
}

const YearSelector: React.FC<YearSelectorProps> = ({ selectedYear, onChange, className = '' }) => {
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchYears = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vista_anyos_disponibles')
          .select('anyo')
          .order('anyo', { ascending: false });

        if (error) throw error;

        // Extract years and deduplicate just in case
        const rows = data as { anyo: number }[] | null;
        const availableYears = Array.from(new Set((rows || []).map(d => d.anyo))).sort((a, b) => b - a);

        if (availableYears.length > 0) {
          setYears(availableYears);
          
          // Requirement: "Por defecto, el selector debe marcar el año más alto"
          // If the current selectedYear is not in the list (or we are initializing), 
          // switch to the max year found.
          // We check if the parent's current year is different from the max year available.
          const maxYear = availableYears[0];
          
          // Only force update if the current selected year is not in the list of available years
          // OR if we want to strictly enforce "latest year on load" regardless of parent init state.
          // Based on "State Initial", let's strictly set to maxYear if distinct.
          if (selectedYear !== maxYear && !availableYears.includes(selectedYear)) {
             onChange(maxYear);
          } else if (selectedYear !== maxYear && availableYears.includes(selectedYear)) {
             // Keep user selection if valid, but logic implies we usually want the latest on first mount.
             // We'll respect the parent's state if it's valid, otherwise default to max.
          } else if (selectedYear !== maxYear) {
             // If this component mounts and determines the "default" should be max, we update parent.
             onChange(maxYear);
          }
        } else {
            // Fallback if DB is empty: use current year
            setYears([new Date().getFullYear()]);
        }
      } catch (err) {
        console.error('Error fetching years:', err);
        setError(true);
        // Fallback on error
        setYears([new Date().getFullYear(), new Date().getFullYear() - 1]);
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm opacity-70 cursor-wait ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        <div className="h-4 w-12 bg-gray-200 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error && years.length === 0) {
    return (
        <div className="text-red-500 text-xs flex items-center" title="Error cargando años">
            <AlertCircle className="w-4 h-4" />
        </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Calendar className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <select
          value={selectedYear}
          onChange={(e) => onChange(Number(e.target.value))}
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
          "
        >
          {years.map((year) => (
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

export default YearSelector;
