import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export async function generateExcelFile(risks: any[], companyName: string): Promise<Buffer> {
  // Prepare data for Excel
  const excelData = risks.map((risk: any, index: number) => ({
    'N°': index + 1,
    'Source': risk.source || '',
    'Type de source': risk.sourceType || '',
    'Type de risque': risk.type,
    'Danger': risk.danger,
    'Gravité': risk.gravity,
    'Fréquence': risk.frequency,
    'Maîtrise': risk.control,
    'Risque final': risk.finalRisk,
    'Mesures de prévention': risk.measures
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Set column widths
  const columnWidths = [
    { wch: 5 },  // N°
    { wch: 20 }, // Source
    { wch: 15 }, // Type de source
    { wch: 15 }, // Type de risque
    { wch: 40 }, // Danger
    { wch: 12 }, // Gravité
    { wch: 12 }, // Fréquence
    { wch: 12 }, // Maîtrise
    { wch: 15 }, // Risque final
    { wch: 50 }  // Mesures de prévention
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Risques');
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return excelBuffer;
}

export async function generatePDFFile(risks: any[], companyName: string, companyActivity: string): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  // Title
  doc.setFontSize(16);
  doc.text('Document Unique d\'Évaluation des Risques Professionnels', 20, 20);
  
  // Company info
  doc.setFontSize(12);
  doc.text(`Entreprise: ${companyName || 'Non renseigné'}`, 20, 30);
  doc.text(`Activité: ${companyActivity || 'Non renseigné'}`, 20, 38);
  doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 20, 46);
  
  // Table headers
  const headers = [
    'N°', 'Source', 'Type', 'Type de risque', 'Danger', 
    'Gravité', 'Fréquence', 'Maîtrise', 'Risque final', 'Mesures de prévention'
  ];
  
  // Table data
  const tableData = risks.map((risk: any, index: number) => [
    index + 1,
    risk.source || '',
    risk.sourceType || '',
    risk.type,
    risk.danger,
    risk.gravity,
    risk.frequency,
    risk.control,
    risk.finalRisk,
    risk.measures
  ]);
  
  // Generate table
  (doc as any).autoTable({
    head: [headers],
    body: tableData,
    startY: 55,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 8 },   // N°
      1: { cellWidth: 25 },  // Source
      2: { cellWidth: 15 },  // Type
      3: { cellWidth: 20 },  // Type de risque
      4: { cellWidth: 45 },  // Danger
      5: { cellWidth: 15 },  // Gravité
      6: { cellWidth: 15 },  // Fréquence
      7: { cellWidth: 15 },  // Maîtrise
      8: { cellWidth: 18 },  // Risque final
      9: { cellWidth: 50 }   // Mesures de prévention
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    }
  });
  
  return Buffer.from(doc.output('arraybuffer'));
}