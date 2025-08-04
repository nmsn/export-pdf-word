import 'jspdf';

// 扩展JsPdf类型以包含autoTable方法和lastAutoTable属性
interface JsPdfAutoTableSettings {
  startY?: number;
  theme?: string;
  head?: any[][];
  body?: any[][];
  styles?: any;
  headStyles?: any;
  bodyStyles?: any;
  columnStyles?: any;
}

interface JsPdfAutoTableResult {
  finalY: number;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (settings: JsPdfAutoTableSettings) => void;
    lastAutoTable: JsPdfAutoTableResult;
  }
}