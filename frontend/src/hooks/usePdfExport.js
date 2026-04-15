import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useRef, useCallback } from 'react';

export const usePdfExport = (filename = 'dashboard.pdf') => {
  const exportRef = useRef(null);

  const exportToPdf = useCallback(async () => {
    const element = exportRef.current;
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,           // higher = sharper PDF
      useCORS: true,      // handles cross-origin images if any
      backgroundColor: '#111827', // match your bg-gray-900
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(filename);
  }, [filename]);

  return { exportRef, exportToPdf };
};