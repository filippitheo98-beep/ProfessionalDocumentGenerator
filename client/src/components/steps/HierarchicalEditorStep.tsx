import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  MapPin, 
  Layers, 
  Users, 
  Activity as ActivityIcon,
  Plus, 
  Trash2, 
  ChevronRight,
  Sparkles,
  Check,
  X,
  Loader2,
  Eye,
  Home,
  Edit3,
  RefreshCw
} from "lucide-react";
import type { 
  Site, 
  WorkZone, 
  WorkUnit, 
  Activity, 
  Risk,
  SitePriority
} from "@shared/schema";

interface HierarchicalEditorStepProps {
  companyId: number;
  companyActivity: string;
  companyDescription?: string;
  sites: Site[];
  onUpdateSites: (sites: Site[]) => void;
  onSave: () => void;
}

const SITE_PRIORITIES: SitePriority[] = ['Principal', 'Secondaire', 'Occasionnel', 'Temporaire'];

const RISK_ROW_COLORS: Record<string, string> = {
  'Priorité 1 (Forte)': 'bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500',
  'Priorité 2 (Moyenne)': 'bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-500',
  'Priorité 3 (Modéré)': 'bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-l-yellow-500',
  'Priorité 4 (Faible)': 'bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500',
};

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  'Priorité 1 (Forte)': 'bg-red-500 text-white',
  'Priorité 2 (Moyenne)': 'bg-orange-500 text-white',
  'Priorité 3 (Modéré)': 'bg-yellow-500 text-black',
  'Priorité 4 (Faible)': 'bg-green-500 text-white',
};

interface BreadcrumbPath {
  siteId?: string;
  zoneId?: string;
  unitId?: string;
  activityId?: string;
}

interface TableRisk {
  risk: Risk;
  siteName: string;
  zoneName?: string;
  unitName?: string;
  activityName?: string;
  path: BreadcrumbPath;
  level: 'Site' | 'Zone' | 'Unité' | 'Activité';
}

export default function HierarchicalEditorStep({
  companyId,
  companyActivity,
  companyDescription,
  sites,
  onUpdateSites,
  onSave
}: HierarchicalEditorStepProps) {
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState<BreadcrumbPath>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [showStructureEditor, setShowStructureEditor] = useState(false);
  const [pendingRisks, setPendingRisks] = useState<{
    risks: Risk[];
    elementId: string;
    elementName: string;
    level: string;
    path: BreadcrumbPath;
  } | null>(null);
  const [selectedPendingRisks, setSelectedPendingRisks] = useState<Set<string>>(new Set());
  const [reviewingRisk, setReviewingRisk] = useState<TableRisk | null>(null);

  const currentSite = currentPath.siteId ? sites.find(s => s.id === currentPath.siteId) : undefined;
  const currentZone = currentSite && currentPath.zoneId ? currentSite.zones.find(z => z.id === currentPath.zoneId) : undefined;
  const currentUnit = currentZone && currentPath.unitId ? currentZone.workUnits.find(u => u.id === currentPath.unitId) : undefined;
  const currentActivity = currentUnit && currentPath.activityId ? currentUnit.activities.find(a => a.id === currentPath.activityId) : undefined;

  const allRisks = useMemo((): TableRisk[] => {
    const risks: TableRisk[] = [];
    
    for (const site of sites) {
      for (const risk of (site.risks || []).filter(r => r.isValidated)) {
        risks.push({ risk, siteName: site.name, path: { siteId: site.id }, level: 'Site' });
      }
      for (const zone of site.zones || []) {
        for (const risk of (zone.risks || []).filter(r => r.isValidated)) {
          risks.push({ risk, siteName: site.name, zoneName: zone.name, path: { siteId: site.id, zoneId: zone.id }, level: 'Zone' });
        }
        for (const unit of zone.workUnits || []) {
          for (const risk of (unit.risks || []).filter(r => r.isValidated)) {
            risks.push({ risk, siteName: site.name, zoneName: zone.name, unitName: unit.name, path: { siteId: site.id, zoneId: zone.id, unitId: unit.id }, level: 'Unité' });
          }
          for (const activity of unit.activities || []) {
            for (const risk of (activity.risks || []).filter(r => r.isValidated)) {
              risks.push({ risk, siteName: site.name, zoneName: zone.name, unitName: unit.name, activityName: activity.name, path: { siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id }, level: 'Activité' });
            }
          }
        }
      }
    }
    return risks;
  }, [sites]);

  const filteredRisks = useMemo(() => {
    if (!currentPath.siteId) return allRisks;
    return allRisks.filter(r => {
      if (currentPath.activityId) return r.path.activityId === currentPath.activityId;
      if (currentPath.unitId) return r.path.unitId === currentPath.unitId;
      if (currentPath.zoneId) return r.path.zoneId === currentPath.zoneId;
      return r.path.siteId === currentPath.siteId;
    });
  }, [allRisks, currentPath]);

  const updateSite = (siteId: string, updates: Partial<Site>) => {
    onUpdateSites(sites.map(s => s.id === siteId ? { ...s, ...updates } : s));
  };

  const updateZone = (siteId: string, zoneId: string, updates: Partial<WorkZone>) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    updateSite(siteId, { zones: site.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z) });
  };

  const updateWorkUnit = (siteId: string, zoneId: string, unitId: string, updates: Partial<WorkUnit>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;
    updateZone(siteId, zoneId, { workUnits: zone.workUnits.map(u => u.id === unitId ? { ...u, ...updates } : u) });
  };

  const updateActivity = (siteId: string, zoneId: string, unitId: string, activityId: string, updates: Partial<Activity>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;
    updateWorkUnit(siteId, zoneId, unitId, { activities: unit.activities.map(a => a.id === activityId ? { ...a, ...updates } : a) });
  };

  const addSite = () => {
    const newSite: Site = { id: crypto.randomUUID(), name: 'Nouveau site', priority: 'Principal', companyId, zones: [], risks: [], preventionMeasures: [], order: sites.length };
    onUpdateSites([...sites, newSite]);
  };

  const addZone = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const newZone: WorkZone = { id: crypto.randomUUID(), name: 'Nouvelle zone', siteId, workUnits: [], risks: [], preventionMeasures: [], order: site.zones.length };
    updateSite(siteId, { zones: [...site.zones, newZone] });
  };

  const addWorkUnit = (siteId: string, zoneId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const newUnit: WorkUnit = { id: crypto.randomUUID(), name: 'Nouvelle unité', zoneId, activities: [], risks: [], preventionMeasures: [], order: zone.workUnits.length };
    updateZone(siteId, zoneId, { workUnits: [...zone.workUnits, newUnit] });
  };

  const addActivity = (siteId: string, zoneId: string, unitId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;
    const newActivity: Activity = { id: crypto.randomUUID(), name: 'Nouvelle activité', workUnitId: unitId, risks: [], preventionMeasures: [], order: unit.activities.length };
    updateWorkUnit(siteId, zoneId, unitId, { activities: [...unit.activities, newActivity] });
  };

  const removeSite = (siteId: string) => { onUpdateSites(sites.filter(s => s.id !== siteId)); if (currentPath.siteId === siteId) setCurrentPath({}); };
  const removeZone = (siteId: string, zoneId: string) => { const site = sites.find(s => s.id === siteId); if (site) updateSite(siteId, { zones: site.zones.filter(z => z.id !== zoneId) }); if (currentPath.zoneId === zoneId) setCurrentPath({ siteId }); };
  const removeUnit = (siteId: string, zoneId: string, unitId: string) => { const site = sites.find(s => s.id === siteId); const zone = site?.zones.find(z => z.id === zoneId); if (zone) updateZone(siteId, zoneId, { workUnits: zone.workUnits.filter(u => u.id !== unitId) }); if (currentPath.unitId === unitId) setCurrentPath({ siteId, zoneId }); };
  const removeActivity = (siteId: string, zoneId: string, unitId: string, activityId: string) => { const site = sites.find(s => s.id === siteId); const zone = site?.zones.find(z => z.id === zoneId); const unit = zone?.workUnits.find(u => u.id === unitId); if (unit) updateWorkUnit(siteId, zoneId, unitId, { activities: unit.activities.filter(a => a.id !== activityId) }); if (currentPath.activityId === activityId) setCurrentPath({ siteId, zoneId, unitId }); };

  const generateRisks = async (level: 'Site' | 'Zone' | 'Unité' | 'Activité', elementId: string, elementName: string, path: BreadcrumbPath) => {
    if (!elementName.trim()) { toast({ title: "Nom requis", variant: "destructive" }); return; }
    setGeneratingFor(elementId);
    try {
      const site = path.siteId ? sites.find(s => s.id === path.siteId) : undefined;
      const zone = site && path.zoneId ? site.zones.find(z => z.id === path.zoneId) : undefined;
      const response = await apiRequest('/api/generate-hierarchical-risks', {
        method: 'POST',
        body: JSON.stringify({ level, elementName, companyActivity, companyDescription, companyId, siteName: site?.name, zoneName: zone?.name, workUnitName: path.unitId ? zone?.workUnits.find(u => u.id === path.unitId)?.name : undefined }),
      });
      if (response.risks?.length > 0) {
        setPendingRisks({ risks: response.risks, elementId, elementName, level, path });
        setSelectedPendingRisks(new Set(response.risks.map((r: Risk) => r.id)));
      } else {
        toast({ title: "Aucun risque identifié" });
      }
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setGeneratingFor(null);
    }
  };

  const validateSelectedRisks = () => {
    if (!pendingRisks) return;
    const { level, path, elementId } = pendingRisks;
    const validatedRisks = pendingRisks.risks.filter(r => selectedPendingRisks.has(r.id)).map(r => ({ ...r, isValidated: true }));

    const getCurrentRisks = (): Risk[] => {
      if (level === 'Site') return sites.find(s => s.id === elementId)?.risks || [];
      if (level === 'Zone' && path.siteId) { const site = sites.find(s => s.id === path.siteId); return site?.zones.find(z => z.id === elementId)?.risks || []; }
      if (level === 'Unité' && path.siteId && path.zoneId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); return zone?.workUnits.find(u => u.id === elementId)?.risks || []; }
      if (level === 'Activité' && path.siteId && path.zoneId && path.unitId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); const unit = zone?.workUnits.find(u => u.id === path.unitId); return unit?.activities.find(a => a.id === elementId)?.risks || []; }
      return [];
    };

    const existingRisks = getCurrentRisks().filter(r => r.isValidated);
    const mergedRisks = [...existingRisks, ...validatedRisks];

    if (level === 'Site') updateSite(elementId, { risks: mergedRisks });
    else if (level === 'Zone' && path.siteId) updateZone(path.siteId, elementId, { risks: mergedRisks });
    else if (level === 'Unité' && path.siteId && path.zoneId) updateWorkUnit(path.siteId, path.zoneId, elementId, { risks: mergedRisks });
    else if (level === 'Activité' && path.siteId && path.zoneId && path.unitId) updateActivity(path.siteId, path.zoneId, path.unitId, elementId, { risks: mergedRisks });

    toast({ title: `${validatedRisks.length} risque(s) ajouté(s)` });
    setPendingRisks(null);
    setSelectedPendingRisks(new Set());
  };

  const removeRisk = (tableRisk: TableRisk) => {
    const { risk, path, level } = tableRisk;
    const removeFromArray = (risks: Risk[]) => risks.filter(r => r.id !== risk.id);
    if (level === 'Site') { const site = sites.find(s => s.id === path.siteId); if (site) updateSite(path.siteId!, { risks: removeFromArray(site.risks || []) }); }
    else if (level === 'Zone' && path.zoneId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); if (zone) updateZone(path.siteId!, path.zoneId, { risks: removeFromArray(zone.risks || []) }); }
    else if (level === 'Unité' && path.unitId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); const unit = zone?.workUnits.find(u => u.id === path.unitId); if (unit) updateWorkUnit(path.siteId!, path.zoneId!, path.unitId, { risks: removeFromArray(unit.risks || []) }); }
    else if (level === 'Activité' && path.activityId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); const unit = zone?.workUnits.find(u => u.id === path.unitId); const activity = unit?.activities.find(a => a.id === path.activityId); if (activity) updateActivity(path.siteId!, path.zoneId!, path.unitId!, path.activityId, { risks: removeFromArray(activity.risks || []) }); }
    toast({ title: "Risque retiré" });
  };

  const getLocationLabel = (r: TableRisk) => {
    const parts = [];
    if (r.zoneName) parts.push(r.zoneName);
    if (r.unitName) parts.push(r.unitName);
    if (r.activityName) parts.push(r.activityName);
    return parts.length > 0 ? parts.join(' > ') : r.siteName;
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Évaluation des Risques Professionnels</h2>
            <p className="text-blue-100 text-sm mt-1">Tableau d'évaluation conforme INRS</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white">{allRisks.length} risque(s)</Badge>
            <Button variant="secondary" size="sm" onClick={() => setShowStructureEditor(true)}>
              <Edit3 className="h-4 w-4 mr-1" />
              Gérer la structure
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader className="py-2 px-4 bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" className={`h-7 px-2 ${!currentPath.siteId ? 'bg-blue-100 text-blue-800' : ''}`} onClick={() => setCurrentPath({})}>
              <Home className="h-3 w-3 mr-1" />
              Tous les sites
            </Button>
            {currentSite && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="sm" className={`h-7 px-2 ${currentPath.siteId && !currentPath.zoneId ? 'bg-blue-100 text-blue-800' : ''}`} onClick={() => setCurrentPath({ siteId: currentPath.siteId })}>
                  <MapPin className="h-3 w-3 mr-1" />
                  {currentSite.name}
                </Button>
              </>
            )}
            {currentZone && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="sm" className={`h-7 px-2 ${currentPath.zoneId && !currentPath.unitId ? 'bg-green-100 text-green-800' : ''}`} onClick={() => setCurrentPath({ siteId: currentPath.siteId, zoneId: currentPath.zoneId })}>
                  <Layers className="h-3 w-3 mr-1" />
                  {currentZone.name}
                </Button>
              </>
            )}
            {currentUnit && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="sm" className={`h-7 px-2 ${currentPath.unitId && !currentPath.activityId ? 'bg-purple-100 text-purple-800' : ''}`} onClick={() => setCurrentPath({ siteId: currentPath.siteId, zoneId: currentPath.zoneId, unitId: currentPath.unitId })}>
                  <Users className="h-3 w-3 mr-1" />
                  {currentUnit.name}
                </Button>
              </>
            )}
            {currentActivity && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="sm" className="h-7 px-2 bg-orange-100 text-orange-800">
                  <ActivityIcon className="h-3 w-3 mr-1" />
                  {currentActivity.name}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <div className="flex border-b">
          {!currentPath.siteId && sites.map(site => (
            <Button key={site.id} variant="ghost" size="sm" className="rounded-none border-r h-8 text-xs" onClick={() => setCurrentPath({ siteId: site.id })}>
              <MapPin className="h-3 w-3 mr-1 text-blue-600" />{site.name} ({(site.risks || []).filter(r => r.isValidated).length + site.zones.reduce((acc, z) => acc + (z.risks || []).filter(r => r.isValidated).length + z.workUnits.reduce((acc2, u) => acc2 + (u.risks || []).filter(r => r.isValidated).length + u.activities.reduce((acc3, a) => acc3 + (a.risks || []).filter(r => r.isValidated).length, 0), 0), 0)})
            </Button>
          ))}
          {currentPath.siteId && !currentPath.zoneId && currentSite?.zones.map(zone => (
            <Button key={zone.id} variant="ghost" size="sm" className="rounded-none border-r h-8 text-xs" onClick={() => setCurrentPath({ ...currentPath, zoneId: zone.id })}>
              <Layers className="h-3 w-3 mr-1 text-green-600" />{zone.name}
            </Button>
          ))}
          {currentPath.zoneId && !currentPath.unitId && currentZone?.workUnits.map(unit => (
            <Button key={unit.id} variant="ghost" size="sm" className="rounded-none border-r h-8 text-xs" onClick={() => setCurrentPath({ ...currentPath, unitId: unit.id })}>
              <Users className="h-3 w-3 mr-1 text-purple-600" />{unit.name}
            </Button>
          ))}
          {currentPath.unitId && !currentPath.activityId && currentUnit?.activities.map(activity => (
            <Button key={activity.id} variant="ghost" size="sm" className="rounded-none border-r h-8 text-xs" onClick={() => setCurrentPath({ ...currentPath, activityId: activity.id })}>
              <ActivityIcon className="h-3 w-3 mr-1 text-orange-500" />{activity.name}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="rounded-none h-8 text-xs text-primary ml-auto" onClick={() => {
            const level = currentPath.activityId ? 'Activité' : currentPath.unitId ? 'Unité' : currentPath.zoneId ? 'Zone' : currentPath.siteId ? 'Site' : null;
            const element = currentActivity || currentUnit || currentZone || currentSite;
            if (level && element) generateRisks(level as any, element.id, element.name, currentPath);
            else toast({ title: "Sélectionnez un élément", variant: "destructive" });
          }} disabled={!!generatingFor}>
            {generatingFor ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Générer risques IA
          </Button>
        </div>

        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-semibold border-b w-[120px]">Zone / Unité / Activité</th>
                  <th className="text-left p-2 font-semibold border-b w-[100px]">Famille de risque</th>
                  <th className="text-left p-2 font-semibold border-b">Situation d'exposition et description</th>
                  <th className="text-center p-2 font-semibold border-b w-[40px]">G</th>
                  <th className="text-center p-2 font-semibold border-b w-[40px]">F</th>
                  <th className="text-center p-2 font-semibold border-b w-[40px]">M</th>
                  <th className="text-center p-2 font-semibold border-b w-[50px]">Score</th>
                  <th className="text-left p-2 font-semibold border-b">Mesures de prévention</th>
                  <th className="text-center p-2 font-semibold border-b w-[80px]">Priorité</th>
                  <th className="text-center p-2 font-semibold border-b w-[60px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Aucun risque évalué pour cette sélection</p>
                      <p className="text-xs mt-1">Cliquez sur "Générer risques IA" pour commencer</p>
                    </td>
                  </tr>
                ) : (
                  filteredRisks.map((r, idx) => (
                    <tr key={r.risk.id} className={`${RISK_ROW_COLORS[r.risk.priority || ''] || ''} hover:bg-muted/50 transition-colors`}>
                      <td className="p-2 border-b">
                        <div className="font-medium">{getLocationLabel(r)}</div>
                        <Badge variant="outline" className="text-[9px] mt-0.5">{r.level}</Badge>
                      </td>
                      <td className="p-2 border-b">
                        <Badge variant="secondary" className="text-[10px]">{r.risk.family || r.risk.type || '-'}</Badge>
                      </td>
                      <td className="p-2 border-b">
                        <div className="line-clamp-2">{r.risk.danger}</div>
                      </td>
                      <td className="p-2 border-b text-center font-mono font-bold">{r.risk.gravityValue || '-'}</td>
                      <td className="p-2 border-b text-center font-mono font-bold">{r.risk.frequencyValue || '-'}</td>
                      <td className="p-2 border-b text-center font-mono font-bold">{r.risk.controlValue || '-'}</td>
                      <td className="p-2 border-b text-center">
                        <span className="font-mono font-bold text-sm">{r.risk.riskScore?.toFixed(1) || '-'}</span>
                      </td>
                      <td className="p-2 border-b">
                        <div className="line-clamp-2 text-muted-foreground">{r.risk.measures || '-'}</div>
                      </td>
                      <td className="p-2 border-b text-center">
                        <Badge className={`text-[9px] ${PRIORITY_BADGE_COLORS[r.risk.priority || ''] || 'bg-gray-500'}`}>
                          {r.risk.priority?.replace('Priorité ', 'P').replace(' (Forte)', '').replace(' (Moyenne)', '').replace(' (Modéré)', '').replace(' (Faible)', '') || '-'}
                        </Badge>
                      </td>
                      <td className="p-2 border-b text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReviewingRisk(r)}><Eye className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRisk(r)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showStructureEditor} onOpenChange={setShowStructureEditor}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gérer la structure de l'entreprise</DialogTitle>
            <DialogDescription>Ajoutez et organisez vos sites, zones, unités de travail et activités</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            <div className="space-y-3">
              {sites.map(site => (
                <Card key={site.id} className="border">
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <Input value={site.name} onChange={(e) => updateSite(site.id, { name: e.target.value })} className="h-7 text-sm flex-1" />
                      <Select value={site.priority} onValueChange={(v: SitePriority) => updateSite(site.id, { priority: v })}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{SITE_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => addZone(site.id)}><Plus className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => removeSite(site.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3">
                    <div className="ml-4 border-l-2 border-blue-200 pl-3 space-y-2">
                      {site.zones.map(zone => (
                        <div key={zone.id} className="bg-muted/30 rounded p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <Layers className="h-3 w-3 text-green-600" />
                            <Input value={zone.name} onChange={(e) => updateZone(site.id, zone.id, { name: e.target.value })} className="h-6 text-xs flex-1" />
                            <Button variant="ghost" size="sm" className="h-6" onClick={() => addWorkUnit(site.id, zone.id)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-6" onClick={() => removeZone(site.id, zone.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                          <div className="ml-3 border-l border-green-200 pl-2 space-y-1">
                            {zone.workUnits.map(unit => (
                              <div key={unit.id} className="bg-background rounded p-1.5 space-y-1">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-purple-600" />
                                  <Input value={unit.name} onChange={(e) => updateWorkUnit(site.id, zone.id, unit.id, { name: e.target.value })} className="h-5 text-[10px] flex-1" />
                                  <Button variant="ghost" size="sm" className="h-5" onClick={() => addActivity(site.id, zone.id, unit.id)}><Plus className="h-2 w-2" /></Button>
                                  <Button variant="ghost" size="sm" className="h-5" onClick={() => removeUnit(site.id, zone.id, unit.id)}><Trash2 className="h-2 w-2 text-destructive" /></Button>
                                </div>
                                <div className="ml-2 border-l border-purple-200 pl-1.5 space-y-0.5">
                                  {unit.activities.map(activity => (
                                    <div key={activity.id} className="flex items-center gap-1">
                                      <ActivityIcon className="h-2 w-2 text-orange-500" />
                                      <Input value={activity.name} onChange={(e) => updateActivity(site.id, zone.id, unit.id, activity.id, { name: e.target.value })} className="h-4 text-[9px] flex-1" />
                                      <Button variant="ghost" size="sm" className="h-4" onClick={() => removeActivity(site.id, zone.id, unit.id, activity.id)}><Trash2 className="h-2 w-2 text-destructive" /></Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addSite} className="w-full"><Plus className="h-4 w-4 mr-2" />Ajouter un site</Button>
            </div>
          </ScrollArea>
          <DialogFooter><Button onClick={() => setShowStructureEditor(false)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingRisks} onOpenChange={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Validation des risques - {pendingRisks?.level}: {pendingRisks?.elementName}</DialogTitle>
            <DialogDescription>Sélectionnez les risques à ajouter au tableau DUERP ({selectedPendingRisks.size}/{pendingRisks?.risks.length || 0})</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {pendingRisks?.risks.map((risk) => (
                <div key={risk.id} className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${selectedPendingRisks.has(risk.id) ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`} onClick={() => { const newSet = new Set(selectedPendingRisks); if (newSet.has(risk.id)) newSet.delete(risk.id); else newSet.add(risk.id); setSelectedPendingRisks(newSet); }}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={selectedPendingRisks.has(risk.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{risk.family || risk.type}</Badge>
                        <Badge className={`text-xs ${PRIORITY_BADGE_COLORS[risk.priority || ''] || 'bg-gray-500'}`}>{risk.priority}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">G:{risk.gravityValue} F:{risk.frequencyValue} M:{risk.controlValue} = {risk.riskScore?.toFixed(1)}</span>
                      </div>
                      <p className="text-sm font-medium">{risk.danger}</p>
                      <p className="text-xs text-muted-foreground mt-1"><strong>Mesures :</strong> {risk.measures}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}><X className="h-4 w-4 mr-2" />Annuler</Button>
            <Button onClick={validateSelectedRisks} disabled={selectedPendingRisks.size === 0}><Check className="h-4 w-4 mr-2" />Valider ({selectedPendingRisks.size})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewingRisk} onOpenChange={() => setReviewingRisk(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du risque</DialogTitle>
            <DialogDescription>{reviewingRisk && `${reviewingRisk.siteName}${reviewingRisk.zoneName ? ' > ' + reviewingRisk.zoneName : ''}${reviewingRisk.unitName ? ' > ' + reviewingRisk.unitName : ''}${reviewingRisk.activityName ? ' > ' + reviewingRisk.activityName : ''}`}</DialogDescription>
          </DialogHeader>
          {reviewingRisk && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-muted-foreground">Famille</label><p className="text-sm">{reviewingRisk.risk.family || reviewingRisk.risk.type || '-'}</p></div>
                <div><label className="text-xs font-medium text-muted-foreground">Priorité</label><Badge className={PRIORITY_BADGE_COLORS[reviewingRisk.risk.priority || ''] || 'bg-gray-500'}>{reviewingRisk.risk.priority}</Badge></div>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground">Danger / Dommage</label><p className="text-sm">{reviewingRisk.risk.danger}</p></div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Gravité</label><p className="text-lg font-bold">{reviewingRisk.risk.gravityValue}</p><p className="text-xs text-muted-foreground">{reviewingRisk.risk.gravity}</p></div>
                <div><label className="text-xs font-medium text-muted-foreground">Fréquence</label><p className="text-lg font-bold">{reviewingRisk.risk.frequencyValue}</p><p className="text-xs text-muted-foreground">{reviewingRisk.risk.frequency}</p></div>
                <div><label className="text-xs font-medium text-muted-foreground">Maîtrise</label><p className="text-lg font-bold">{reviewingRisk.risk.controlValue}</p><p className="text-xs text-muted-foreground">{reviewingRisk.risk.control}</p></div>
                <div><label className="text-xs font-medium text-muted-foreground">Score</label><p className="text-lg font-bold text-primary">{reviewingRisk.risk.riskScore?.toFixed(2)}</p></div>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground">Mesures de prévention</label><p className="text-sm">{reviewingRisk.risk.measures}</p></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingRisk(null)}>Fermer</Button>
            <Button variant="destructive" onClick={() => { if (reviewingRisk) { removeRisk(reviewingRisk); setReviewingRisk(null); } }}><Trash2 className="h-4 w-4 mr-2" />Retirer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
