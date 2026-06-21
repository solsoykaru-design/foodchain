import { useState, useRef, useEffect } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ColumnDef {
  key: string;
  label: string;
  format?: 'number' | 'currency' | 'date' | 'percent' | 'string';
  align?: 'left' | 'right' | 'center';
}

interface ExportButtonProps {
  data: any[];
  columns: ColumnDef[];
  filename: string;
  title: string;
}

function formatCellValue(value: any, format?: string): string {
  if (value === null || value === undefined) return '';
  if (format === 'currency') return `${Number(value).toLocaleString()} ₽`;
  if (format === 'number') return Number(value).toLocaleString();
  if (format === 'percent') return `${Number(value).toFixed(1)}%`;
  if (format === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU');
  }
  return String(value);
}

export default function ExportButton({ data, columns, filename, title }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportXLSX = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [title],
      [],
      columns.map(c => c.label),
      ...data.map(row => columns.map(c => row[c.key] ?? '')),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 20);
    doc.setFontSize(8);
    doc.text(`Создано: ${new Date().toLocaleDateString('ru-RU')}`, 14, 28);
    autoTable(doc, {
      head: [columns.map(c => c.label)],
      body: data.map(row => columns.map(c => formatCellValue(row[c.key], c.format))),
      startY: 34,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`${filename}.pdf`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all active:scale-[0.97]">
        <FileDown size={16} />
        Экспорт
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <button onClick={exportXLSX}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Экспорт XLSX
          </button>
          <button onClick={exportPDF}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
            <FileText size={16} className="text-red-500" />
            Экспорт PDF
          </button>
        </div>
      )}
    </div>
  );
}
