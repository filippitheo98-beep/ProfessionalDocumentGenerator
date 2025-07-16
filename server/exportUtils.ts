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
  
  // Tableau des risques - Source en première colonne avec largeurs optimisées
  const tableData = risks.map(risk => [
    risk.source || 'Non spécifié',
    risk.type || 'Non spécifié',
    risk.danger || 'Non spécifié',
    risk.gravity || 'Non spécifié',
    risk.frequency || 'Non spécifié',
    risk.control || 'Non spécifié',
    risk.riskScore ? risk.riskScore.toFixed(2) : '0',
    risk.priority || 'Non défini',
    risk.measures || 'À définir'
  ]);
  
  autoTable(doc, {
    head: [['Source', 'Type de risque', 'Danger', 'Gravité', 'Fréquence', 'Maîtrise', 'Score', 'Priorité', 'Mesures']],
    body: tableData,
    startY: 50,
    styles: { 
      fontSize: 5,
      cellPadding: 1,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      overflow: 'linebreak'
    },
    headStyles: { 
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },     // Source
      1: { cellWidth: 'auto', halign: 'left' },     // Type de risque
      2: { cellWidth: 'auto', halign: 'left' },     // Danger
      3: { cellWidth: 'auto', halign: 'center' },   // Gravité
      4: { cellWidth: 'auto', halign: 'center' },   // Fréquence
      5: { cellWidth: 'auto', halign: 'center' },   // Maîtrise
      6: { cellWidth: 'auto', halign: 'center' },   // Score
      7: { cellWidth: 'auto', halign: 'center' },   // Priorité
      8: { cellWidth: 'auto', halign: 'left' }      // Mesures
    },
    margin: { top: 30, left: 8, right: 8, bottom: 30 },
    pageBreak: 'auto',
    showHead: 'everyPage'
  });
  
  // ==== GRAPHIQUES ====
  if (chartImages && Object.keys(chartImages).length > 0) {
    const chartNames = Object.keys(chartImages);
    
    chartNames.forEach((chartName, index) => {
      const imageData = chartImages[chartName];
      if (imageData && typeof imageData === 'string') {
        try {
          // Nouvelle page pour chaque graphique
          doc.addPage();
          
          // Titre de la page
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('GRAPHIQUES D\'ANALYSE', pageWidth / 2, 25, { align: 'center' });
          
          // Graphique centré et optimisé pour la page
          const chartWidth = 200;  // Largeur maximale pour format paysage
          const chartHeight = 130; // Hauteur proportionnelle
          const xPosition = (pageWidth - chartWidth) / 2;
          const yPosition = 50;
          
          doc.addImage(imageData, 'PNG', xPosition, yPosition, chartWidth, chartHeight);
          
        } catch (error) {
          console.error('Error adding chart image:', error);
        }
      }
    });
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}