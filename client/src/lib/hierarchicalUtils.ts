import type { Site, WorkZone, WorkUnit, Activity, Risk } from '@shared/schema';

export interface FlattenedRisk extends Risk {
  siteName: string;
  zoneName: string;
  workUnitName: string;
  activityName: string;
  hierarchyPath: string;
  originLevel: 'Site' | 'Zone' | 'Unité' | 'Activité';
}

export function extractAllRisks(sites: Site[]): FlattenedRisk[] {
  const allRisks: FlattenedRisk[] = [];

  for (const site of sites) {
    for (const risk of site.risks.filter(r => r.isValidated)) {
      allRisks.push({
        ...risk,
        siteName: site.name,
        zoneName: '-',
        workUnitName: '-',
        activityName: '-',
        hierarchyPath: site.name,
        originLevel: 'Site'
      });
    }

    for (const zone of site.zones) {
      for (const risk of zone.risks.filter(r => r.isValidated)) {
        allRisks.push({
          ...risk,
          siteName: site.name,
          zoneName: zone.name,
          workUnitName: '-',
          activityName: '-',
          hierarchyPath: `${site.name} > ${zone.name}`,
          originLevel: 'Zone'
        });
      }

      for (const unit of zone.workUnits) {
        for (const risk of unit.risks.filter(r => r.isValidated)) {
          allRisks.push({
            ...risk,
            siteName: site.name,
            zoneName: zone.name,
            workUnitName: unit.name,
            activityName: '-',
            hierarchyPath: `${site.name} > ${zone.name} > ${unit.name}`,
            originLevel: 'Unité'
          });
        }

        for (const activity of unit.activities) {
          for (const risk of activity.risks.filter(r => r.isValidated)) {
            allRisks.push({
              ...risk,
              siteName: site.name,
              zoneName: zone.name,
              workUnitName: unit.name,
              activityName: activity.name,
              hierarchyPath: `${site.name} > ${zone.name} > ${unit.name} > ${activity.name}`,
              originLevel: 'Activité'
            });
          }
        }
      }
    }
  }

  return allRisks.sort((a, b) => {
    if (a.siteName !== b.siteName) return a.siteName.localeCompare(b.siteName);
    if (a.zoneName !== b.zoneName) return a.zoneName.localeCompare(b.zoneName);
    if (a.workUnitName !== b.workUnitName) return a.workUnitName.localeCompare(b.workUnitName);
    return a.activityName.localeCompare(b.activityName);
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
