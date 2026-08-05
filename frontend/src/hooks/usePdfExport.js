import { useCallback, useRef, useState } from 'react';

/**
 * Exports a DOM subtree to PDF.
 *
 * html2canvas and jsPDF are ~500 KB together, so they are imported lazily —
 * nobody pays for them unless they click Export. The captured background is
 * read from the live theme, otherwise a dark-mode export comes out as dark text
 * on a hard-coded slate page.
 */
export function usePdfExport(filename = 'smartsales-export.pdf') {
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const exportToPdf = useCallback(async () => {
    const element = exportRef.current;
    if (!element) return false;

    setExporting(true);
    setError(null);

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const styles = getComputedStyle(document.documentElement);
      const canvasToken = styles.getPropertyValue('--canvas').trim();
      const background = canvasToken ? `rgb(${canvasToken})` : '#ffffff';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: background,
        // The backdrop is fixed-position decoration; capturing it bands the page.
        ignoreElements: (node) => node.classList?.contains('backdrop-root'),
      });

      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(image, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(filename);
      return true;
    } catch (err) {
      console.error('PDF export failed', err);
      setError(err?.message || 'Could not build the PDF');
      return false;
    } finally {
      setExporting(false);
    }
  }, [filename]);

  return { exportRef, exportToPdf, exporting, error };
}

export default usePdfExport;
