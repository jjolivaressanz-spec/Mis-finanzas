
import React, { useState, useEffect } from 'react';
import { supabase, formatCurrency } from '../services/supabase';
import { MovimientoRaw, DiccionarioItem } from '../types';
import { Brain, CheckCircle, Search, Tag, Loader2, X, Plus, Calendar, Filter, DollarSign } from 'lucide-react';

interface TrainingProps {
  onNotify: (msg: string, type: 'success' | 'error') => void;
}

const Training: React.FC<TrainingProps> = ({ onNotify }) => {
  const [items, setItems] = useState<MovimientoRaw[]>([]);
  const [dictionary, setDictionary] = useState<DiccionarioItem[]>([]); // Cache existing rules
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: ''
  });

  // Modal State
  const [selectedItem, setSelectedItem] = useState<MovimientoRaw | null>(null);
  const [formData, setFormData] = useState({
    patron: '',
    categoria: '',
    concepto_reducido: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // Fetch Unclassified Items AND Existing Dictionary
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Pendings
      const { data: pendingData, error: pendingError } = await supabase
        .from('movimientos_bancarios')
        .select('*')
        .eq('categoria', 'Sin clasificar')
        .order('fecha', { ascending: false });
      
      if (pendingError) throw pendingError;
      setItems(pendingData || []);

      // 2. Fetch Dictionary for suggestions
      const { data: dictData, error: dictError } = await supabase
        .from('diccionario_categorias')
        .select('categoria, concepto_reducido')
        .order('concepto_reducido', { ascending: true });

      if (dictError) throw dictError;
      setDictionary(dictData as DiccionarioItem[] || []);

    } catch (err: any) {
      onNotify('Error cargando datos del sistema', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Logic
  const filteredItems = items.filter(item => {
    // Date Filter
    if (filters.startDate && new Date(item.fecha) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(item.fecha) > new Date(filters.endDate)) return false;
    
    // Amount Filter (Absolute magnitude)
    if (filters.minAmount) {
      const threshold = parseFloat(filters.minAmount);
      if (!isNaN(threshold) && Math.abs(item.importe) < threshold) return false;
    }

    return true;
  });

  const openModal = (item: MovimientoRaw) => {
    setSelectedItem(item);
    // Auto-fill with the full original movement text
    setFormData({
      patron: item.movimiento,
      categoria: '',
      concepto_reducido: ''
    });
  };

  const closeModal = () => {
    setSelectedItem(null);
    setIsSubmitting(false);
    setProcessingMsg('');
  };

  const handleClassify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    // Validation: No % allowed in pattern
    if (formData.patron.includes('%')) {
      onNotify('El patrón no debe contener el símbolo %', 'error');
      return;
    }

    setIsSubmitting(true);
    setProcessingMsg('Guardando nueva regla...');

    try {
      // 1. Insert Rule
      const { error: insertError } = await supabase
        .from('diccionario_categorias')
        .insert([{
          patron: formData.patron,
          categoria: formData.categoria,
          concepto_reducido: formData.concepto_reducido
        }]);

      if (insertError) throw insertError;

      // 2. Reprocess via RPC
      setProcessingMsg('Aplicando regla a movimientos antiguos...');
      const { error: rpcError } = await supabase.rpc('reprocesar_clasificacion');
      
      if (rpcError) throw rpcError;

      onNotify(`Regla creada para "${formData.concepto_reducido}". Sistema actualizado.`, 'success');
      closeModal();
      fetchData(); // Refresh list and dictionary

    } catch (err: any) {
      console.error(err);
      onNotify(err.message || 'Error al guardar la clasificación', 'error');
      setIsSubmitting(false);
    }
  };

  // Logic to filter suggested concepts based on selected category
  const getSuggestedConcepts = () => {
    if (!formData.categoria) return [];
    
    // Filter by category and extract unique 'concepto_reducido'
    const concepts = dictionary
      .filter(item => item.categoria.toLowerCase() === formData.categoria.toLowerCase())
      .map(item => item.concepto_reducido);
    
    // Remove duplicates
    return [...new Set(concepts)];
  };

  // Get unique categories for suggestion list
  const uniqueCategories = [...new Set(dictionary.map(d => d.categoria))].sort();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="bg-violet-600 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8" />
            Entrenar al Sistema
          </h2>
          <p className="mt-2 text-violet-100 max-w-2xl">
            Ayuda a la IA a entender tus gastos. Define reglas para los movimientos que aparecen como "Sin clasificar" y el sistema aplicará tu lógica automáticamente al pasado y futuro.
          </p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10">
          <Brain className="w-64 h-64" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-100 dark:border-slate-700">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Loader2 className={`w-5 h-5 text-violet-500 ${loading ? 'animate-spin' : ''}`} />
            Pendientes de revisión ({filteredItems.length} visible{filteredItems.length !== items.length ? 's' : ''})
          </h3>

          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
               <Calendar className="w-4 h-4 text-gray-400" />
               <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={e => setFilters({...filters, startDate: e.target.value})}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 text-gray-600 dark:text-gray-300 w-24"
                  placeholder="Desde"
               />
               <span className="text-gray-300">-</span>
               <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={e => setFilters({...filters, endDate: e.target.value})}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 text-gray-600 dark:text-gray-300 w-24"
                  placeholder="Hasta"
               />
            </div>
            
            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <input 
                type="number" 
                placeholder="Min. Importe"
                value={filters.minAmount}
                onChange={e => setFilters({...filters, minAmount: e.target.value})}
                className="bg-transparent border-none text-xs p-0 focus:ring-0 text-gray-600 dark:text-gray-300 w-24"
              />
            </div>

            {(filters.startDate || filters.endDate || filters.minAmount) && (
              <button 
                onClick={() => setFilters({ startDate: '', endDate: '', minAmount: '' })}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {items.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-xl font-medium text-gray-900 dark:text-white">¡Todo clasificado!</h4>
            <p className="text-gray-500 dark:text-gray-400 mt-1">No hay movimientos pendientes de revisión.</p>
          </div>
        ) : filteredItems.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 mb-4">
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">Sin resultados</h4>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Ningún movimiento coincide con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-700/50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Descripción Original</th>
                  <th className="px-6 py-4 text-right">Importe</th>
                  <th className="px-6 py-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(item.fecha).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {item.movimiento}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.importe)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => openModal(item)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 transition-colors"
                      >
                        <Tag className="w-3 h-3 mr-1.5" />
                        Clasificar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classification Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Nueva Regla de Clasificación</h3>
              <button onClick={closeModal} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleClassify} className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200 mb-4">
                <span className="font-semibold block text-xs uppercase tracking-wide opacity-70 mb-1">Movimiento Original</span>
                "{selectedItem.movimiento}"
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  1. Patrón de Identificación
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.patron}
                    onChange={(e) => setFormData({...formData, patron: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="Ej: NATURGY"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Texto clave único que identifica este comercio.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  2. Categoría
                </label>
                <input
                  type="text"
                  required
                  value={formData.categoria}
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Selecciona o escribe una categoría..."
                  list="categorias-sugeridas"
                />
                <datalist id="categorias-sugeridas">
                  {uniqueCategories.length > 0 ? (
                    uniqueCategories.map(cat => <option key={cat} value={cat} />)
                  ) : (
                    <>
                      <option value="Alimentación" />
                      <option value="Vivienda" />
                      <option value="Transporte" />
                      <option value="Ocio" />
                      <option value="Salud" />
                      <option value="Suscripciones" />
                    </>
                  )}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  3. Concepto Reducido
                </label>
                <input
                  type="text"
                  required
                  value={formData.concepto_reducido}
                  onChange={(e) => setFormData({...formData, concepto_reducido: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                  placeholder={formData.categoria ? `Ej: Naturgy (Sugeridos de ${formData.categoria})` : "Escribe un nombre limpio..."}
                  list="conceptos-sugeridos"
                  disabled={!formData.categoria}
                />
                <datalist id="conceptos-sugeridos">
                  {getSuggestedConcepts().map((concepto, idx) => (
                    <option key={idx} value={concepto} />
                  ))}
                </datalist>
                {!formData.categoria && (
                  <p className="text-xs text-gray-400 mt-1">Selecciona primero una categoría para ver sugerencias.</p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {processingMsg || 'Procesando...'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Guardar y Reprocesar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Training;
