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
    'Score': risk.riskScore?.toFixed(2) || '',
    'Priorité': risk.priority,
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
    { wch: 10 }, // Score
    { wch: 18 }, // Priorité
    { wch: 50 }  // Mesures de prévention
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Risques');
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return excelBuffer;
}

export async function generatePDFFile(risks: any[], companyName: string, companyActivity: string, companyData?: any, locations?: any[], workStations?: any[], preventionMeasures?: any[], chartImages?: any): Promise<Buffer> {
  const doc = new jsPDF();
  
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
  
  // ==== PAGE DE GARDE SIMPLE ET PROFESSIONNELLE ====
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Ligne décorative supérieure
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(3);
  doc.line(20, 30, pageWidth - 20, 30);
  
  // Titre principal
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENT UNIQUE', pageWidth / 2, 50, { align: 'center' });
  
  // Sous-titre
  doc.setFontSize(16);
  doc.text('D\'ÉVALUATION DES RISQUES PROFESSIONNELS', pageWidth / 2, 70, { align: 'center' });
  
  // Ligne décorative sous le titre
  doc.setLineWidth(1);
  doc.line(40, 80, pageWidth - 40, 80);
  
  // Références légales dans un cadre simple
  doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setLineWidth(1);
  doc.rect(30, 95, pageWidth - 60, 25);
  
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('(En application du décret n° 2001-1016 du 5 novembre 2001)', pageWidth / 2, 105, { align: 'center' });
  doc.text('(Articles R4121-1 à R4121-4 et L4121-3 et L4121-3-1 du Code du Travail)', pageWidth / 2, 115, { align: 'center' });
  
  // Informations de l'entreprise dans un cadre élégant
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(2);
  doc.rect(30, 140, pageWidth - 60, 70);
  
  // Titre de la section entreprise
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS ENTREPRISE', pageWidth / 2, 155, { align: 'center' });
  
  // Ligne sous le titre
  doc.setLineWidth(1);
  doc.line(40, 160, pageWidth - 40, 160);
  
  // Informations de l'entreprise
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  let yPos = 175;
  doc.text(`Entreprise : ${companyName}`, 40, yPos);
  yPos += 12;
  doc.text(`Secteur : ${companyActivity}`, 40, yPos);
  
  if (companyData) {
    if (companyData.address) {
      yPos += 12;
      doc.text(`Adresse : ${companyData.address}`, 40, yPos);
    }
    if (companyData.phone && companyData.email) {
      yPos += 12;
      doc.text(`Contact : ${companyData.phone} - ${companyData.email}`, 40, yPos);
    } else if (companyData.phone) {
      yPos += 12;
      doc.text(`Téléphone : ${companyData.phone}`, 40, yPos);
    } else if (companyData.email) {
      yPos += 12;
      doc.text(`Courriel : ${companyData.email}`, 40, yPos);
    }
  }
  
  // Date avec style simple
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('fr-FR');
  doc.text(`Réalisé le : ${today}`, pageWidth / 2, 240, { align: 'center' });
  
  // Ligne décorative en bas
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(3);
  doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30);
  
  // ==== TABLE DES MATIÈRES ====
  doc.addPage();
  
  // Titre simple avec ligne décorative
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(2);
  doc.line(20, 30, pageWidth - 20, 30);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLE DES MATIÈRES', pageWidth / 2, 45, { align: 'center' });
  
  doc.setLineWidth(1);
  doc.line(40, 55, pageWidth - 40, 55);
  
  // Contenu de la table des matières propre
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = 80;
  
  const tableOfContents = [
    'A. Tableau de mise à jour',
    'B. Présentation de la société',
    'C. Le code du travail',
    'D. Méthodes d\'évaluation du risque',
    'E. DUERP',
    'F. Plan d\'action',
    'G. Analyse'
  ];
  
  tableOfContents.forEach((item, index) => {
    doc.setFont('helvetica', 'bold');
    doc.text(item, 30, yPos);
    
    // Ligne de points simple
    doc.setFont('helvetica', 'normal');
    const dots = '................................................................';
    doc.text(dots, 100, yPos);
    
    // Numéro de page
    doc.text(`${index + 3}`, pageWidth - 40, yPos);
    
    yPos += 20;
  });
  
  // ==== PRÉSENTATION DE LA SOCIÉTÉ ====
  doc.addPage();
  
  // En-tête de section simple
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(2);
  doc.line(20, 30, pageWidth - 20, 30);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('B. PRÉSENTATION DE LA SOCIÉTÉ', pageWidth / 2, 45, { align: 'center' });
  
  doc.setLineWidth(1);
  doc.line(40, 55, pageWidth - 40, 55);
  
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = 75;
  
  // Présentation simple
  doc.setFont('helvetica', 'bold');
  doc.text('Présentation de la société :', 30, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 15;
  doc.text(`${companyName} est une entreprise spécialisée dans ${companyActivity}.`, 30, yPos);
  
  yPos += 30;
  doc.setFont('helvetica', 'bold');
  doc.text('Coordonnées et Localisation', 30, yPos);
  yPos += 15;
  
  if (companyData) {
    if (companyData.address) {
      doc.text(`• Adresse : ${companyData.address}`, 20, yPos);
      yPos += 15;
    }
    if (companyData.phone) {
      doc.text(`• Téléphone : ${companyData.phone}`, 20, yPos);
      yPos += 15;
    }
    if (companyData.email) {
      doc.text(`• Email : ${companyData.email}`, 20, yPos);
      yPos += 15;
    }
    if (companyData.employeeCount) {
      doc.text(`• Effectif : ${companyData.employeeCount} employés`, 20, yPos);
      yPos += 15;
    }
  }
  
  // ==== LE CODE DU TRAVAIL ====
  doc.addPage();
  
  // En-tête de section simple
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(2);
  doc.line(20, 30, pageWidth - 20, 30);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('C. LE CODE DU TRAVAIL', pageWidth / 2, 45, { align: 'center' });
  
  doc.setLineWidth(1);
  doc.line(40, 55, pageWidth - 40, 55);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = 60;
  
  doc.text('Introduction :', 20, yPos);
  yPos += 15;
  const introduction = 'Le Document Unique d\'Évaluation des Risques Professionnels (DUERP) est une obligation légale pour toutes les entreprises, quel que soit leur effectif, selon le Code du Travail. Il vise à recenser, évaluer et prévenir les risques auxquels sont exposés les salariés.';
  const splitIntro = doc.splitTextToSize(introduction, 170);
  doc.text(splitIntro, 20, yPos);
  yPos += splitIntro.length * 5 + 20;
  
  doc.text('Références légales :', 20, yPos);
  yPos += 15;
  
  const legalRefs = [
    'Article L4121-1 : L\'employeur prend les mesures nécessaires pour assurer la sécurité et protéger la santé physique et mentale des travailleurs.',
    'Article L4121-2 : Ces mesures comprennent des actions de prévention des risques professionnels, des actions d\'information et de formation.',
    'Article R4121-1 : L\'employeur transcrit et met à jour dans un document unique les résultats de l\'évaluation des risques.'
  ];
  
  legalRefs.forEach(ref => {
    const splitRef = doc.splitTextToSize(ref, 170);
    doc.text(splitRef, 20, yPos);
    yPos += splitRef.length * 5 + 10;
  });
  
  // ==== MÉTHODOLOGIE D'ÉVALUATION ====
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('D. Méthodes d\'évaluation du risque', 20, 30);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = 60;
  
  const methodology = [
    '1/ Identifier l\'unité de travail',
    '2/ Identifier les dangers et les situations dangereuses liées à l\'unité de travail',
    '3/ Estimer la gravité de chaque situation dangereuse',
    '4/ Estimer la fréquence d\'exposition à la situation dangereuse',
    '5/ Estimer la maîtrise de la situation dangereuse par les actions de prévention existantes',
    '6/ Calcul du risque et des priorités d\'actions'
  ];
  
  methodology.forEach(item => {
    doc.text(item, 20, yPos);
    yPos += 12;
  });
  
  // Tableau de gravité
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('3/ Estimer la gravité de chaque situation dangereuse', 20, yPos);
  yPos += 15;
  
  autoTable(doc, {
    head: [['Gravité', 'Indice', 'Définition']],
    body: [
      ['Faible', '1', 'Incident sans arrêt de travail - Situation occasionnant un inconfort'],
      ['Moyenne', '4', 'Accident avec arrêt de travail mais sans séquelles'],
      ['Grave', '20', 'Accident avec arrêt de travail et possibilité de séquelles'],
      ['Très Grave', '100', 'Accident pouvant entraîner un décès ou une invalidité permanente']
    ],
    startY: yPos,
    styles: { 
      fontSize: 10, 
      cellPadding: 4,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    headStyles: { 
      fillColor: [230, 230, 230],
      textColor: [52, 73, 94],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 120, halign: 'left' }
    }
  });
  
  // Tableau de fréquence
  yPos = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont('helvetica', 'bold');
  doc.text('4/ Estimer la fréquence d\'exposition', 20, yPos);
  yPos += 15;
  
  autoTable(doc, {
    head: [['Exposition', 'Fréquence d\'exposition', 'Indice']],
    body: [
      ['Annuelle', 'Environ 1 fois/an', '1'],
      ['Mensuelle', 'Environ 1 fois/mois', '4'],
      ['Hebdomadaire', 'Environ 1 fois/semaine', '10'],
      ['Journalière', 'Tous les jours', '50']
    ],
    startY: yPos,
    styles: { 
      fontSize: 10, 
      cellPadding: 4,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    headStyles: { 
      fillColor: [230, 230, 230],
      textColor: [52, 73, 94],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 20, halign: 'center' }
    }
  });
  
  // Tableau de maîtrise
  yPos = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont('helvetica', 'bold');
  doc.text('5/ Estimer la maîtrise du risque', 20, yPos);
  yPos += 15;
  
  autoTable(doc, {
    head: [['Maîtrise du risque', 'Indice', 'Définition']],
    body: [
      ['Très élevée', '0,05', 'Mesures très efficaces, aucune autre mesure possible'],
      ['Élevée', '0,2', 'Mesures répondant à la situation, compléments possibles'],
      ['Moyenne', '0,5', 'Mesures existantes mais insuffisantes'],
      ['Absente', '1', 'Pas de mesures ou mesures inefficaces']
    ],
    startY: yPos,
    styles: { 
      fontSize: 10, 
      cellPadding: 4,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    headStyles: { 
      fillColor: [230, 230, 230],
      textColor: [52, 73, 94],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 120, halign: 'left' }
    }
  });
  
  // Calcul du risque
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.text('6/ Calcul du risque et des priorités d\'actions', 20, 30);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Dans cette méthode le Risque = Gravité × Fréquence × Maîtrise', 20, 50);
  
  autoTable(doc, {
    head: [['Cotation du Risque', 'Classement de la priorité', 'Interprétation']],
    body: [
      ['< 10', 'Priorité 4 - Faible', 'Situation limitée ou maîtrisée'],
      ['10 ≤ Note < 100', 'Priorité 3 - Modéré', 'Situation limitée, mesures supplémentaires possibles'],
      ['100 ≤ Note < 500', 'Priorité 2 - Moyenne', 'Situation insuffisamment maîtrisée'],
      ['500 ≤ Note ≤ 5000', 'Priorité 1 - Forte', 'Situation dangereuse, mesures urgentes']
    ],
    startY: 70,
    styles: { 
      fontSize: 10, 
      cellPadding: 4,
      textColor: [52, 73, 94],
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    headStyles: { 
      fillColor: [230, 230, 230],
      textColor: [52, 73, 94],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center' },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 80, halign: 'left' }
    }
  });
  
  // ==== DUERP - UNE PAGE PAR LIEU/POSTE ====
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('E. DUERP', 20, 30);
  
  // Grouper les risques par source
  const risksBySource = {};
  risks.forEach(risk => {
    const source = risk.source || 'Non spécifié';
    if (!risksBySource[source]) {
      risksBySource[source] = [];
    }
    risksBySource[source].push(risk);
  });
  
  // Créer une page pour chaque lieu/poste
  Object.entries(risksBySource).forEach(([source, sourceRisks]: [string, any[]]) => {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Unité de Travail : ${source}`, 20, 30);
    
    // Tableau des risques pour cette unité - format simplifié
    const sourceTableData = sourceRisks.map(risk => [
      risk.type || 'Non spécifié',
      risk.danger || 'Non spécifié',
      risk.gravity || 'Non spécifié',
      String(risk.gravityValue || ''),
      risk.frequency || 'Non spécifié',
      String(risk.frequencyValue || ''),
      risk.control || 'Non spécifié',
      String(risk.controlValue || ''),
      risk.riskScore ? risk.riskScore.toFixed(2) : '0',
      risk.priority || 'Non défini',
      risk.measures || 'À définir'
    ]);
    
    // Créer un tableau plus compact et lisible
    autoTable(doc, {
      head: [['Type de risque', 'Gravité', 'Fréquence', 'Maîtrise', 'Score', 'Priorité', 'Mesures de prévention']],
      body: sourceTableData.map(row => [
        row[0], // Type de risque
        `${row[2]} (${row[3]})`, // Gravité avec valeur
        `${row[4]} (${row[5]})`, // Fréquence avec valeur
        `${row[6]} (${row[7]})`, // Maîtrise avec valeur
        row[8], // Score
        row[9], // Priorité
        row[10] // Mesures
      ]),
      startY: 50,
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        textColor: [52, 73, 94],
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: { 
        fillColor: [230, 230, 230],
        textColor: [52, 73, 94],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 25 }, // Type de risque
        1: { cellWidth: 25 }, // Gravité
        2: { cellWidth: 25 }, // Fréquence
        3: { cellWidth: 25 }, // Maîtrise
        4: { cellWidth: 15, halign: 'center' }, // Score
        5: { cellWidth: 25, halign: 'center' }, // Priorité
        6: { cellWidth: 40 } // Mesures
      },
      margin: { left: 10, right: 10 },
      showHead: 'everyPage',
      pageBreak: 'auto'
    });
  });
  
  // ==== PLAN D'ACTION ====
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('F. Plan d\'action', 20, 30);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  yPos = 60;
  
  // Statistiques des priorités
  const priorityStats = {
    'Priorité 1 (Forte)': risks.filter(r => r.priority === 'Priorité 1 (Forte)').length,
    'Priorité 2 (Moyenne)': risks.filter(r => r.priority === 'Priorité 2 (Moyenne)').length,
    'Priorité 3 (Modéré)': risks.filter(r => r.priority === 'Priorité 3 (Modéré)').length,
    'Priorité 4 (Faible)': risks.filter(r => r.priority === 'Priorité 4 (Faible)').length,
  };
  
  doc.text('Répartition des risques par priorité :', 20, yPos);
  yPos += 15;
  
  Object.entries(priorityStats).forEach(([priority, count]) => {
    doc.text(`• ${priority}: ${count} risques`, 20, yPos);
    yPos += 10;
  });
  
  // Actions recommandées
  yPos += 20;
  doc.text('Actions recommandées par priorité :', 20, yPos);
  yPos += 15;
  
  const actions = [
    'Priorité 1 (Forte) : Actions correctives immédiates à mettre en place',
    'Priorité 2 (Moyenne) : Actions de prévention à planifier à court terme',
    'Priorité 3 (Modéré) : Actions d\'amélioration à programmer',
    'Priorité 4 (Faible) : Actions de surveillance et de maintien'
  ];
  
  actions.forEach(action => {
    const splitAction = doc.splitTextToSize(action, 170);
    doc.text(splitAction, 20, yPos);
    yPos += splitAction.length * 5 + 10;
  });
  
  // ==== ANALYSE GRAPHIQUE ====
  if (chartImages && Object.keys(chartImages).length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('G. Analyse', 20, 30);
    
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