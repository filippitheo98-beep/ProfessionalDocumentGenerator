import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export async function generatePDFFile(risks: any[], companyName: string, companyActivity: string, companyData?: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Document Unique d\'Évaluation des Risques Professionnels (DUERP)', 20, 20);
  
  // Company info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Entreprise: ${companyName || 'Non renseigné'}`, 20, 35);
  doc.text(`Activité: ${companyActivity || 'Non renseigné'}`, 20, 43);
  
  if (companyData) {
    if (companyData.address) doc.text(`Adresse: ${companyData.address}`, 20, 51);
    if (companyData.siret) doc.text(`SIRET: ${companyData.siret}`, 20, 59);
    if (companyData.phone) doc.text(`Téléphone: ${companyData.phone}`, 160, 35);
    if (companyData.email) doc.text(`Email: ${companyData.email}`, 160, 43);
    if (companyData.employeeCount) doc.text(`Nombre d'employés: ${companyData.employeeCount}`, 160, 51);
  }
  
  doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 20, 67);
  doc.text(`Nombre total de risques identifiés: ${risks.length}`, 160, 67);
  
  // Summary section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Répartition des risques par niveau:', 20, 80);
  
  const riskCounts = risks.reduce((acc: any, risk: any) => {
    acc[risk.finalRisk] = (acc[risk.finalRisk] || 0) + 1;
    return acc;
  }, {});
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let yPos = 88;
  Object.entries(riskCounts).forEach(([level, count]) => {
    doc.text(`• ${level}: ${count} risque(s)`, 25, yPos);
    yPos += 6;
  });
  
  // Page break before table
  doc.addPage();
  
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
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 20,
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