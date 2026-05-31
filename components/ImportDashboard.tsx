import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, FileText, AlertCircle, CheckCircle, Search, 
  Calendar, Coins, ArrowUpDown, ChevronLeft, ChevronRight, 
  HelpCircle, Sparkles, Filter, Info, Trash2, Database, Loader2
} from 'lucide-react';
import { getMonthName, formatCurrency, supabase } from '../services/supabase';

interface ParsedMovement {
  fecha: string;
  fecha_valor: string;
  anyo: number;
  mes: number;
  mes_nombre: string;
  movimiento: string;
  mas_datos: string | null;
  importe: number;
  saldo: number;
  concepto_reducido: string;
  categoria: string;
}

interface ImportDashboardProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

const ImportDashboard: React.FC<ImportDashboardProps> = ({ onNotify }) => {
  const [fileData, setFileData] = useState<ParsedMovement[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  // Pagination & Sorting States
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof ParsedMovement>('fecha');
  const [sortAscending, setSortAscending] = useState(false);
  const [lastUpdateLimit, setLastUpdateLimit] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch lastUpdate on mount
  React.useEffect(() => {
    const fetchLastUpdate = async () => {
      try {
        const { data, error } = await supabase
          .from('vista_saldo_actual')
          .select('ultima_actualizacion')
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setLastUpdateLimit(data.ultima_actualizacion);
        }
      } catch (err) {
        console.error("Error fetching last update limit:", err);
      }
    };
    fetchLastUpdate();
  }, []);

  // Helper to parse dates robustly (DD/MM/YYYY or native Date or Serial)
  const parseExcelDate = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    
    // 1. Already a Date object
    if (val instanceof Date) {
      try {
        return val.toISOString().split('T')[0];
      } catch {
        // Fallback if invalid date
      }
    }
    
    // 2. Excel numeric serial date (days since 1900-01-01)
    if (typeof val === 'number') {
      try {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
      } catch {
        // Fallback
      }
    }
    
    // 3. String date "DD/MM/YYYY" or "DD-MM-YYYY"
    if (typeof val === 'string') {
      const cleaned = val.trim();
      const parts = cleaned.split(/[\/\-]/);
      if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parts[2];
        if (day.length === 1) day = '0' + day;
        if (month.length === 1) month = '0' + month;
        if (year.length === 2) year = '20' + year; // handle yy
        return `${year}-${month}-${day}`;
      }
    }
    
    return String(val);
  };

  // Helper to parse Spanish local currency format (thousands dot, decimal comma)
  const parseExcelAmount = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    if (typeof val === 'string') {
      let str = val.trim();
      // Remove dots (thousands separators) and convert commas to dots (decimals)
      if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, '').replace(/,/g, '.');
      } else if (str.includes(',')) {
        str = str.replace(/,/g, '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    
    return 0;
  };

  const handleFile = (file: File) => {
    if (!file) return;
    const name = file.name;
    const extension = name.split('.').pop()?.toLowerCase();
    
    if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
      onNotify('Formato no soportado. Por favor, sube un archivo Excel (.xlsx, .xls) o CSV.', 'error');
      return;
    }

    setFileName(name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (rawRows.length === 0) {
          throw new Error('El archivo está vacío.');
        }

        // Search for the header row dynamically
        let headerIndex = -1;
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (row && row.length >= 3) {
            const rowStr = row.map(cell => String(cell).toLowerCase());
            // Header should contain 'fecha', 'movimiento', and 'importe' (case-insensitive)
            const hasFecha = rowStr.some(c => c.includes('fecha'));
            const hasMov = rowStr.some(c => c.includes('movimiento'));
            const hasImp = rowStr.some(c => c.includes('importe'));
            
            if (hasFecha && hasMov && hasImp) {
              headerIndex = i;
              break;
            }
          }
        }

        if (headerIndex === -1) {
          throw new Error('No se pudo encontrar la fila de cabeceras en el archivo. Asegúrate de incluir las columnas "Fecha", "Movimiento" e "Importe".');
        }

        const headers = rawRows[headerIndex].map(h => String(h).trim().toLowerCase());
        
        // Find column indices
        const colFecha = headers.findIndex(h => h.includes('fecha') && !h.includes('valor'));
        const colFechaValor = headers.findIndex(h => h.includes('fecha valor') || (h.includes('fecha') && h.includes('valor')));
        const colMov = headers.findIndex(h => h.includes('movimiento') || h.includes('concepto') || h.includes('descrip'));
        const colMasDatos = headers.findIndex(h => h.includes('más datos') || h.includes('mas datos') || h.includes('información'));
        const colImporte = headers.findIndex(h => h.includes('importe') || h.includes('cantidad') || (h.includes('valor') && !h.includes('fecha')));
        const colSaldo = headers.findIndex(h => h.includes('saldo') || h.includes('balance'));

        if (colFecha === -1 || colMov === -1 || colImporte === -1) {
          throw new Error('Faltan columnas esenciales: "Fecha", "Movimiento" o "Importe".');
        }

        let ignoredCount = 0;
        const movements: ParsedMovement[] = [];
        const limitDate = lastUpdateLimit ? lastUpdateLimit.split('T')[0] : '';

        // Loop over data rows starting after the header
        for (let i = headerIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;
          
          // Skip completely empty rows or summary/info rows
          const rawFecha = row[colFecha];
          const rawMov = row[colMov];
          const rawImporte = row[colImporte];
          
          if (!rawFecha || !rawMov || rawImporte === undefined) continue;

          // Perform formatting conversions
          const formattedFecha = parseExcelDate(rawFecha);
          if (!formattedFecha || !formattedFecha.includes('-')) continue; // invalid date skip

          // Filter out rows with date <= lastUpdateLimit date part
          if (limitDate && formattedFecha <= limitDate) {
            ignoredCount++;
            continue;
          }

          const formattedFechaValor = colFechaValor !== -1 ? parseExcelDate(row[colFechaValor]) : formattedFecha;
          const cleanedImporte = parseExcelAmount(rawImporte);
          const cleanedSaldo = colSaldo !== -1 ? parseExcelAmount(row[colSaldo]) : 0;
          
          // Derive year and month from formatted date
          const dateParts = formattedFecha.split('-');
          const anyo = parseInt(dateParts[0], 10);
          const mes = parseInt(dateParts[1], 10);
          const mes_nombre = getMonthName(mes).charAt(0).toUpperCase() + getMonthName(mes).slice(1);

          movements.push({
            fecha: formattedFecha,
            fecha_valor: formattedFechaValor,
            anyo,
            mes,
            mes_nombre,
            movimiento: String(rawMov).trim(),
            mas_datos: colMasDatos !== -1 && row[colMasDatos] ? String(row[colMasDatos]).trim() : null,
            importe: cleanedImporte,
            saldo: cleanedSaldo,
            concepto_reducido: String(rawMov).trim(),
            categoria: 'Sin clasificar'
          });
        }

        if (movements.length === 0) {
          if (ignoredCount > 0) {
            throw new Error(`Todos los registros (${ignoredCount}) han sido omitidos por ser de fecha igual o anterior a la última actualización (${new Date(limitDate).toLocaleDateString('es-ES')}).`);
          }
          throw new Error('No se encontraron registros de movimientos válidos.');
        }

        setFileData(movements);
        setCurrentPage(1);
        
        let successMsg = `¡Fichero leído con éxito! Se cargaron ${movements.length} movimientos nuevos.`;
        if (ignoredCount > 0) {
          successMsg += ` Se omitieron ${ignoredCount} apuntes duplicados por ser de fecha igual o anterior a la última actualización (${new Date(limitDate).toLocaleDateString('es-ES')}).`;
        }
        onNotify(successMsg, 'success');
      } catch (err: any) {
        console.error(err);
        onNotify(err.message || 'Error al procesar el archivo Excel.', 'error');
      }
    };

    reader.onerror = () => {
      onNotify('Error al leer el archivo físico.', 'error');
    };

    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const clearImport = () => {
    setFileData([]);
    setFileName('');
    setSearchTerm('');
    setFilterType('all');
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onNotify('Carga limpiada correctamente.', 'info');
  };

  const handleSaveToDatabase = async () => {
    if (fileData.length === 0) return;
    
    setIsSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('No se pudo identificar al usuario activo para realizar la inserción.');
      }

      // Map and prepare ONLY the 6 specified data rows + user_id to insert into movimientos_bancarios
      const rowsToInsert = fileData.map(item => ({
        fecha: item.fecha,
        fecha_valor: item.fecha_valor,
        movimiento: item.movimiento,
        mas_datos: item.mas_datos,
        importe: item.importe,
        saldo: item.saldo,
        user_id: userData.user.id
      }));

      const { data, error } = await supabase
        .from('movimientos_bancarios')
        .insert(rowsToInsert);

      if (error) throw error;

      onNotify(`¡Excelente! Se han insertado con éxito ${fileData.length} movimientos en la base de datos.`, 'success');
      
      // Clear loaded file data after successful insert
      setFileData([]);
      setFileName('');
      setSearchTerm('');
      setFilterType('all');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh the last update cutoff limit date
      const { data: updateData } = await supabase
        .from('vista_saldo_actual')
        .select('ultima_actualizacion')
        .maybeSingle();
      if (updateData) {
        setLastUpdateLimit(updateData.ultima_actualizacion);
      }
    } catch (err: any) {
      console.error("Error inserting to DB:", err);
      // Show full error message on screen as requested
      onNotify(err.message || err.details || 'Error al insertar en la base de datos.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Sorting Handler
  const requestSort = (field: keyof ParsedMovement) => {
    let isAsc = true;
    if (sortField === field) {
      isAsc = !sortAscending;
    }
    setSortField(field);
    setSortAscending(isAsc);
    setCurrentPage(1);
  };

  // Filter & Search Logic
  const filteredData = fileData.filter(item => {
    const matchesSearch = 
      item.movimiento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.mas_datos && item.mas_datos.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'income' && item.importe >= 0) ||
      (filterType === 'expense' && item.importe < 0);

    return matchesSearch && matchesFilter;
  });

  // Sorting logic
  const sortedData = [...filteredData].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null) return 1;
    if (valB === null) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    
    // Numbers or other types
    return sortAscending 
      ? (valA as number) - (valB as number) 
      : (valB as number) - (valA as number);
  });

  // Pagination bounds
  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedData.slice(indexOfFirstRow, indexOfLastRow);

  // Calculation Metrics for summary cards
  const summaryIncome = fileData.filter(item => item.importe >= 0).reduce((sum, item) => sum + item.importe, 0);
  const summaryExpense = fileData.filter(item => item.importe < 0).reduce((sum, item) => sum + Math.abs(item.importe), 0);
  
  const getMinMaxDates = () => {
    if (fileData.length === 0) return { min: '', max: '' };
    const dates = fileData.map(item => new Date(item.fecha).getTime()).sort();
    return {
      min: new Date(dates[0]).toLocaleDateString('es-ES'),
      max: new Date(dates[dates.length - 1]).toLocaleDateString('es-ES')
    };
  };
  const dateRange = getMinMaxDates();

  return (
    <div className="space-y-6 fade-in">
      {/* Rose Dashboard Header Banner */}
      <div className="bg-rose-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Upload className="w-8 h-8" />
              Importación de Apuntes
            </h2>
            <p className="mt-2 text-rose-100 max-w-xl">
              Carga, limpia y previsualiza movimientos directamente desde el Excel o CSV de tu banco antes de sincronizarlos.
            </p>
          </div>
          {fileName && (
            <div className="flex flex-wrap gap-3 shrink-0 self-start md:self-auto">
              <button
                onClick={handleSaveToDatabase}
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md text-sm border border-emerald-400/30"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Insertando...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Insertar en BD ({fileData.length})
                  </>
                )}
              </button>
              
              <button
                onClick={clearImport}
                disabled={isSaving}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 backdrop-blur-md text-white border border-white/20 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-inner font-semibold text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar Carga
              </button>
            </div>
          )}
        </div>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <Sparkles className="w-72 h-72" />
        </div>
      </div>

      {fileData.length === 0 ? (
        /* FILE UPLOAD SCREEN */
        <div className="grid grid-cols-1 gap-6">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              bg-white dark:bg-slate-800 rounded-2xl p-12 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer min-h-[350px] shadow-sm
              ${isDragOver 
                ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 scale-[1.01]' 
                : 'border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-800 hover:shadow-md'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            
            <div className={`p-5 rounded-full mb-6 transition-all duration-300 ${isDragOver ? 'bg-rose-500 text-white scale-110' : 'bg-rose-50 dark:bg-rose-900/10 text-rose-500 dark:text-rose-400'}`}>
              <Upload className="w-12 h-12 animate-pulse" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Arrastra tu archivo aquí</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm mb-6">
              Soporta archivos de Excel bancarios en formato <span className="font-semibold text-rose-500">.xlsx</span>, <span className="font-semibold text-rose-500">.xls</span> o <span className="font-semibold text-rose-500">.csv</span>.
            </p>
            
            <button className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-rose-200 dark:shadow-none hover:shadow-xl transition-all text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Examinar Archivos
            </button>
            
            {lastUpdateLimit && (
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800/80 font-medium shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Última actualización en base de datos: **{new Date(lastUpdateLimit).toLocaleDateString('es-ES')}**. Los apuntes iguales o anteriores se omitirán para evitar duplicados.</span>
              </div>
            )}
          </div>

          {/* Guidelines / Format Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 text-sm uppercase tracking-wide opacity-80">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              Formato esperado de las columnas en tu Excel:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-3">
                <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-600 p-2 rounded-lg shrink-0 mt-0.5 font-bold text-xs">1</div>
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Fechas (A y B)</h5>
                  <p className="text-xs">
                    Las columnas **Fecha** y **Fecha valor** deben estar en formato español `DD/MM/AAAA` (ej: `17/01/2026`). El sistema las convertirá automáticamente a `AAAA-MM-DD`.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 p-2 rounded-lg shrink-0 mt-0.5 font-bold text-xs">2</div>
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Movimiento y Más datos</h5>
                  <p className="text-xs">
                    Descripción del cargo (Col C) e información adicional (Col D). Se preservarán íntegramente y se usarán para la clasificación.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-600 p-2 rounded-lg shrink-0 mt-0.5 font-bold text-xs">3</div>
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Importes (E y F)</h5>
                  <p className="text-xs">
                    Las columnas **Importe** y **Saldo** (con separadores de miles `.` y decimales `,` como `-53,99` o `72.797,79`) se limpiarán y parsearán a números flotantes nativos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PREVIEW DASHBOARD SCREEN */
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registros Leídos</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{fileData.length}</h3>
                <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]" title={fileName}>{fileName}</p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ingresos Detectados</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(summaryIncome)}</h3>
                <p className="text-[10px] text-emerald-500 mt-1">Suma de valores positivos</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-500">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gastos Detectados</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(summaryExpense)}</h3>
                <p className="text-[10px] text-rose-500 mt-1">Suma de valores negativos</p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-500">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rango Temporal</p>
                <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2 leading-tight">
                  {dateRange.min}
                  <span className="block text-xs font-medium text-slate-400 my-0.5">al</span>
                  {dateRange.max}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Interactive Preview Table Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col relative">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Previsualización de Datos Convertidos</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Revisa la conversión de fechas, importes y saldos en tiempo real.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                {/* Search box */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar movimiento..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm transition-all text-slate-700 dark:text-white"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                
                {/* Filter Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl shrink-0">
                  <button 
                    onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => { setFilterType('income'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'income' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Ingresos
                  </button>
                  <button 
                    onClick={() => { setFilterType('expense'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === 'expense' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Gastos
                  </button>
                </div>
              </div>
            </div>

            {/* Info conversion warning alert */}
            <div className="bg-rose-50/50 dark:bg-rose-950/10 border-b border-rose-100 dark:border-rose-900/30 px-6 py-2.5 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-400">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                **Nota:** Fechas e importes han sido adaptados al estándar de almacenamiento de la base de datos (fechas en formato **AAAA-MM-DD** e importes en números decimales con signo).
              </span>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th onClick={() => requestSort('fecha')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none">
                      <div className="flex items-center gap-1.5">
                        Fecha
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                    <th onClick={() => requestSort('fecha_valor')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none">
                      <div className="flex items-center gap-1.5">
                        Fecha Valor
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                    <th onClick={() => requestSort('movimiento')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none">
                      <div className="flex items-center gap-1.5">
                        Concepto / Movimiento
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                    <th className="px-6 py-4">Información Adicional</th>
                    <th onClick={() => requestSort('importe')} className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none">
                      <div className="flex items-center gap-1.5 justify-end">
                        Importe
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                    <th onClick={() => requestSort('saldo')} className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none">
                      <div className="flex items-center gap-1.5 justify-end">
                        Saldo
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        Ningún movimiento coincide con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors text-sm">
                        <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap font-mono">{row.fecha}</td>
                        <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap font-mono">{row.fecha_valor}</td>
                        <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">{row.movimiento}</td>
                        <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 italic text-xs max-w-[200px] truncate" title={row.mas_datos || ''}>
                          {row.mas_datos || '-'}
                        </td>
                        <td className={`px-6 py-3.5 text-right font-bold font-mono whitespace-nowrap ${row.importe >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.importe >= 0 ? '+' : ''}{row.importe.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                          {row.saldo.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Rows count Footer */}
            {totalRecords > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Mostrar</span>
                  <select 
                    value={rowsPerPage} 
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 outline-none font-semibold focus:ring-1 focus:ring-rose-500"
                  >
                    <option value={10}>10 filas</option>
                    <option value={25}>25 filas</option>
                    <option value={50}>50 filas</option>
                  </select>
                  <span>de {totalRecords} movimientos filtrados (total {fileData.length})</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold">Página {currentPage} de {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportDashboard;
