import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
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

export async function generatePDFFile(risks: any[], companyName: string, companyActivity: string, companyData?: any, locations?: any[], workStations?: any[], preventionMeasures?: any[], chartImages?: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // PAGE DE COUVERTURE
  // En-tête coloré
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, 210, 60, 'F');
  
  // Titre principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT UNIQUE', 105, 20, { align: 'center' });
  doc.text('D\'ÉVALUATION DES RISQUES', 105, 30, { align: 'center' });
  doc.text('PROFESSIONNELS', 105, 40, { align: 'center' });
  doc.setFontSize(16);
  doc.text('(DUERP)', 105, 50, { align: 'center' });
  
  // Informations de l'entreprise
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations de l\'entreprise', 20, 80);
  
  // Tableau des informations entreprise
  const companyInfo = [
    ['Nom de l\'entreprise', companyName || 'Non renseigné'],
    ['Activité', companyActivity || 'Non renseigné'],
    ['Adresse', companyData?.address || 'Non renseignée'],
    ['SIRET', companyData?.siret || 'Non renseigné'],
    ['Téléphone', companyData?.phone || 'Non renseigné'],
    ['Email', companyData?.email || 'Non renseigné'],
    ['Nombre d\'employés', companyData?.employeeCount || 'Non renseigné'],
    ['Date d\'export', new Date().toLocaleDateString('fr-FR')]
  ];
  
  autoTable(doc, {
    body: companyInfo,
    startY: 90,
    styles: {
      fontSize: 11,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, fillColor: [240, 240, 240] },
      1: { cellWidth: 120 }
    },
    theme: 'grid'
  });
  
  // Résumé des risques
  const yAfterCompanyInfo = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé de l\'évaluation', 20, yAfterCompanyInfo);
  
  const riskCounts = risks.reduce((acc: any, risk: any) => {
    acc[risk.finalRisk] = (acc[risk.finalRisk] || 0) + 1;
    return acc;
  }, {});
  
  const totalRisks = risks.length;
  const summaryData = [
    ['Niveau de risque', 'Nombre', 'Pourcentage'],
    ['Risques faibles', riskCounts['Faible'] || 0, `${Math.round(((riskCounts['Faible'] || 0) / totalRisks) * 100)}%`],
    ['Risques moyens', riskCounts['Moyen'] || 0, `${Math.round(((riskCounts['Moyen'] || 0) / totalRisks) * 100)}%`],
    ['Risques importants', riskCounts['Important'] || 0, `${Math.round(((riskCounts['Important'] || 0) / totalRisks) * 100)}%`],
    ['Total des risques', totalRisks, '100%']
  ];
  
  autoTable(doc, {
    head: [summaryData[0]],
    body: summaryData.slice(1),
    startY: yAfterCompanyInfo + 10,
    styles: {
      fontSize: 11,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [52, 152, 219],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' }
    },
    theme: 'grid'
  });
  
  // Page break before charts section
  doc.addPage();
  
  // Section graphiques
  if (chartImages && (chartImages.barChart || chartImages.pieChart)) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Analyse graphique des risques', 20, 30);
    
    let yPos = 50;
    
    // Graphique en barres
    if (chartImages.barChart) {
      try {
        const barChart = chartImages.barChart.replace(/^data:image\/[a-z]+;base64,/, '');
        doc.addImage(barChart, 'PNG', 20, yPos, 170, 80);
        yPos += 90;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Graphique 1 : Répartition des risques par niveau', 20, yPos);
        yPos += 10;
      } catch (error) {
        console.error('Erreur lors de l\'ajout du graphique en barres:', error);
      }
    }
    
    // Graphique en secteurs
    if (chartImages.pieChart) {
      try {
        // Vérifier si on a assez de place, sinon nouvelle page
        if (yPos > 150) {
          doc.addPage();
          yPos = 30;
        }
        
        const pieChart = chartImages.pieChart.replace(/^data:image\/[a-z]+;base64,/, '');
        doc.addImage(pieChart, 'PNG', 20, yPos, 170, 80);
        yPos += 90;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Graphique 2 : Types de risques', 20, yPos);
        yPos += 10;
      } catch (error) {
        console.error('Erreur lors de l\'ajout du graphique en secteurs:', error);
      }
    }
  }
  
  // Page break before locations section
  doc.addPage();
  
  let yPos = 30;
  
  // Locations section
  if (locations && locations.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Lieux de travail', 20, yPos);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    yPos += 15;
    
    locations.forEach((location: any, index: number) => {
      doc.text(`${index + 1}. ${location.name}`, 25, yPos);
      yPos += 8;
      
      if (location.preventionMeasures && location.preventionMeasures.length > 0) {
        doc.text('Mesures de prévention:', 30, yPos);
        yPos += 6;
        location.preventionMeasures.forEach((measure: any) => {
          doc.text(`• ${measure.description}`, 35, yPos);
          yPos += 6;
        });
      }
      yPos += 4;
    });
  }
  
  // Work stations section
  if (workStations && workStations.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Postes de travail', 20, yPos + 10);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    yPos += 25;
    
    workStations.forEach((workStation: any, index: number) => {
      doc.text(`${index + 1}. ${workStation.name}`, 25, yPos);
      yPos += 8;
      
      if (workStation.description) {
        doc.text(`Description: ${workStation.description}`, 30, yPos);
        yPos += 6;
      }
      
      if (workStation.preventionMeasures && workStation.preventionMeasures.length > 0) {
        doc.text('Mesures de prévention:', 30, yPos);
        yPos += 6;
        workStation.preventionMeasures.forEach((measure: any) => {
          doc.text(`• ${measure.description}`, 35, yPos);
          yPos += 6;
        });
      }
      yPos += 4;
    });
  }
  
  // Prevention measures section
  if (preventionMeasures && preventionMeasures.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Mesures de prévention générales', 20, 30);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    yPos = 40;
    
    preventionMeasures.forEach((measure: any, index: number) => {
      doc.text(`${index + 1}. ${measure.description}`, 25, yPos);
      yPos += 8;
    });
  }
  
  // Page break before risks table
  doc.addPage();
  
  // Risks table header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Tableau des risques professionnels', 20, 30);
  
  // Table headers
  const headers = [
    'N°', 'Source', 'Type risque', 'Danger', 
    'Gravité', 'Fréquence', 'Maîtrise', 'Risque final', 'Mesures prévention'
  ];
  
  // Table data
  const tableData = risks.map((risk: any, index: number) => [
    index + 1,
    risk.source || 'N/A',
    risk.type,
    risk.danger,
    risk.gravity,
    risk.frequency,
    risk.control,
    risk.finalRisk,
    risk.measures
  ]);
  
  // Generate table with better formatting - portrait orientation
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 6,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },   // N°
      1: { cellWidth: 20, fontSize: 5 },       // Source
      2: { cellWidth: 18, fontSize: 5 },       // Type risque
      3: { cellWidth: 35, fontSize: 5 },       // Danger
      4: { cellWidth: 12, halign: 'center', fontSize: 5 },  // Gravité
      5: { cellWidth: 12, halign: 'center', fontSize: 5 },  // Fréquence
      6: { cellWidth: 12, halign: 'center', fontSize: 5 },  // Maîtrise
      7: { cellWidth: 15, halign: 'center', fontSize: 5 },  // Risque final
      8: { cellWidth: 58, fontSize: 5 }        // Mesures prévention
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    theme: 'grid',
    margin: { top: 20, left: 5, right: 5 }
  });
  
  // Ajouter la numérotation des pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} sur ${pageCount}`, 105, 290, { align: 'center' });
  }
  
  return Buffer.from(doc.output('arraybuffer'));
}