import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export async function generateExcelFile(risks: any[], companyName: string): Promise<Buffer> {
  // Prepare data for Excel with comprehensive information
  const excelData = risks.map((risk: any, index: number) => ({
    'N°': index + 1,
    'Source': risk.source || 'Non spécifié',
    'Type de source': risk.sourceType || 'Non spécifié',
    'Type de risque': risk.type || 'Non spécifié',
    'Danger/Dommage': risk.danger || 'Non spécifié',
    'Gravité': risk.gravity || 'Non spécifié',
    'Valeur Gravité': risk.gravityValue || '',
    'Fréquence': risk.frequency || 'Non spécifié',
    'Valeur Fréquence': risk.frequencyValue || '',
    'Maîtrise': risk.control || 'Non spécifié',
    'Valeur Maîtrise': risk.controlValue || '',
    'Score de risque': risk.riskScore?.toFixed(2) || '0',
    'Priorité': risk.priority || 'Non définie',
    'Mesures de prévention': risk.measures || 'À définir'
  }));

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Set column widths for better readability
  const columnWidths = [
    { wch: 5 },  // N°
    { wch: 20 }, // Source
    { wch: 15 }, // Type de source
    { wch: 20 }, // Type de risque
    { wch: 40 }, // Danger/Dommage
    { wch: 15 }, // Gravité
    { wch: 8 },  // Valeur Gravité
    { wch: 15 }, // Fréquence
    { wch: 8 },  // Valeur Fréquence
    { wch: 15 }, // Maîtrise
    { wch: 8 },  // Valeur Maîtrise
    { wch: 12 }, // Score de risque
    { wch: 20 }, // Priorité
    { wch: 50 }  // Mesures de prévention
  ];
  worksheet['!cols'] = columnWidths;

  // Add title and company info
  const titleData = [
    [`DOCUMENT UNIQUE D'ÉVALUATION DES RISQUES PROFESSIONNELS`],
    [`Entreprise: ${companyName}`],
    [`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`],
    [''], // Empty row
    ['TABLEAU DES RISQUES IDENTIFIÉS']
  ];
  
  // Create title sheet
  const titleSheet = XLSX.utils.aoa_to_sheet(titleData);
  XLSX.utils.book_append_sheet(workbook, titleSheet, 'Page de garde');
  
  // Add main data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analyse des risques');
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return excelBuffer;
}

export async function generatePDFFile(risks: any[], companyName: string, companyActivity: string, companyData?: any, locations?: any[], workStations?: any[], preventionMeasures?: any[], chartImages?: any): Promise<Buffer> {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  // Apply autoTable to the document
  autoTable(doc, {});
  
  // Couleurs définies
  const primaryColor = [41, 128, 185]; // Bleu professionnel
  const accentColor = [52, 152, 219]; // Bleu clair
  const grayColor = [149, 165, 166]; // Gris
  const darkGray = [52, 73, 94]; // Gris foncé
  const lightGray = [236, 240, 241]; // Gris très clair
  const greenColor = [39, 174, 96]; // Vert
  const redColor = [231, 76, 60]; // Rouge
  const orangeColor = [243, 156, 18]; // Orange
  
  // ==== PAGE DE GARDE SIMPLE ====
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 40;
  
  // Titre principal
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT UNIQUE', pageWidth / 2, yPos, { align: 'center' });
  
  // Sous-titre
  doc.setFontSize(16);
  yPos += 20;
  doc.text('D\'ÉVALUATION DES RISQUES PROFESSIONNELS', pageWidth / 2, yPos, { align: 'center' });
  
  // Informations de l'entreprise
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos += 30;
  doc.text(`Entreprise : ${companyName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;
  doc.text(`Secteur : ${companyActivity}`, pageWidth / 2, yPos, { align: 'center' });
  
  // Date
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  yPos += 20;
  const today = new Date().toLocaleDateString('fr-FR');
  doc.text(`Réalisé le : ${today}`, pageWidth / 2, yPos, { align: 'center' });
  
  // ==== TABLEAU DES RISQUES PRINCIPAL ====
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLEAU DES RISQUES IDENTIFIÉS', pageWidth / 2, 30, { align: 'center' });
  
  // Tableau des risques - format simplifié avec 8 colonnes (ajout de la source)
  const tableData = risks.map(risk => [
    risk.type || 'Non spécifié',
    risk.danger || 'Non spécifié',
    risk.source || 'Non spécifié',
    risk.gravity || 'Non spécifié',
    risk.frequency || 'Non spécifié',
    risk.control || 'Non spécifié',
    risk.riskScore ? risk.riskScore.toFixed(2) : '0',
    risk.priority || 'Non défini'
  ]);
  
  autoTable(doc, {
    head: [['Type de risque', 'Danger', 'Source', 'Gravité', 'Fréquence', 'Maîtrise', 'Score', 'Priorité']],
    body: tableData,
    startY: 50,
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.3
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 30, halign: 'left' },
      1: { cellWidth: 35, halign: 'left' },
      2: { cellWidth: 25, halign: 'left' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 25, halign: 'center' }
    },
    margin: { top: 30, left: 14, right: 14, bottom: 30 }
  });
  
  // ==== GRAPHIQUES ====
  if (chartImages && Object.keys(chartImages).length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAPHIQUES D\'ANALYSE', pageWidth / 2, 30, { align: 'center' });
    
    let yPosition = 50;
    Object.entries(chartImages).forEach(([chartName, imageData]: [string, any]) => {
      if (imageData && typeof imageData === 'string') {
        try {
          doc.addImage(imageData, 'PNG', 20, yPosition, 160, 80);
          yPosition += 100;
          
          if (yPosition > 200) {
            doc.addPage();
            yPosition = 20;
          }
        } catch (error) {
          console.error('Error adding chart image:', error);
        }
      }
    });
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}