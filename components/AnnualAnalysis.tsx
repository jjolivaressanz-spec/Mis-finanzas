
import React, { useState, useEffect } from 'react';
import { supabase, formatCurrency } from '../services/supabase';
import { Filter, ChevronRight, ChevronDown, Loader2, ArrowUpCircle, ArrowDownCircle, BarChart3, Table2, FileDown, Minimize2, Maximize2 } from 'lucide-react';
import YearSelector from './YearSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AnnualAnalysisProps {
  onError: (msg: string) => void;
}

// Interface for the detailed breakdown
interface BreakdownRow {
  originalName: string;
  months: number[];
  total: number;
}

// Updated Concept Row structure containing pre-calculated breakdown
interface ConceptRow {
  name: string;
  months: number[]; // Index 0 = Jan, 11 = Dec
  total: number;
  hasMultipleOrigins: boolean; // True only if >1 unique original names exist
  breakdown: BreakdownRow[];
}

interface CategoryGroup {
  name: string;
  rows: ConceptRow[];
  monthlyTotals: number[];
  grandTotal: number;
}

interface FinancialData {
  income: CategoryGroup[];
  expenses: CategoryGroup[];
  totalIncomeByMonth: number[];
  totalIncomeYear: number;
  totalExpenseByMonth: number[];
  totalExpenseYear: number;
}

const AnnualAnalysis: React.FC<AnnualAnalysisProps> = ({ onError }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [isReducedView, setIsReducedView] = useState(false);
  const [data, setData] = useState<FinancialData>({
    income: [],
    expenses: [],
    totalIncomeByMonth: Array(12).fill(0),
    totalIncomeYear: 0,
    totalExpenseByMonth: Array(12).fill(0),
    totalExpenseYear: 0
  });
  
  // Inline Expansion State (key format: "type|category|concept")
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const fetchAnnualData = async () => {
    setLoading(true);
    setExpandedKeys(new Set());
    try {
      // Fetch raw data to calculate distinct original names client-side
      const { data, error } = await supabase
        .from('movimientos_bancarios')
        .select('categoria, concepto_reducido, movimiento, importe, mes')
        .eq('anyo', year);

      if (error) throw error;

      processData(data || []);
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Error cargando análisis anual');
    } finally {
      setLoading(false);
    }
  };

  const processData = (raw: any[]) => {
    // Helper to process a subset of rows into CategoryGroups
    const buildMatrix = (rows: any[], isExpense: boolean) => {
      const categories: Record<string, Record<string, {
        months: number[];
        breakdownMap: Record<string, number[]>;
      }>> = {};

      rows.forEach(row => {
        const cat = row.categoria || 'Sin clasificar';
        const concept = row.concepto_reducido || row.movimiento || 'Varios';
        const monthIdx = (row.mes || 0) - 1;
        // Use absolute value for display
        const amount = Math.abs(row.importe);

        if (monthIdx < 0 || monthIdx > 11) return;

        if (!categories[cat]) categories[cat] = {};
        if (!categories[cat][concept]) {
          categories[cat][concept] = {
            months: Array(12).fill(0),
            breakdownMap: {}
          };
        }

        // Add to main concept total
        categories[cat][concept].months[monthIdx] += amount;

        // Add to breakdown map (grouping by original name)
        const origin = row.movimiento;
        if (!categories[cat][concept].breakdownMap[origin]) {
          categories[cat][concept].breakdownMap[origin] = Array(12).fill(0);
        }
        categories[cat][concept].breakdownMap[origin][monthIdx] += amount;
      });

      // Convert to Array structure
      return Object.keys(categories).sort().map(catName => {
        const conceptsObj = categories[catName];
        const rowsArr: ConceptRow[] = Object.keys(conceptsObj).sort().map(conceptName => {
          const { months, breakdownMap } = conceptsObj[conceptName];
          const total = months.reduce((a, b) => a + b, 0);
          
          const breakdownKeys = Object.keys(breakdownMap);
          const hasMultipleOrigins = breakdownKeys.length > 1;
          
          const breakdown = breakdownKeys.map(origin => ({
            originalName: origin,
            months: breakdownMap[origin],
            total: breakdownMap[origin].reduce((a, b) => a + b, 0)
          })).sort((a, b) => b.total - a.total);

          return {
            name: conceptName,
            months,
            total,
            hasMultipleOrigins,
            breakdown
          };
        });

        // Calculate Category Totals
        const monthlyTotals = Array(12).fill(0);
        let grandTotal = 0;

        rowsArr.forEach(r => {
          r.months.forEach((val, idx) => monthlyTotals[idx] += val);
          grandTotal += r.total;
        });

        return {
          name: catName,
          rows: rowsArr,
          monthlyTotals,
          grandTotal
        };
      });
    };

    // 1. Split Raw Data by Sign
    const incomeRows = raw.filter(r => r.importe >= 0);
    const expenseRows = raw.filter(r => r.importe < 0);

    // 2. Build Matrices
    const incomeGroups = buildMatrix(incomeRows, false);
    const expenseGroups = buildMatrix(expenseRows, true);

    // 3. Calculate Global Totals
    const totalIncomeByMonth = Array(12).fill(0);
    let totalIncomeYear = 0;
    incomeGroups.forEach(g => {
      g.monthlyTotals.forEach((val, idx) => totalIncomeByMonth[idx] += val);
      totalIncomeYear += g.grandTotal;
    });

    const totalExpenseByMonth = Array(12).fill(0);
    let totalExpenseYear = 0;
    expenseGroups.forEach(g => {
      g.monthlyTotals.forEach((val, idx) => totalExpenseByMonth[idx] += val);
      totalExpenseYear += g.grandTotal;
    });

    setData({
      income: incomeGroups,
      expenses: expenseGroups,
      totalIncomeByMonth,
      totalIncomeYear,
      totalExpenseByMonth,
      totalExpenseYear
    });
  };

  const toggleRow = (type: 'income' | 'expense', category: string, concept: string) => {
    const key = `${type}|${category}|${concept}`;
    const newExpanded = new Set(expandedKeys);

    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Set background color (Light Gray)
    doc.setFillColor(248, 249, 250);
    doc.rect(0, 0, 297, 210, 'F');

    // --- Colors ---
    const colorIncome: [number, number, number] = [16, 185, 129]; // Emerald 500
    const colorExpense: [number, number, number] = [59, 130, 246]; // Blue 500
    const colorNet: [number, number, number] = [30, 41, 59]; // Slate 800
    const colorText = [50, 50, 50];
    const colorLightText = [100, 100, 100];

    // --- Helpers ---
    const formatCurrencySimple = (val: number) => val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
    const formatVal = (val: number) => val !== 0 ? val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';

    // --- Header ---
    doc.setFontSize(18);
    doc.setTextColor(colorText[0], colorText[1], colorText[2]);
    doc.text(`Análisis Anual - ${year}`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(colorLightText[0], colorLightText[1], colorLightText[2]);
    doc.text('Resumen Financiero Global', 14, 20);

    // --- KPI Cards (Top Left) ---
    const drawCard = (x: number, y: number, title: string, value: number, color: number[]) => {
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, 60, 20, 2, 2, 'FD');
      
      doc.setFontSize(9);
      doc.setTextColor(colorText[0], colorText[1], colorText[2]);
      doc.text(title, x + 3, y + 6);
      
      doc.setFontSize(14);
      doc.setTextColor(colorText[0], colorText[1], colorText[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrencySimple(value), x + 3, y + 16);
      
      // Draw Arrow using vector lines (prevents font issues)
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.4);
      const ax = x + 54;
      const ay = y + 7;
      // Diagonal line (bottom-left to top-right)
      doc.line(ax - 1.5, ay + 1.5, ax + 1.5, ay - 1.5);
      // Arrowhead
      doc.line(ax + 1.5, ay - 1.5, ax - 0.5, ay - 1.5);
      doc.line(ax + 1.5, ay - 1.5, ax + 1.5, ay + 0.5);
      
      doc.setFontSize(8);
      doc.setTextColor(colorLightText[0], colorLightText[1], colorLightText[2]);
      doc.setFont('helvetica', 'normal');
      doc.text('Ene-Dic', x + 48, y + 16);
    };

    drawCard(14, 25, 'Ingresos Totales Acumulados', data.totalIncomeYear, colorIncome);
    drawCard(78, 25, 'Gastos Totales Acumulados', data.totalExpenseYear, colorExpense);
    
    const netBalance = data.totalIncomeYear - data.totalExpenseYear;
    const netColor = netBalance >= 0 ? colorIncome : [239, 68, 68]; // Red for negative
    drawCard(142, 25, 'Balance Neto Actual', netBalance, netColor);


    // --- Charts Area (Right Side) ---
    // Bar Chart: Ingresos vs Gastos Mensuales
    const chartX = 210;
    const chartY = 25;
    const chartW = 75;
    const chartH = 50;
    const chartPadding = 4;
    const titleHeight = 8;
    const xAxisHeight = 4;
    const yAxisWidth = 8;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ingresos vs Gastos Mensuales (${year})`, chartX + chartW / 2, chartY + 6, { align: 'center' });

    // Chart Area Dimensions
    const plotX = chartX + chartPadding + yAxisWidth;
    const plotY = chartY + titleHeight;
    const plotW = chartW - (chartPadding * 2) - yAxisWidth;
    const plotH = chartH - titleHeight - chartPadding - xAxisHeight;
    const plotBottom = plotY + plotH;

    const maxVal = Math.max(...data.totalIncomeByMonth, ...data.totalExpenseByMonth, 1);
    // Round up maxVal to nice number
    const niceMax = Math.ceil(maxVal / 1000) * 1000 || 1000;

    // Draw Grid & Y-Axis Labels
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const val = (niceMax / steps) * i;
        const yPos = plotBottom - ((val / niceMax) * plotH);
        
        // Grid line
        doc.setDrawColor(240, 240, 240);
        doc.line(plotX, yPos, plotX + plotW, yPos);
        
        // Label (Compact format: 1k, 2k...)
        const label = val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toString();
        doc.text(label, plotX - 1, yPos + 1, { align: 'right' });
    }

    // Draw Bars & X-Axis Labels
    const barGroupW = plotW / 12;
    const barW = barGroupW * 0.35;
    const barSpacing = barGroupW * 0.1;
    
    const monthInitials = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

    data.totalIncomeByMonth.forEach((inc, i) => {
        const exp = data.totalExpenseByMonth[i];
        const xCenter = plotX + (i * barGroupW) + (barGroupW / 2);
        
        // Income Bar
        const incH = (inc / niceMax) * plotH;
        doc.setFillColor(colorIncome[0], colorIncome[1], colorIncome[2]);
        if (inc > 0) doc.rect(xCenter - barW - (barSpacing/2), plotBottom - incH, barW, incH, 'F');

        // Expense Bar
        const expH = (exp / niceMax) * plotH;
        doc.setFillColor(colorExpense[0], colorExpense[1], colorExpense[2]);
        if (exp > 0) doc.rect(xCenter + (barSpacing/2), plotBottom - expH, barW, expH, 'F');

        // X-Axis Label
        doc.setTextColor(100, 100, 100);
        doc.text(monthInitials[i], xCenter, plotBottom + 3, { align: 'center' });
    });

    // Donut Chart: Composición de Gastos
    const donutX = 210;
    const donutY = 80;
    const donutW = 75;
    const donutH = 60; // Taller to accommodate legend

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(donutX, donutY, donutW, donutH, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Composición de Gastos (${year})`, donutX + donutW / 2, donutY + 6, { align: 'center' });

    // Calculate expenses and group categories with < 4% under "Otros" (so LUA is shown at 4.51%)
    const expenseCategories = data.expenses.map(g => ({ name: g.name, total: g.grandTotal }))
                                           .sort((a, b) => b.total - a.total);
    
    const totalAllExpenses = expenseCategories.reduce((acc, curr) => acc + curr.total, 0);
    const threshold = totalAllExpenses > 0 ? totalAllExpenses * 0.04 : 0;

    const mainExpenses = totalAllExpenses > 0 
      ? expenseCategories.filter(curr => curr.total >= threshold)
      : [...expenseCategories];
    const otherExpenses = totalAllExpenses > 0 
      ? expenseCategories.filter(curr => curr.total < threshold)
      : [];
    const otherExpensesTotal = otherExpenses.reduce((acc, curr) => acc + curr.total, 0);

    const topExpenses = [...mainExpenses];
    if (otherExpensesTotal > 0) {
        topExpenses.push({ name: 'Otros', total: otherExpensesTotal });
    }
    const totalExpForChart = totalAllExpenses || 1;

    // Chart Dimensions
    const centerX = donutX + 55;
    const centerY = donutY + 35;
    const outerRadius = 16;
    const innerRadius = 9;
    
    // Expanded, harmonized 15-color palette (no repeats!)
    const pieColors = [
        [59, 130, 246],  // Blue (Vibrant)
        [16, 185, 129],  // Emerald (Green)
        [245, 158, 11],  // Amber (Orange-yellow)
        [239, 68, 68],   // Red (Vibrant)
        [139, 92, 246],  // Violet (Purple)
        [20, 184, 166],  // Teal (Cyan-green)
        [249, 115, 22],  // Orange (Vibrant)
        [236, 72, 153],  // Pink (Vibrant)
        [99, 102, 241],  // Indigo (Deep Blue)
        [14, 165, 233],  // Sky (Light Blue)
        [217, 70, 239],  // Fuchsia (Magenta)
        [132, 204, 22],  // Lime (Yellow-green)
        [6, 182, 212],   // Cyan (Light Teal)
        [234, 179, 8],    // Yellow (Vibrant)
        [168, 85, 247]   // Purple (Medium Purple)
    ];

    let currentAngle = -Math.PI / 2; // Start at 12 o'clock
    let activeColorIndex = 0;

    topExpenses.forEach((item, index) => {
        const sliceFraction = item.total / totalExpForChart;
        const sliceAngle = sliceFraction * 2 * Math.PI;
        const endAngle = currentAngle + sliceAngle;
        
        // Define color: Neutral slate gray for 'Otros', cycle unique palette for others
        let color = [100, 116, 139]; 
        if (item.name.toLowerCase() !== 'otros') {
            color = pieColors[activeColorIndex % pieColors.length];
            activeColorIndex++;
        }
        
        // Draw Slice (Donut Segment)
        // We approximate the arc using small line segments
        const points: {x: number, y: number}[] = [];
        const step = 0.1; // radian step

        // Outer Arc
        for (let a = currentAngle; a < endAngle; a += step) {
            points.push({
                x: centerX + outerRadius * Math.cos(a),
                y: centerY + outerRadius * Math.sin(a)
            });
        }
        points.push({
            x: centerX + outerRadius * Math.cos(endAngle),
            y: centerY + outerRadius * Math.sin(endAngle)
        });

        // Inner Arc (Reverse)
        for (let a = endAngle; a > currentAngle; a -= step) {
            points.push({
                x: centerX + innerRadius * Math.cos(a),
                y: centerY + innerRadius * Math.sin(a)
            });
        }
        points.push({
            x: centerX + innerRadius * Math.cos(currentAngle),
            y: centerY + innerRadius * Math.sin(currentAngle)
        });

        // Convert to relative lines for jsPDF
        if (points.length > 0) {
            const startX = points[0].x;
            const startY = points[0].y;
            const lines: number[][] = [];
            
            for (let i = 1; i < points.length; i++) {
                lines.push([points[i].x - points[i-1].x, points[i].y - points[i-1].y]);
            }
            
            doc.setFillColor(color[0], color[1], color[2]);
            doc.lines(lines, startX, startY, [1, 1], 'F', true);
        }

        // Draw Legend (dynamically space and scale font size if there are many slices)
        const N = topExpenses.length;
        const spacing = N > 6 ? Math.min(7, 40 / N) : 7;
        const legendY = donutY + 12 + (index * spacing);
        const rectSize = N > 6 ? 2 : 3;
        const fontSize = N > 8 ? 5.5 : (N > 6 ? 6.5 : 7);
        
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(donutX + 5, legendY, rectSize, rectSize, 'F');
        doc.setFontSize(fontSize);
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        const percent = ((item.total / totalExpForChart) * 100).toFixed(1);
        // Truncate name if too long
        let name = item.name;
        if (name.length > 15) name = name.substring(0, 13) + '...';
        doc.text(`${name} (${percent}%)`, donutX + 10, legendY + (N > 6 ? (N > 8 ? 1.8 : 2.2) : 2.5));

        currentAngle = endAngle;
    });
    
    // Draw "Total" text in the hole
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);
    doc.text('Total', centerX, centerY - 2, { align: 'center' });
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrencySimple(totalExpForChart), centerX, centerY + 2, { align: 'center' });


    // --- Tables (Left Side) ---
    const allMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Define column styles for alignment
    // Total width available: 297 - 14 (left) - 90 (right) = 193mm
    // Col 0: 35mm
    // Cols 1-12: 11mm * 12 = 132mm
    // Col 13 (Total): 26mm
    // Total: 35 + 132 + 26 = 193mm
    const tableColStyles = {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 },
        1: { cellWidth: 11, halign: 'right' },
        2: { cellWidth: 11, halign: 'right' },
        3: { cellWidth: 11, halign: 'right' },
        4: { cellWidth: 11, halign: 'right' },
        5: { cellWidth: 11, halign: 'right' },
        6: { cellWidth: 11, halign: 'right' },
        7: { cellWidth: 11, halign: 'right' },
        8: { cellWidth: 11, halign: 'right' },
        9: { cellWidth: 11, halign: 'right' },
        10: { cellWidth: 11, halign: 'right' },
        11: { cellWidth: 11, halign: 'right' },
        12: { cellWidth: 11, halign: 'right' },
        13: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    };

    // 1. Ingresos Table
    const incomeBody = data.income.map(g => [
        g.name,
        ...g.monthlyTotals.map(v => formatVal(v)),
        formatCurrencySimple(g.grandTotal)
    ]);
    
    // Add Total Row for Income
    incomeBody.push([
        'TOTAL INGRESOS',
        ...data.totalIncomeByMonth.map(v => formatVal(v)),
        formatCurrencySimple(data.totalIncomeYear)
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['INGRESOS', ...allMonths, 'Total']],
        body: incomeBody,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1, halign: 'right' },
        headStyles: { fillColor: colorIncome, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' },
        columnStyles: tableColStyles as any,
        margin: { left: 14, right: 90 }, // Leave space for charts
        didParseCell: (data) => {
            if (data.row.index === incomeBody.length - 1) {
                data.cell.styles.fillColor = colorIncome;
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // 2. Gastos Table
    const expenseBody = data.expenses.map(g => [
        g.name,
        ...g.monthlyTotals.map(v => formatVal(v)),
        formatCurrencySimple(g.grandTotal)
    ]);

    // Add Total Row for Expenses
    expenseBody.push([
        'TOTAL GASTOS',
        ...data.totalExpenseByMonth.map(v => formatVal(v)),
        formatCurrencySimple(data.totalExpenseYear)
    ]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [['GASTOS', ...allMonths, 'Total']],
        body: expenseBody,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1, halign: 'right' },
        headStyles: { fillColor: colorExpense, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' },
        columnStyles: tableColStyles as any,
        margin: { left: 14, right: 90 },
        didParseCell: (data) => {
            if (data.row.index === expenseBody.length - 1) {
                data.cell.styles.fillColor = colorExpense;
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // 3. Balance Row
    const netByMonth = data.totalIncomeByMonth.map((inc, i) => inc - data.totalExpenseByMonth[i]);
    const netYear = data.totalIncomeYear - data.totalExpenseYear;

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        head: [],
        body: [[
            'BALANCE NETO',
            ...netByMonth.map(v => formatVal(v)),
            formatCurrencySimple(netYear)
        ]],
        theme: 'grid',
        styles: { 
            fontSize: 6, 
            cellPadding: 1.5, 
            halign: 'right', 
            fillColor: colorNet, 
            textColor: [255, 255, 255], 
            fontStyle: 'bold' 
        },
        columnStyles: tableColStyles as any,
        margin: { left: 14, right: 90 },
        didParseCell: (data) => {
             // Colorize net values
             const valStr = data.cell.raw as string;
             if (data.column.index > 0 && typeof valStr === 'string' && valStr !== '-') {
                 const num = parseFloat(valStr.replace('.', '').replace(' €', '').replace(',', '.'));
                 if (num < 0) {
                     data.cell.styles.textColor = [248, 113, 113]; // Red
                 } else {
                     data.cell.styles.textColor = [52, 211, 153]; // Green
                 }
             }
        }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 280, 200, { align: 'right' });
    doc.text(`1 de ${pageCount}`, 148, 200, { align: 'center' });

    doc.save(`Analisis_Anual_${year}.pdf`);
  };

  useEffect(() => {
    fetchAnnualData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const getCellClass = (val: number, isSubRow = false) => {
    if (val === 0) return 'text-gray-300 dark:text-slate-800';
    return isSubRow 
      ? 'text-gray-600 dark:text-gray-400 font-normal' 
      : 'text-gray-700 dark:text-gray-200 font-medium';
  };

  // Helper component to render a list of groups (Income or Expense)
  const RenderSection = ({ groups, type }: { groups: CategoryGroup[], type: 'income' | 'expense' }) => {
    const isIncome = type === 'income';
    const textColor = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';
    const headerBg = isIncome ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-blue-50/50 dark:bg-blue-900/10';
    const stickyHeaderBg = isIncome ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
    const borderLeftColor = isIncome ? 'border-l-emerald-500' : 'border-l-blue-500';

    return (
      <>
        {groups.map((group) => (
          <React.Fragment key={`${type}-${group.name}`}>
            {/* Category Header Row */}
            <tr className={headerBg}>
              <td className={`sticky left-0 z-10 ${stickyHeaderBg} px-4 py-2 text-left font-bold ${textColor} text-sm border-r border-gray-200 dark:border-slate-700 border-l-4 ${borderLeftColor}`}>
                {group.name}
              </td>
              {group.monthlyTotals.map((total, idx) => (
                <td key={idx} className={`px-3 py-2 text-xs font-bold ${textColor}`}>
                   {total > 0 ? formatCurrency(total).replace('€', '') : '-'}
                </td>
              ))}
              <td className={`px-4 py-2 text-sm font-bold ${textColor} opacity-80 bg-white/50 dark:bg-black/20`}>
                {formatCurrency(group.grandTotal)}
              </td>
            </tr>
            
            {/* Concept Rows */}
            {!isReducedView && group.name !== 'Sin clasificar' && group.rows.map((row) => {
              const rowKey = `${type}|${group.name}|${row.name}`;
              const isExpanded = expandedKeys.has(rowKey);
              const showDropdown = row.hasMultipleOrigins;

              return (
                <React.Fragment key={rowKey}>
                  {/* Main Row */}
                  <tr className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors group ${isExpanded ? 'bg-gray-50 dark:bg-slate-800/50' : ''}`}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-gray-50 dark:group-hover:bg-slate-700/30 px-4 py-2 text-left text-sm border-r border-gray-100 dark:border-slate-700 pl-8">
                      <div 
                        className={`flex items-center gap-2 select-none ${showDropdown ? 'cursor-pointer' : ''}`}
                        onClick={() => showDropdown && toggleRow(type, group.name, row.name)}
                      >
                        {showDropdown && (
                          <div className="text-gray-400 hover:text-blue-500 transition-colors">
                             {isExpanded ? (
                               <ChevronDown className="w-3 h-3" />
                             ) : (
                               <ChevronRight className="w-3 h-3" />
                             )}
                          </div>
                        )}
                        <span className={`${isExpanded ? `font-bold ${textColor}` : 'text-gray-600 dark:text-gray-300'} ${!showDropdown ? 'ml-5' : ''}`}>
                          {row.name}
                        </span>
                      </div>
                    </td>
                    {row.months.map((val, mIdx) => (
                      <td key={mIdx} className={`px-3 py-2 text-xs border-r border-dashed border-gray-100 dark:border-slate-800 ${getCellClass(val)}`}>
                         {val > 0 ? val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gray-50/50 dark:bg-slate-800/50 border-l border-gray-200 dark:border-slate-700">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>

                  {/* Expanded Details Rows */}
                  {isExpanded && row.breakdown.map((detail, dIdx) => (
                     <tr key={`${rowKey}-detail-${dIdx}`} className="bg-gray-50/50 dark:bg-slate-800/20">
                        <td className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-900 px-4 py-1.5 text-left text-xs border-r border-gray-100 dark:border-slate-700 pl-14 text-gray-500 dark:text-gray-400 font-mono italic truncate max-w-[240px]" title={detail.originalName}>
                           {detail.originalName.toLowerCase()}
                        </td>
                        {detail.months.map((val, mIdx) => (
                          <td key={mIdx} className={`px-3 py-1.5 text-xs border-r border-dashed border-gray-100 dark:border-slate-800 ${getCellClass(val, true)}`}>
                             {val > 0 ? val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                          </td>
                        ))}
                        <td className="px-4 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100/30 dark:bg-slate-800/30 border-l border-gray-200 dark:border-slate-700">
                          {formatCurrency(detail.total)}
                        </td>
                     </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6 fade-in h-full flex flex-col">
      {/* Premium Indigo Banner */}
      <div className="bg-indigo-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Table2 className="w-8 h-8" />
              Análisis Anual
            </h2>
            <p className="mt-2 text-indigo-100 max-w-xl">
              Matriz completa de ingresos y gastos para {year}. Compara tendencias mensuales y desglosa cada concepto con precisión.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsReducedView(!isReducedView)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 shadow-inner flex items-center gap-2 transition-colors"
              title={isReducedView ? "Ver Vista Detallada" : "Ver Vista Reducida"}
            >
              {isReducedView ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              <span className="hidden sm:inline">{isReducedView ? "Vista Detallada" : "Vista Reducida"}</span>
            </button>
            <button
              onClick={generatePDF}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 shadow-inner flex items-center gap-2 transition-colors"
              title="Exportar PDF"
            >
              <FileDown className="w-5 h-5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-inner">
              <YearSelector 
                 selectedYear={year} 
                 onChange={setYear}
                 className="min-w-[120px]"
              />
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <BarChart3 className="w-72 h-72" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex-1 overflow-hidden flex flex-col relative">
        {loading ? (
           <div className="flex-1 flex items-center justify-center">
             <div className="flex flex-col items-center gap-3">
               <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generando Matriz...</span>
             </div>
           </div>
        ) : data.income.length === 0 && data.expenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Filter className="w-12 h-12 mb-2 opacity-50" />
            <p>No hay datos registrados para el año {year}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-700/50 sticky top-0 z-20">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] min-w-[240px]">
                    {isReducedView ? 'Categoría' : 'Concepto'}
                  </th>
                  {monthLabels.map(m => (
                    <th key={m} className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase min-w-[80px]">
                      {m}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase min-w-[100px] bg-gray-100 dark:bg-slate-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                
                {/* --- INCOME SECTION --- */}
                <tr className="bg-emerald-100/80 dark:bg-emerald-900/40">
                  <td colSpan={14} className="sticky left-0 z-10 px-4 py-3 text-left font-bold text-emerald-800 dark:text-emerald-100 uppercase tracking-wider border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4" />
                    INGRESOS
                  </td>
                </tr>
                {data.income.length > 0 ? (
                  <RenderSection groups={data.income} type="income" />
                ) : (
                   <tr><td colSpan={14} className="py-4 text-center text-gray-400 text-sm italic">Sin ingresos registrados</td></tr>
                )}
                
                {/* Income Total Summary */}
                <tr className="bg-emerald-50 dark:bg-emerald-900/10 font-bold border-t border-emerald-200 dark:border-emerald-800">
                   <td className="sticky left-0 z-10 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 text-right text-emerald-800 dark:text-emerald-200 text-sm">
                      TOTAL INGRESOS
                   </td>
                   {data.totalIncomeByMonth.map((val, idx) => (
                     <td key={idx} className="px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                        {val > 0 ? formatCurrency(val).replace('€', '') : '-'}
                     </td>
                   ))}
                   <td className="px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                     {formatCurrency(data.totalIncomeYear)}
                   </td>
                </tr>

                {/* Spacer Row */}
                <tr><td colSpan={14} className="h-8 bg-gray-50/50 dark:bg-slate-900/50"></td></tr>

                {/* --- EXPENSE SECTION --- */}
                <tr className="bg-blue-100/80 dark:bg-blue-900/40">
                  <td colSpan={14} className="sticky left-0 z-10 px-4 py-3 text-left font-bold text-blue-800 dark:text-blue-100 uppercase tracking-wider border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4" />
                    GASTOS
                  </td>
                </tr>
                {data.expenses.length > 0 ? (
                  <RenderSection groups={data.expenses} type="expense" />
                ) : (
                  <tr><td colSpan={14} className="py-4 text-center text-gray-400 text-sm italic">Sin gastos registrados</td></tr>
                )}
                
                {/* Expense Total Summary */}
                <tr className="bg-blue-50 dark:bg-blue-900/10 font-bold border-t border-blue-200 dark:border-blue-800">
                   <td className="sticky left-0 z-10 bg-blue-50 dark:bg-blue-900/10 px-4 py-3 text-right text-blue-800 dark:text-blue-200 text-sm">
                      TOTAL GASTOS
                   </td>
                   {data.totalExpenseByMonth.map((val, idx) => (
                     <td key={idx} className="px-3 py-3 text-xs text-blue-700 dark:text-blue-300">
                        {val > 0 ? formatCurrency(val).replace('€', '') : '-'}
                     </td>
                   ))}
                   <td className="px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
                     {formatCurrency(data.totalExpenseYear)}
                   </td>
                </tr>

              </tbody>
              
              {/* --- NET BALANCE FOOTER --- */}
              <tfoot className="sticky bottom-0 z-20 bg-gray-800 dark:bg-slate-900 font-bold border-t-2 border-gray-600">
                  <tr>
                    <td className="sticky left-0 z-10 bg-gray-800 dark:bg-slate-900 px-4 py-3 text-left text-white shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)] uppercase tracking-wider">
                      BALANCE NETO
                    </td>
                     {monthLabels.map((_, idx) => {
                       const net = data.totalIncomeByMonth[idx] - data.totalExpenseByMonth[idx];
                       const colorClass = net >= 0 ? 'text-emerald-400' : 'text-rose-400';
                       return (
                         <td key={idx} className={`px-3 py-3 text-xs ${colorClass}`}>
                           {net !== 0 ? formatCurrency(net).replace('€', '') : '-'}
                         </td>
                       );
                     })}
                     <td className={`px-4 py-3 text-sm ${(data.totalIncomeYear - data.totalExpenseYear) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(data.totalIncomeYear - data.totalExpenseYear)}
                     </td>
                  </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnualAnalysis;
