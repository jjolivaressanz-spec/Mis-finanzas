
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { DiccionarioItem } from '../types';
import { BookOpen, Search, Edit3, Trash2, X, Save, Loader2, AlertTriangle, RefreshCw, ListFilter, Plus } from 'lucide-react';

interface DictionaryManagerProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DictionaryManager: React.FC<DictionaryManagerProps> = ({ onNotify }) => {
  const [rules, setRules] = useState<DiccionarioItem[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State
  const [editingRule, setEditingRule] = useState<DiccionarioItem | null>(null);
  const [originalRule, setOriginalRule] = useState<DiccionarioItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete State
  const [deletingRule, setDeletingRule] = useState<DiccionarioItem | null>(null);
  
  // Reprocess State
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState({ patron: '', categoria: '', concepto_reducido: '' });
  const [isCreatingSaving, setIsCreatingSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('diccionario_categorias')
        .select('*')
        .order('categoria', { ascending: true });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);

      // 2. Fetch ALL unique categories currently used in movements for better suggestions
      const { data: catData, error: catError } = await supabase
        .from('movimientos_bancarios')
        .select('categoria')
        .not('categoria', 'is', null);

      if (catError) throw catError;
      
      const catsFromRules = (rulesData || []).map(r => r.categoria);
      const catsFromMovs = (catData || []).map(m => m.categoria);
      const uniqueCats = [...new Set([...catsFromRules, ...catsFromMovs])].filter(c => c !== 'Sin clasificar').sort();
      
      setAllCategories(uniqueCats);

    } catch (err: any) {
      onNotify('Error al cargar datos del diccionario', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('diccionario_categorias')
        .update({
          categoria: editingRule.categoria,
          concepto_reducido: editingRule.concepto_reducido
        })
        .eq('patron', editingRule.patron);

      if (error) throw error;

      onNotify('Regla actualizada correctamente', 'success');
      setEditingRule(null);
      setOriginalRule(null);
      fetchData();
    } catch (err: any) {
      onNotify(err.message || 'Error al actualizar la regla', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    try {
      const { error } = await supabase
        .from('diccionario_categorias')
        .delete()
        .eq('patron', deletingRule.patron);

      if (error) throw error;

      onNotify('Regla eliminada', 'success');
      setDeletingRule(null);
      fetchData();
    } catch (err: any) {
      onNotify('Error al eliminar la regla', 'error');
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const { error } = await supabase.rpc('reprocesar_todo_diccionario');
      if (error) throw error;
      onNotify('Sistema reprocesado correctamente. Los movimientos se han actualizado.', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Error al reprocesar el sistema', 'error');
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.patron || !newRule.categoria || !newRule.concepto_reducido) return;

    setIsCreatingSaving(true);
    try {
      // Check if patron already exists
      const existing = rules.find(r => r.patron.toLowerCase() === newRule.patron.toLowerCase());
      if (existing) {
        throw new Error(`Ya existe una regla para el patrón "${newRule.patron}"`);
      }

      const { error } = await supabase
        .from('diccionario_categorias')
        .insert([{
          patron: newRule.patron,
          categoria: newRule.categoria,
          concepto_reducido: newRule.concepto_reducido
        }]);

      if (error) throw error;

      onNotify('Regla añadida correctamente', 'success');
      setIsCreating(false);
      setNewRule({ patron: '', categoria: '', concepto_reducido: '' });
      fetchData();
    } catch (err: any) {
      onNotify(err.message || 'Error al añadir la regla', 'error');
    } finally {
      setIsCreatingSaving(false);
    }
  };

  const filteredRules = rules.filter(r => 
    r.patron.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.concepto_reducido.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get concepts based on current editing category
  const getSuggestedConcepts = () => {
    if (!editingRule?.categoria) return [];
    
    // Filter rules that match the current category being edited
    const concepts = rules
      .filter(r => r.categoria.toLowerCase() === editingRule.categoria.toLowerCase())
      .map(r => r.concepto_reducido);
      
    return [...new Set(concepts)].sort();
  };

  const openEditModal = (rule: DiccionarioItem) => {
    setOriginalRule(rule);
    setEditingRule({
      ...rule,
      categoria: '', // Clear to facilitate datalist usage
      concepto_reducido: '' // Clear to facilitate datalist usage
    });
  };

  const closeEditModal = () => {
    setEditingRule(null);
    setOriginalRule(null);
  };

  return (
    <div className="space-y-6 fade-in max-w-6xl mx-auto">
      {/* Header section */}
      <div className="bg-amber-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="w-8 h-8" />
              Gestión del Diccionario
            </h2>
            <p className="mt-2 text-amber-100 max-w-xl">
              Administra las reglas de clasificación automática. Puedes editar patrones, corregir categorías o eliminar reglas obsoletas.
            </p>
          </div>
          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl font-semibold transition-all border border-white/20 disabled:opacity-50"
          >
            {isReprocessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            Reprocesar Histórico
          </button>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
          <BookOpen className="w-72 h-72" />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center flex-1">
             <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Buscar por patrón, categoría o concepto..."
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <button
                onClick={() => setIsCreating(true)}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors text-sm font-medium"
             >
               <Plus className="w-4 h-4" />
               Nueva Regla
             </button>
           </div>
           <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 whitespace-nowrap">
             <ListFilter className="w-4 h-4" />
             Mostrando {filteredRules.length} de {rules.length} reglas
           </div>
        </div>

        {/* Rules Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-gray-400">
               <Loader2 className="w-10 h-10 animate-spin mb-4 text-amber-500" />
               <p>Cargando reglas y categorías...</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No se encontraron reglas con ese criterio.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-4">Patrón de Identificación</th>
                  <th className="px-6 py-4">Categoría Asignada</th>
                  <th className="px-6 py-4">Concepto Limpio</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4">
                      <code className="text-sm font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
                        {rule.patron}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {rule.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {rule.concepto_reducido}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEditModal(rule)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all"
                          title="Editar regla"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeletingRule(rule)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          title="Eliminar regla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Nueva Regla</h3>
              <button 
                onClick={() => {
                  setIsCreating(false);
                  setNewRule({ patron: '', categoria: '', concepto_reducido: '' });
                }} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patrón (Identificador)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newRule.patron}
                  onChange={(e) => setNewRule({...newRule, patron: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm font-mono uppercase"
                  placeholder="Ej: AMAZON"
                />
                <p className="text-[10px] text-gray-400 mt-1">Texto único que identifica el movimiento</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                <input
                  type="text"
                  required
                  value={newRule.categoria}
                  onChange={(e) => setNewRule({...newRule, categoria: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                  list="new-category-list"
                  placeholder="Escribe o selecciona..."
                />
                <datalist id="new-category-list">
                  {allCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto Reducido (Nombre Limpio)</label>
                <input
                  type="text"
                  required
                  value={newRule.concepto_reducido}
                  onChange={(e) => setNewRule({...newRule, concepto_reducido: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Ej: Amazon Web Services"
                  list="new-conceptos-sugeridos"
                  disabled={!newRule.categoria && !newRule.concepto_reducido}
                />
                <datalist id="new-conceptos-sugeridos">
                  {rules
                    .filter(r => r.categoria.toLowerCase() === newRule.categoria.toLowerCase())
                    .map(r => r.concepto_reducido)
                    .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], [] as string[])
                    .sort()
                    .map((concept, idx) => (
                      <option key={idx} value={concept} />
                    ))}
                </datalist>
                <p className="text-[10px] text-gray-400 mt-1">Sugeridos según la categoría seleccionada</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewRule({ patron: '', categoria: '', concepto_reducido: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSaving}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200 dark:shadow-none transition-all text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {isCreatingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Crear Regla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Editar Regla</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateRule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patrón (Identificador)</label>
                <input
                  type="text"
                  readOnly
                  value={editingRule.patron}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-500 text-sm cursor-not-allowed font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">No se puede cambiar el patrón</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingRule.categoria}
                  onChange={(e) => setEditingRule({...editingRule, categoria: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                  list="full-category-list"
                  placeholder={originalRule?.categoria || "Escribe o selecciona..."}
                />
                <datalist id="full-category-list">
                  {allCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
                <p className="text-[10px] text-gray-400 mt-1">Haz clic para ver sugerencias</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto Reducido (Nombre Limpio)</label>
                <input
                  type="text"
                  required
                  value={editingRule.concepto_reducido}
                  onChange={(e) => setEditingRule({...editingRule, concepto_reducido: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                  placeholder={originalRule?.concepto_reducido || "Ej: Gasolinera Repsol"}
                  list="edit-conceptos-sugeridos"
                  disabled={!editingRule.categoria && !editingRule.concepto_reducido}
                />
                <datalist id="edit-conceptos-sugeridos">
                  {getSuggestedConcepts().map((concept, idx) => (
                    <option key={idx} value={concept} />
                  ))}
                </datalist>
                <p className="text-[10px] text-gray-400 mt-1">Sugeridos según la categoría seleccionada</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200 dark:shadow-none transition-all text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Eliminar regla?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Estás a punto de eliminar la regla para <span className="font-bold text-gray-700 dark:text-gray-200">"{deletingRule.patron}"</span>. 
              Esto dejará los movimientos relacionados como "Sin clasificar" tras el reprocesamiento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRule(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
              >
                No, volver
              </button>
              <button
                onClick={handleDeleteRule}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-lg shadow-red-200 dark:shadow-none transition-all"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictionaryManager;
