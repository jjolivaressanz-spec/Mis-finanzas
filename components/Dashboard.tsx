
import React, { useState, useEffect } from 'react';
import { supabase, formatCurrency, getMonthName, formatPercent } from '../services/supabase';
import { FilterState, ResumenMensual, GastoCategoria } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, AlertCircle, SearchX, ChevronRight, ChevronDown, LayoutDashboard } from 'lucide-react';
import PeriodSelector from './PeriodSelector';

// Colors for the donut chart
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#64748b'];

interface DashboardProps {
  filter: FilterState;
  setFilter: (filter: FilterState) => void;
  onError: (msg: string) => void;
}

// Interfaces for the nested table structure
interface DetailRow {
  originalName: string;
  count: number;
  total: number;
}

interface ConceptGroup {
  name: string;
  total: number;
  count: number;
  hasMultipleOrigins: boolean;
  details: DetailRow[];
}

interface CategoryGroup {
  name: string;
  concepts: ConceptGroup[];
  total: number;
}

interface ProcessedTableData {
  income: CategoryGroup[];
  expenses: CategoryGroup[];
}

interface RenderCategoryGroupProps {
  group: CategoryGroup;
  isIncome: boolean;
  expandedKeys: Set<string>;
  onToggleRow: (category: string, concept: string) => void;
}

// Helper component to render each category group and its concepts
const RenderCategoryGroup: React.FC<RenderCategoryGroupProps> = ({ group, isIncome, expandedKeys, onToggleRow }) => {
  const textColor = isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-white';
  const amountColor = isIncome ? 'text-emerald-600' : 'text-gray-900 dark:text-white';
  const headerBg = isIncome ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-slate-700/50';

  return (
    <React.Fragment>
      {/* Category Header */}
      <tr className={headerBg}>
        <td colSpan={3} className="px-6 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <span className={`font-bold ${textColor}`}>{group.name}</span>
            <span className={`font-bold text-sm ${textColor} opacity-80`}>{formatCurrency(group.total)}</span>
          </div>
        </td>
      </tr>
      
      {/* Concepts */}
      {group.concepts.map((concept) => {
        const rowKey = `${group.name}|${concept.name}`;
        const isExpanded = expandedKeys.has(rowKey);
        const showDropdown = concept.hasMultipleOrigins;

        return (
          <React.Fragment key={rowKey}>
            <tr 
              className={`
                border-b border-gray-50 dark:border-slate-800 transition-colors
                ${isExpanded ? 'bg-gray-50 dark:bg-slate-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}
              `}
            >
              <td className="px-6 py-4">
                <div 
                  className={`flex items-center gap-3 ${showDropdown ? 'cursor-pointer select-none group' : ''}`}
                  onClick={() => showDropdown && onToggleRow(group.name, concept.name)}
                >
                  {showDropdown && (
                    <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  )}
                  <div className={!showDropdown ? 'ml-7' : ''}>
                    <span className={`text-sm font-medium ${isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {concept.name}
                    </span>
                    {!showDropdown && concept.details[0] && concept.name !== concept.details[0].originalName && (
                       <div className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[200px]">
                         {concept.details[0].originalName.toLowerCase()}
                       </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                  {concept.count}
                </span>
              </td>
              <td className={`px-6 py-4 text-right text-sm font-semibold ${amountColor}`}>
                {formatCurrency(concept.total)}
              </td>
            </tr>

            {/* Expanded Details */}
            {isExpanded && concept.details.map((detail, dIdx) => (
              <tr key={`${rowKey}-d-${dIdx}`} className="bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-50 dark:border-slate-800">
                <td className="px-6 py-2 pl-16">
                   <span className="text-xs text-gray-500 dark:text-gray-400 font-mono italic">
                     {detail.originalName.toLowerCase()}
                   </span>
                </td>
                <td className="px-6 py-2 text-center">
                  <span className="text-xs text-gray-400">
                    {detail.count}
                  </span>
                </td>
                <td className="px-6 py-2 text-right">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {formatCurrency(detail.total)}
                  </span>
                </td>
              </tr>
            ))}
          </React.Fragment>
        );
      })}
    </React.Fragment>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ filter, setFilter, onError }) => {
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenMensual | null>(null);
  const [gastosCategoria, setGastosCategoria] = useState<GastoCategoria[]>([]);
  
  // New State for nested table
  const [tableData, setTableData] = useState<ProcessedTableData>({ income: [], expenses: [] });
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setExpandedKeys(new Set()); // Reset expansions on filter change
    try {
      // 1. KPI Cards
      const { data: kpiData, error: kpiError } = await supabase
        .from('vista_resumen_mensual')
        .select('*')
        .eq('anyo', filter.year)
        .eq('mes', filter.month)
        .maybeSingle();

      if (kpiError) throw kpiError;
      setResumen(kpiData);

      // 2. Charts Data (Donut)
      const { data: catData, error: catError } = await supabase
        .from('vista_gastos_por_categoria')
        .select('*')
        .eq('anyo', filter.year)
        .eq('mes', filter.month)
        .order('total_gastado', { ascending: false });

      if (catError) throw catError;
      setGastosCategoria(catData || []);

      // 3. Detail Table Data (Raw movements to build nested structure)
      const { data: rawMovs, error: movsError } = await supabase
        .from('movimientos_bancarios')
        .select('categoria, concepto_reducido, movimiento, importe')
        .eq('anyo', filter.year)
        .eq('mes', filter.month);

      if (movsError) throw movsError;
      
      processTableData(rawMovs || []);

    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processTableData = (rows: any[]) => {
    const buildGroups = (filteredRows: any[]) => {
      const categories: Record<string, Record<string, { total: number; count: number; breakdown: Record<string, { total: number; count: number }> }>> = {};

      filteredRows.forEach(row => {
        const cat = row.categoria || 'Sin clasificar';
        const concept = row.concepto_reducido || row.movimiento || 'Varios';
        const origin = row.movimiento;
        const amount = Math.abs(row.importe);

        if (!categories[cat]) categories[cat] = {};
        if (!categories[cat][concept]) {
          categories[cat][concept] = { total: 0, count: 0, breakdown: {} };
        }

        categories[cat][concept].total += amount;
        categories[cat][concept].count += 1;

        if (!categories[cat][concept].breakdown[origin]) {
          categories[cat][concept].breakdown[origin] = { total: 0, count: 0 };
        }
        categories[cat][concept].breakdown[origin].total += amount;
        categories[cat][concept].breakdown[origin].count += 1;
      });

      return Object.keys(categories).sort().map(catName => {
        const conceptsObj = categories[catName];
        const conceptsArr: ConceptGroup[] = Object.keys(conceptsObj).map(conName => {
          const cData = conceptsObj[conName];
          const details: DetailRow[] = Object.keys(cData.breakdown).map(origin => ({
            originalName: origin,
            count: cData.breakdown[origin].count,
            total: cData.breakdown[origin].total
          })).sort((a, b) => b.total - a.total);

          return {
            name: conName,
            total: cData.total,
            count: cData.count,
            hasMultipleOrigins: details.length > 1,
            details
          };
        }).sort((a, b) => b.total - a.total);

        return {
          name: catName,
          concepts: conceptsArr,
          total: conceptsArr.reduce((sum, c) => sum + c.total, 0)
        };
      }).sort((a, b) => b.total - a.total);
    };

    const incomeRows = rows.filter(r => r.importe >= 0);
    const expenseRows = rows.filter(r => r.importe < 0);

    setTableData({
      income: buildGroups(incomeRows),
      expenses: buildGroups(expenseRows)
    });
  };

  const toggleRow = (category: string, concept: string) => {
    const key = `${category}|${concept}`;
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const totalExpenses = gastosCategoria.reduce((sum, item) => sum + Math.abs(item.total_gastado), 0);

  if (loading && !resumen && gastosCategoria.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isEmpty = !resumen && gastosCategoria.length === 0 && tableData.income.length === 0 && tableData.expenses.length === 0;

  return (
    <div className="space-y-6 fade-in">
      {/* Banner Header */}
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8" />
              Análisis Mensual
            </h2>
            <p className="mt-2 text-blue-100 max-w-xl">
              Control exhaustivo de ingresos y gastos para {getMonthName(filter.month)} de {filter.year}.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-inner">
            <PeriodSelector 
              selectedYear={filter.year} 
              selectedMonth={filter.month}
              onChange={(y, m) => setFilter({ year: y, month: m })} 
            />
          </div>
        </div>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <LayoutDashboard className="w-72 h-72" />
        </div>
      </div>

      {isEmpty && !loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600">
          <div className="p-4 bg-gray-100 dark:bg-slate-700 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sin datos para este periodo</h3>
          <p className="text-gray-500 text-center max-w-sm mt-1">
            No se han encontrado movimientos para {getMonthName(filter.month)} del {filter.year}. Intenta seleccionar otro mes.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ingresos Totales</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(resumen?.ingresos || 0)}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <ArrowUpCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gastos Totales</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(Math.abs(resumen?.gastos || 0))}</h3>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                <ArrowDownCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance Neto</p>
                <h3 className={`text-2xl font-bold mt-1 ${(resumen?.balance_neto || 0) >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                  {formatCurrency(resumen?.balance_neto || 0)}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">Distribución de Gastos por Categoría</h3>
              
              <div className="flex flex-col lg:flex-row items-center gap-10">
                <div className="w-full lg:w-1/3 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gastosCategoria}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="total_gastado"
                        nameKey="categoria"
                      >
                        {gastosCategoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(Math.abs(value))}
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gastosCategoria.map((cat, idx) => {
                    const percentage = totalExpenses > 0 ? (Math.abs(cat.total_gastado) / totalExpenses) * 100 : 0;
                    return (
                      <div key={cat.categoria} className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors border border-gray-100 dark:border-slate-700/50">
                        <div className="w-3 h-12 rounded-full mr-4 shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-800 dark:text-white text-sm">{cat.categoria}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(Math.abs(cat.total_gastado))}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full" 
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: COLORS[idx % COLORS.length]
                                  }}
                                />
                             </div>
                             <span className="text-xs text-gray-500 font-medium w-10 text-right">{formatPercent(percentage)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Desglose Detallado</h3>
            </div>
            <div className="overflow-x-auto">
              {(tableData.income.length === 0 && tableData.expenses.length === 0) ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <SearchX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay datos disponibles para el desglose.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Concepto</th>
                      <th className="px-6 py-4 text-center">Operaciones</th>
                      <th className="px-6 py-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {tableData.income.length > 0 && (
                      <tr className="bg-emerald-100/50 dark:bg-emerald-900/20">
                        <td colSpan={3} className="px-6 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Ingresos</td>
                      </tr>
                    )}
                    {tableData.income.map(group => (
                      <RenderCategoryGroup 
                        key={`income-${group.name}`} 
                        group={group} 
                        isIncome={true} 
                        expandedKeys={expandedKeys} 
                        onToggleRow={toggleRow} 
                      />
                    ))}
                    {tableData.expenses.length > 0 && (
                      <tr className="bg-rose-100/50 dark:bg-rose-900/20">
                        <td colSpan={3} className="px-6 py-2 text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Gastos</td>
                      </tr>
                    )}
                    {tableData.expenses.map(group => (
                      <RenderCategoryGroup 
                        key={`expense-${group.name}`} 
                        group={group} 
                        isIncome={false} 
                        expandedKeys={expandedKeys} 
                        onToggleRow={toggleRow} 
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
