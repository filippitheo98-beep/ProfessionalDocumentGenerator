import { useState, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronDown, 
  ChevronRight,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Loader2,
  GripVertical,
  Eye,
  RefreshCw,
  Table,
  Edit3,
  RotateCcw
} from "lucide-react";
import type { 
  Site, 
  WorkZone, 
  WorkUnit, 
  Activity, 
  Risk,
  SitePriority,
  PreventionMeasure
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

const PRIORITY_COLORS: Record<SitePriority, string> = {
  'Principal': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Secondaire': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Occasionnel': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Temporaire': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const RISK_PRIORITY_COLORS: Record<string, string> = {
  'Priorité 1 (Forte)': 'bg-red-500 text-white',
  'Priorité 2 (Moyenne)': 'bg-orange-500 text-white',
  'Priorité 3 (Modéré)': 'bg-yellow-500 text-black',
  'Priorité 4 (Faible)': 'bg-green-500 text-white',
};

interface ValidatedRiskWithPath {
  risk: Risk;
  siteName: string;
  zoneName?: string;
  unitName?: string;
  activityName?: string;
  path: { siteId: string; zoneId?: string; unitId?: string; activityId?: string };
  level: string;
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
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'structure' | 'risks'>('structure');
  const [pendingRisks, setPendingRisks] = useState<{
    risks: Risk[];
    elementId: string;
    elementName: string;
    level: string;
    path: { siteId?: string; zoneId?: string; unitId?: string };
  } | null>(null);
  const [selectedPendingRisks, setSelectedPendingRisks] = useState<Set<string>>(new Set());
  const [reviewingRisk, setReviewingRisk] = useState<ValidatedRiskWithPath | null>(null);

  const allValidatedRisks = useMemo((): ValidatedRiskWithPath[] => {
    const risks: ValidatedRiskWithPath[] = [];
    
    for (const site of sites) {
      for (const risk of (site.risks || []).filter(r => r.isValidated)) {
        risks.push({
          risk,
          siteName: site.name,
          path: { siteId: site.id },
          level: 'Site'
        });
      }
      
      for (const zone of site.zones || []) {
        for (const risk of (zone.risks || []).filter(r => r.isValidated)) {
          risks.push({
            risk,
            siteName: site.name,
            zoneName: zone.name,
            path: { siteId: site.id, zoneId: zone.id },
            level: 'Zone'
          });
        }
        
        for (const unit of zone.workUnits || []) {
          for (const risk of (unit.risks || []).filter(r => r.isValidated)) {
            risks.push({
              risk,
              siteName: site.name,
              zoneName: zone.name,
              unitName: unit.name,
              path: { siteId: site.id, zoneId: zone.id, unitId: unit.id },
              level: 'Unité'
            });
          }
          
          for (const activity of unit.activities || []) {
            for (const risk of (activity.risks || []).filter(r => r.isValidated)) {
              risks.push({
                risk,
                siteName: site.name,
                zoneName: zone.name,
                unitName: unit.name,
                activityName: activity.name,
                path: { siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id },
                level: 'Activité'
              });
            }
          }
        }
      }
    }
    
    return risks;
  }, [sites]);

  const toggleExpanded = (id: string, type: 'site' | 'zone' | 'unit') => {
    const setterMap = {
      site: setExpandedSites,
      zone: setExpandedZones,
      unit: setExpandedUnits
    };
    setterMap[type](prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const addSite = () => {
    const newSite: Site = {
      id: crypto.randomUUID(),
      name: '',
      priority: 'Principal',
      companyId,
      zones: [],
      risks: [],
      preventionMeasures: [],
      order: sites.length
    };
    onUpdateSites([...sites, newSite]);
    setExpandedSites(prev => new Set(Array.from(prev).concat(newSite.id)));
  };

  const updateSite = (siteId: string, updates: Partial<Site>) => {
    onUpdateSites(sites.map(s => s.id === siteId ? { ...s, ...updates } : s));
  };

  const removeSite = (siteId: string) => {
    onUpdateSites(sites.filter(s => s.id !== siteId));
  };

  const addZone = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    const newZone: WorkZone = {
      id: crypto.randomUUID(),
      name: '',
      siteId,
      workUnits: [],
      risks: [],
      preventionMeasures: [],
      order: site.zones.length
    };

    updateSite(siteId, { zones: [...site.zones, newZone] });
    setExpandedZones(prev => new Set(Array.from(prev).concat(newZone.id)));
  };

  const updateZone = (siteId: string, zoneId: string, updates: Partial<WorkZone>) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    updateSite(siteId, {
      zones: site.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z)
    });
  };

  const removeZone = (siteId: string, zoneId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    updateSite(siteId, {
      zones: site.zones.filter(z => z.id !== zoneId)
    });
  };

  const addWorkUnit = (siteId: string, zoneId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;

    const newUnit: WorkUnit = {
      id: crypto.randomUUID(),
      name: '',
      zoneId,
      activities: [],
      risks: [],
      preventionMeasures: [],
      order: zone.workUnits.length
    };

    updateZone(siteId, zoneId, { workUnits: [...zone.workUnits, newUnit] });
    setExpandedUnits(prev => new Set(Array.from(prev).concat(newUnit.id)));
  };

  const updateWorkUnit = (siteId: string, zoneId: string, unitId: string, updates: Partial<WorkUnit>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;

    updateZone(siteId, zoneId, {
      workUnits: zone.workUnits.map(u => u.id === unitId ? { ...u, ...updates } : u)
    });
  };

  const removeWorkUnit = (siteId: string, zoneId: string, unitId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;

    updateZone(siteId, zoneId, {
      workUnits: zone.workUnits.filter(u => u.id !== unitId)
    });
  };

  const addActivity = (siteId: string, zoneId: string, unitId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      name: '',
      workUnitId: unitId,
      risks: [],
      preventionMeasures: [],
      order: unit.activities.length
    };

    updateWorkUnit(siteId, zoneId, unitId, { activities: [...unit.activities, newActivity] });
  };

  const updateActivity = (siteId: string, zoneId: string, unitId: string, activityId: string, updates: Partial<Activity>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;

    updateWorkUnit(siteId, zoneId, unitId, {
      activities: unit.activities.map(a => a.id === activityId ? { ...a, ...updates } : a)
    });
  };

  const removeActivity = (siteId: string, zoneId: string, unitId: string, activityId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;

    updateWorkUnit(siteId, zoneId, unitId, {
      activities: unit.activities.filter(a => a.id !== activityId)
    });
  };

  const generateRisksForElement = async (
    level: 'Site' | 'Zone' | 'Unité' | 'Activité',
    elementId: string,
    elementName: string,
    path: { siteId?: string; zoneId?: string; unitId?: string },
    appendToExisting: boolean = false
  ) => {
    if (!elementName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez d'abord nommer l'élément avant de générer les risques.",
        variant: "destructive"
      });
      return;
    }

    setGeneratingFor(elementId);

    try {
      const site = path.siteId ? sites.find(s => s.id === path.siteId) : undefined;
      const zone = site && path.zoneId ? site.zones.find(z => z.id === path.zoneId) : undefined;
      
      const response = await apiRequest('/api/generate-hierarchical-risks', {
        method: 'POST',
        body: JSON.stringify({
          level,
          elementName,
          companyActivity,
          companyDescription,
          companyId,
          siteName: site?.name,
          zoneName: zone?.name,
          workUnitName: path.unitId ? zone?.workUnits.find(u => u.id === path.unitId)?.name : undefined,
        }),
      });

      if (response.risks && response.risks.length > 0) {
        setPendingRisks({
          risks: response.risks,
          elementId,
          elementName,
          level,
          path
        });
        setSelectedPendingRisks(new Set(response.risks.map((r: Risk) => r.id)));
      } else {
        toast({
          title: "Aucun risque identifié",
          description: "L'IA n'a pas identifié de risques spécifiques pour cet élément.",
        });
      }
    } catch (error) {
      console.error('Error generating risks:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer les risques. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const togglePendingRisk = (riskId: string) => {
    setSelectedPendingRisks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riskId)) {
        newSet.delete(riskId);
      } else {
        newSet.add(riskId);
      }
      return newSet;
    });
  };

  const validateSelectedRisks = () => {
    if (!pendingRisks) return;

    const { level, path, elementId } = pendingRisks;
    const validatedRisks = pendingRisks.risks
      .filter(r => selectedPendingRisks.has(r.id))
      .map(r => ({ ...r, isValidated: true }));

    const getCurrentRisks = (): Risk[] => {
      if (level === 'Site') {
        return sites.find(s => s.id === elementId)?.risks || [];
      } else if (level === 'Zone' && path.siteId) {
        const site = sites.find(s => s.id === path.siteId);
        return site?.zones.find(z => z.id === elementId)?.risks || [];
      } else if (level === 'Unité' && path.siteId && path.zoneId) {
        const site = sites.find(s => s.id === path.siteId);
        const zone = site?.zones.find(z => z.id === path.zoneId);
        return zone?.workUnits.find(u => u.id === elementId)?.risks || [];
      } else if (level === 'Activité' && path.siteId && path.zoneId && path.unitId) {
        const site = sites.find(s => s.id === path.siteId);
        const zone = site?.zones.find(z => z.id === path.zoneId);
        const unit = zone?.workUnits.find(u => u.id === path.unitId);
        return unit?.activities.find(a => a.id === elementId)?.risks || [];
      }
      return [];
    };

    const existingRisks = getCurrentRisks().filter(r => r.isValidated);
    const mergedRisks = [...existingRisks, ...validatedRisks];

    if (level === 'Site') {
      updateSite(elementId, { risks: mergedRisks });
    } else if (level === 'Zone' && path.siteId) {
      updateZone(path.siteId, elementId, { risks: mergedRisks });
    } else if (level === 'Unité' && path.siteId && path.zoneId) {
      updateWorkUnit(path.siteId, path.zoneId, elementId, { risks: mergedRisks });
    } else if (level === 'Activité' && path.siteId && path.zoneId && path.unitId) {
      updateActivity(path.siteId, path.zoneId, path.unitId, elementId, { risks: mergedRisks });
    }

    toast({
      title: "Risques validés",
      description: `${validatedRisks.length} risque(s) ajouté(s) au tableau DUERP.`,
    });

    setPendingRisks(null);
    setSelectedPendingRisks(new Set());
    setActiveTab('risks');
  };

  const removeValidatedRisk = (riskWithPath: ValidatedRiskWithPath) => {
    const { risk, path, level } = riskWithPath;
    
    const removeFromArray = (risks: Risk[]) => 
      risks.filter(r => r.id !== risk.id);

    if (level === 'Site') {
      const site = sites.find(s => s.id === path.siteId);
      if (site) updateSite(path.siteId, { risks: removeFromArray(site.risks || []) });
    } else if (level === 'Zone' && path.zoneId) {
      const site = sites.find(s => s.id === path.siteId);
      const zone = site?.zones.find(z => z.id === path.zoneId);
      if (zone) updateZone(path.siteId, path.zoneId, { risks: removeFromArray(zone.risks || []) });
    } else if (level === 'Unité' && path.unitId) {
      const site = sites.find(s => s.id === path.siteId);
      const zone = site?.zones.find(z => z.id === path.zoneId);
      const unit = zone?.workUnits.find(u => u.id === path.unitId);
      if (unit) updateWorkUnit(path.siteId, path.zoneId!, path.unitId, { risks: removeFromArray(unit.risks || []) });
    } else if (level === 'Activité' && path.activityId) {
      const site = sites.find(s => s.id === path.siteId);
      const zone = site?.zones.find(z => z.id === path.zoneId);
      const unit = zone?.workUnits.find(u => u.id === path.unitId);
      const activity = unit?.activities.find(a => a.id === path.activityId);
      if (activity) updateActivity(path.siteId, path.zoneId!, path.unitId!, path.activityId, { risks: removeFromArray(activity.risks || []) });
    }

    toast({
      title: "Risque retiré",
      description: "Le risque a été retiré du tableau DUERP.",
    });
  };

  const countTotalRisks = (site: Site): number => {
    let count = (site.risks || []).filter(r => r.isValidated).length;
    for (const zone of site.zones || []) {
      count += (zone.risks || []).filter(r => r.isValidated).length;
      for (const unit of zone.workUnits || []) {
        count += (unit.risks || []).filter(r => r.isValidated).length;
        for (const activity of unit.activities || []) {
          count += (activity.risks || []).filter(r => r.isValidated).length;
        }
      }
    }
    return count;
  };

  const getHierarchyPath = (riskWithPath: ValidatedRiskWithPath): string => {
    const parts = [riskWithPath.siteName];
    if (riskWithPath.zoneName) parts.push(riskWithPath.zoneName);
    if (riskWithPath.unitName) parts.push(riskWithPath.unitName);
    if (riskWithPath.activityName) parts.push(riskWithPath.activityName);
    return parts.join(' > ');
  };

  const renderSiteContent = (site: Site, siteIndex: number) => (
    <Card key={site.id} className="border-2">
      <Collapsible
        open={expandedSites.has(site.id)}
        onOpenChange={() => toggleExpanded(site.id, 'site')}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSites.has(site.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <MapPin className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-medium">{site.name || 'Nouveau site'}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={`text-xs ${PRIORITY_COLORS[site.priority]}`}>
                      {site.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {countTotalRisks(site)} risque(s)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateRisksForElement('Site', site.id, site.name, { siteId: site.id });
                  }}
                  disabled={generatingFor === site.id || !site.name}
                  data-testid={`btn-generate-site-risks-${siteIndex}`}
                >
                  {generatingFor === site.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSite(site.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Nom du site *</label>
                <Input
                  placeholder="Ex: Siège social..."
                  value={site.name}
                  onChange={(e) => updateSite(site.id, { name: e.target.value })}
                  className="h-8 text-sm"
                  data-testid={`input-site-name-${siteIndex}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Priorité</label>
                <Select
                  value={site.priority}
                  onValueChange={(value: SitePriority) => updateSite(site.id, { priority: value })}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-site-priority-${siteIndex}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-muted pl-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Zones</span>
                <Button variant="outline" size="sm" onClick={() => addZone(site.id)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Zone
                </Button>
              </div>

              {(site.zones || []).map((zone, zoneIndex) => (
                <Card key={zone.id} className="border">
                  <Collapsible
                    open={expandedZones.has(zone.id)}
                    onOpenChange={() => toggleExpanded(zone.id, 'zone')}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {expandedZones.has(zone.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <Layers className="h-3 w-3 text-green-600" />
                            <span className="text-sm font-medium">{zone.name || 'Nouvelle zone'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateRisksForElement('Zone', zone.id, zone.name, { siteId: site.id, zoneId: zone.id });
                              }}
                              disabled={generatingFor === zone.id || !zone.name}
                            >
                              {generatingFor === zone.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeZone(site.id, zone.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="space-y-3 pt-0">
                        <Input
                          placeholder="Nom de la zone..."
                          value={zone.name}
                          onChange={(e) => updateZone(site.id, zone.id, { name: e.target.value })}
                          className="h-8 text-sm"
                        />

                        <div className="ml-4 border-l-2 border-muted pl-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Unités de travail</span>
                            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => addWorkUnit(site.id, zone.id)}>
                              <Plus className="h-2 w-2 mr-1" />
                              Unité
                            </Button>
                          </div>

                          {(zone.workUnits || []).map((unit, unitIndex) => (
                            <Card key={unit.id} className="border">
                              <Collapsible
                                open={expandedUnits.has(unit.id)}
                                onOpenChange={() => toggleExpanded(unit.id, 'unit')}
                              >
                                <CollapsibleTrigger asChild>
                                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-1.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {expandedUnits.has(unit.id) ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                        <Users className="h-3 w-3 text-purple-600" />
                                        <span className="text-xs font-medium">{unit.name || 'Nouvelle unité'}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateRisksForElement('Unité', unit.id, unit.name, { siteId: site.id, zoneId: zone.id, unitId: unit.id });
                                          }}
                                          disabled={generatingFor === unit.id || !unit.name}
                                        >
                                          {generatingFor === unit.id ? (
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                          ) : (
                                            <Sparkles className="h-2.5 w-2.5" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeWorkUnit(site.id, zone.id, unit.id);
                                          }}
                                        >
                                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardHeader>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <CardContent className="space-y-2 pt-0 px-2">
                                    <Input
                                      placeholder="Nom de l'unité..."
                                      value={unit.name}
                                      onChange={(e) => updateWorkUnit(site.id, zone.id, unit.id, { name: e.target.value })}
                                      className="h-7 text-xs"
                                    />

                                    <div className="ml-3 border-l border-muted pl-3 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Activités</span>
                                        <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => addActivity(site.id, zone.id, unit.id)}>
                                          <Plus className="h-2 w-2" />
                                        </Button>
                                      </div>

                                      {(unit.activities || []).map((activity, actIndex) => (
                                        <div key={activity.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                                          <ActivityIcon className="h-3 w-3 text-orange-500" />
                                          <Input
                                            placeholder="Activité..."
                                            value={activity.name}
                                            onChange={(e) => updateActivity(site.id, zone.id, unit.id, activity.id, { name: e.target.value })}
                                            className="h-6 text-xs flex-1"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => generateRisksForElement('Activité', activity.id, activity.name, { siteId: site.id, zoneId: zone.id, unitId: unit.id })}
                                            disabled={generatingFor === activity.id || !activity.name}
                                          >
                                            {generatingFor === activity.id ? (
                                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                            ) : (
                                              <Sparkles className="h-2.5 w-2.5" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0"
                                            onClick={() => removeActivity(site.id, zone.id, unit.id, activity.id)}
                                          >
                                            <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Éditeur DUERP Hiérarchique
          </h2>
          <p className="text-sm text-muted-foreground">
            Créez votre structure, générez des risques avec l'IA, et validez-les dans le tableau.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {allValidatedRisks.length} risque(s) validé(s)
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'structure' | 'risks')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Structure & Génération
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            Tableau des risques ({allValidatedRisks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-4">
          {sites.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Commencez par ajouter un site (établissement, agence, chantier...)
                  </p>
                  <Button onClick={addSite}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un site
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sites.map((site, siteIndex) => renderSiteContent(site, siteIndex))}
              <Button variant="outline" onClick={addSite} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un site
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {allValidatedRisks.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Table className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Aucun risque validé pour l'instant
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Utilisez les boutons <Sparkles className="h-3 w-3 inline" /> dans l'onglet Structure pour générer et valider des risques.
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('structure')}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Aller à la structure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Tableau DUERP - Risques validés</span>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('structure')}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Générer plus
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground border-b pb-2 sticky top-0 bg-background">
                      <div className="col-span-3">Localisation</div>
                      <div className="col-span-2">Famille</div>
                      <div className="col-span-3">Danger</div>
                      <div className="col-span-1">Priorité</div>
                      <div className="col-span-2">Mesures</div>
                      <div className="col-span-1">Actions</div>
                    </div>
                    
                    {allValidatedRisks.map((riskWithPath, index) => (
                      <div 
                        key={riskWithPath.risk.id} 
                        className="grid grid-cols-12 gap-2 text-xs py-2 border-b hover:bg-muted/50 items-center"
                      >
                        <div className="col-span-3">
                          <div className="font-medium">{getHierarchyPath(riskWithPath)}</div>
                          <Badge variant="outline" className="text-[10px] mt-1">{riskWithPath.level}</Badge>
                        </div>
                        <div className="col-span-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {riskWithPath.risk.family || riskWithPath.risk.type || 'Non classifié'}
                          </Badge>
                        </div>
                        <div className="col-span-3 line-clamp-2">
                          {riskWithPath.risk.danger}
                        </div>
                        <div className="col-span-1">
                          <Badge className={`text-[10px] ${RISK_PRIORITY_COLORS[riskWithPath.risk.priority || ''] || 'bg-gray-500'}`}>
                            {riskWithPath.risk.priority?.replace('Priorité ', 'P') || 'N/A'}
                          </Badge>
                        </div>
                        <div className="col-span-2 line-clamp-2 text-muted-foreground">
                          {riskWithPath.risk.measures || '-'}
                        </div>
                        <div className="col-span-1 flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setReviewingRisk(riskWithPath)}
                            title="Voir détails"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeValidatedRisk(riskWithPath)}
                            title="Retirer"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {pendingRisks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Validation des risques - {pendingRisks.level}: {pendingRisks.elementName}
              </CardTitle>
              <CardDescription>
                L'IA a identifié {pendingRisks.risks.length} risques. Sélectionnez ceux à ajouter au tableau DUERP.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea className="max-h-[50vh] p-4">
                <div className="space-y-2">
                  {pendingRisks.risks.map((risk) => (
                    <div 
                      key={risk.id}
                      className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedPendingRisks.has(risk.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                      onClick={() => togglePendingRisk(risk.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedPendingRisks.has(risk.id)}
                          onCheckedChange={() => togglePendingRisk(risk.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {risk.family || risk.type}
                            </Badge>
                            <Badge 
                              className={`text-xs ${RISK_PRIORITY_COLORS[risk.priority || ''] || 'bg-gray-500'}`}
                            >
                              {risk.priority}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{risk.danger}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Mesures :</strong> {risk.measures}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>

            <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedPendingRisks.size} risque(s) sélectionné(s) sur {pendingRisks.risks.length}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={validateSelectedRisks} disabled={selectedPendingRisks.size === 0}>
                  <Check className="h-4 w-4 mr-2" />
                  Valider ({selectedPendingRisks.size})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {reviewingRisk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Détails du risque
              </CardTitle>
              <CardDescription>
                {getHierarchyPath(reviewingRisk)}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Famille de risque</label>
                <p className="text-sm">{reviewingRisk.risk.family || reviewingRisk.risk.type || 'Non classifié'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Danger / Dommage</label>
                <p className="text-sm">{reviewingRisk.risk.danger}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Gravité</label>
                  <p className="text-sm">{reviewingRisk.risk.gravity} ({reviewingRisk.risk.gravityValue})</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Fréquence</label>
                  <p className="text-sm">{reviewingRisk.risk.frequency} ({reviewingRisk.risk.frequencyValue})</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Maîtrise</label>
                  <p className="text-sm">{reviewingRisk.risk.control} ({reviewingRisk.risk.controlValue})</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Score de risque</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{reviewingRisk.risk.riskScore?.toFixed(2)}</span>
                  <Badge className={RISK_PRIORITY_COLORS[reviewingRisk.risk.priority || ''] || 'bg-gray-500'}>
                    {reviewingRisk.risk.priority}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Mesures de prévention</label>
                <p className="text-sm">{reviewingRisk.risk.measures}</p>
              </div>
            </CardContent>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewingRisk(null)}>
                Fermer
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => { 
                  removeValidatedRisk(reviewingRisk); 
                  setReviewingRisk(null); 
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Retirer du DUERP
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
