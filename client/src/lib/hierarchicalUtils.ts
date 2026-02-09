import type { Site, WorkUnit, Risk } from '@shared/schema';

export interface FlattenedRisk extends Risk {
  siteName: string;
  workUnitName: string;
  hierarchyPath: string;
  originLevel: 'Site' | 'Unité';
}

export function extractAllRisks(sites: Site[]): FlattenedRisk[] {
  const allRisks: FlattenedRisk[] = [];

  for (const site of sites) {
    for (const risk of site.risks.filter(r => r.isValidated)) {
      allRisks.push({
        ...risk,
        siteName: site.name,
        workUnitName: '-',
        hierarchyPath: site.name,
        originLevel: 'Site'
      });
    }

    for (const unit of site.workUnits) {
      for (const risk of unit.risks.filter(r => r.isValidated)) {
        allRisks.push({
          ...risk,
          siteName: site.name,
          workUnitName: unit.name,
          hierarchyPath: `${site.name} > ${unit.name}`,
          originLevel: 'Unité'
        });
      }
    }
  }

  return allRisks.sort((a, b) => {
    if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
    return a.workUnitName.localeCompare(b.workUnitName);
  });
}

export function countTotalRisks(sites: Site[]): number {
  return extractAllRisks(sites).length;
}

export function getRisksByFamily(sites: Site[]): Record<string, FlattenedRisk[]> {
  const risks = extractAllRisks(sites);
  return risks.reduce((acc, risk) => {
    const family = risk.family || 'Autre';
    if (!acc[family]) acc[family] = [];
    acc[family].push(risk);
    return acc;
  }, {} as Record<string, FlattenedRisk[]>);
}

export function getRisksByPriority(sites: Site[]): Record<string, FlattenedRisk[]> {
  const risks = extractAllRisks(sites);
  return risks.reduce((acc, risk) => {
    const priority = risk.priority || 'Priorité 4 (Faible)';
    if (!acc[priority]) acc[priority] = [];
    acc[priority].push(risk);
    return acc;
  }, {} as Record<string, FlattenedRisk[]>);
}

export function getRiskStatistics(sites: Site[]) {
  const risks = extractAllRisks(sites);
  const byPriority = getRisksByPriority(sites);
  const byFamily = getRisksByFamily(sites);

  return {
    total: risks.length,
    byPriority: {
      'Priorité 1 (Forte)': byPriority['Priorité 1 (Forte)']?.length || 0,
      'Priorité 2 (Moyenne)': byPriority['Priorité 2 (Moyenne)']?.length || 0,
      'Priorité 3 (Modéré)': byPriority['Priorité 3 (Modéré)']?.length || 0,
      'Priorité 4 (Faible)': byPriority['Priorité 4 (Faible)']?.length || 0,
    },
    byFamily: Object.entries(byFamily).map(([family, risks]) => ({
      family,
      count: risks.length
    })).sort((a, b) => b.count - a.count),
    bySite: sites.map(site => ({
      site: site.name,
      count: extractAllRisks([site]).length
    }))
  };
}
