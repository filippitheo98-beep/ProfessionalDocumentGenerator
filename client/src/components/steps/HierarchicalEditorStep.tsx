import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  GripVertical
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

interface RiskValidationModalProps {
  risks: Risk[];
  onValidate: (validatedRisks: Risk[]) => void;
  onCancel: () => void;
  elementName: string;
  level: string;
}

function RiskValidationModal({ risks, onValidate, onCancel, elementName, level }: RiskValidationModalProps) {
  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(
    new Set(risks.map(r => r.id))
  );

  const toggleRisk = (riskId: string) => {
    setSelectedRisks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riskId)) {
        newSet.delete(riskId);
      } else {
        newSet.add(riskId);
      }
      return newSet;
    });
  };

  const handleValidate = () => {
    const validatedRisks = risks
      .filter(r => selectedRisks.has(r.id))
      .map(r => ({ ...r, isValidated: true }));
    onValidate(validatedRisks);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Validation des risques - {level}: {elementName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            L'IA a identifié {risks.length} risques. Sélectionnez ceux à conserver dans votre DUERP.
          </p>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
          {risks.map((risk, index) => (
            <div 
              key={risk.id}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                selectedRisks.has(risk.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
              onClick={() => toggleRisk(risk.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox 
                  checked={selectedRisks.has(risk.id)}
                  onCheckedChange={() => toggleRisk(risk.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {risk.family || risk.type}
                    </Badge>
                    <Badge 
                      className={`text-xs ${
                        risk.priority === 'Priorité 1 (Forte)' ? 'bg-red-500' :
                        risk.priority === 'Priorité 2 (Moyenne)' ? 'bg-orange-500' :
                        risk.priority === 'Priorité 3 (Modéré)' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                    >
                      {risk.priority}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{risk.danger}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Mesures :</strong> {risk.measures}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedRisks.size} risque(s) sélectionné(s) sur {risks.length}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleValidate}>
              <Check className="h-4 w-4 mr-2" />
              Valider la sélection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [pendingRisks, setPendingRisks] = useState<{
    risks: Risk[];
    elementId: string;
    elementName: string;
    level: string;
    path: { siteId?: string; zoneId?: string; unitId?: string };
  } | null>(null);

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
    setExpandedSites(prev => new Set([...prev, newSite.id]));
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
    setExpandedZones(prev => new Set([...prev, newZone.id]));
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
    setExpandedUnits(prev => new Set([...prev, newUnit.id]));
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
    path: { siteId?: string; zoneId?: string; unitId?: string }
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

  const handleValidateRisks = (validatedRisks: Risk[]) => {
    if (!pendingRisks) return;

    const { level, path, elementId } = pendingRisks;

    if (level === 'Site') {
      updateSite(elementId, { risks: validatedRisks });
    } else if (level === 'Zone' && path.siteId) {
      updateZone(path.siteId, elementId, { risks: validatedRisks });
    } else if (level === 'Unité' && path.siteId && path.zoneId) {
      updateWorkUnit(path.siteId, path.zoneId, elementId, { risks: validatedRisks });
    } else if (level === 'Activité' && path.siteId && path.zoneId && path.unitId) {
      updateActivity(path.siteId, path.zoneId, path.unitId, elementId, { risks: validatedRisks });
    }

    toast({
      title: "Risques validés",
      description: `${validatedRisks.length} risque(s) ont été ajoutés au DUERP.`,
    });

    setPendingRisks(null);
  };

  const countTotalRisks = (site: Site): number => {
    let count = site.risks.filter(r => r.isValidated).length;
    for (const zone of site.zones) {
      count += zone.risks.filter(r => r.isValidated).length;
      for (const unit of zone.workUnits) {
        count += unit.risks.filter(r => r.isValidated).length;
        for (const activity of unit.activities) {
          count += activity.risks.filter(r => r.isValidated).length;
        }
      }
    }
    return count;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Structure hiérarchique de l'entreprise
          </CardTitle>
          <CardDescription>
            Créez la structure de votre entreprise : Sites → Zones → Unités de travail → Activités.
            L'IA générera des risques pertinents à chaque niveau que vous pourrez valider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sites.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Commencez par ajouter un site (établissement, agence, chantier...)
              </p>
              <Button onClick={addSite}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un site
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sites.map((site, siteIndex) => (
                <Card key={site.id} className="border-2">
                  <Collapsible
                    open={expandedSites.has(site.id)}
                    onOpenChange={() => toggleExpanded(site.id, 'site')}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            {expandedSites.has(site.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <MapPin className="h-5 w-5 text-blue-600" />
                            <div>
                              <CardTitle className="text-lg">
                                {site.name || 'Nouveau site'}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={PRIORITY_COLORS[site.priority]}>
                                  {site.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {site.zones.length} zone(s) • {countTotalRisks(site)} risque(s) validé(s)
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSite(site.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Nom du site *</label>
                            <Input
                              placeholder="Ex: Siège social, Usine de production..."
                              value={site.name}
                              onChange={(e) => updateSite(site.id, { name: e.target.value })}
                              data-testid={`input-site-name-${siteIndex}`}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Priorité</label>
                            <Select
                              value={site.priority}
                              onValueChange={(value: SitePriority) => updateSite(site.id, { priority: value })}
                            >
                              <SelectTrigger data-testid={`select-site-priority-${siteIndex}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SITE_PRIORITIES.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium">Adresse</label>
                            <Input
                              placeholder="Adresse du site"
                              value={site.address || ''}
                              onChange={(e) => updateSite(site.id, { address: e.target.value })}
                              data-testid={`input-site-address-${siteIndex}`}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                              placeholder="Description du site pour enrichir l'analyse IA..."
                              value={site.description || ''}
                              onChange={(e) => updateSite(site.id, { description: e.target.value })}
                              data-testid={`textarea-site-description-${siteIndex}`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateRisksForElement('Site', site.id, site.name, {})}
                            disabled={generatingFor === site.id || !site.name}
                            data-testid={`button-generate-site-risks-${siteIndex}`}
                          >
                            {generatingFor === site.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Générer les risques du site
                          </Button>
                          {site.risks.length > 0 && (
                            <Badge variant="secondary">
                              {site.risks.filter(r => r.isValidated).length} risque(s)
                            </Badge>
                          )}
                        </div>

                        <div className="border-t pt-4 mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              Zones de travail
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addZone(site.id)}
                              data-testid={`button-add-zone-${siteIndex}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter une zone
                            </Button>
                          </div>

                          <div className="space-y-3 ml-4">
                            {site.zones.map((zone, zoneIndex) => (
                              <Card key={zone.id} className="border">
                                <Collapsible
                                  open={expandedZones.has(zone.id)}
                                  onOpenChange={() => toggleExpanded(zone.id, 'zone')}
                                >
                                  <CollapsibleTrigger asChild>
                                    <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {expandedZones.has(zone.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <Layers className="h-4 w-4 text-green-600" />
                                          <span className="font-medium">
                                            {zone.name || 'Nouvelle zone'}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            ({zone.workUnits.length} unité(s))
                                          </span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeZone(site.id, zone.id);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </CardHeader>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <CardContent className="pt-0 space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                          <Input
                                            placeholder="Nom de la zone (ex: Atelier, Bureau, Entrepôt...)"
                                            value={zone.name}
                                            onChange={(e) => updateZone(site.id, zone.id, { name: e.target.value })}
                                            data-testid={`input-zone-name-${siteIndex}-${zoneIndex}`}
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateRisksForElement('Zone', zone.id, zone.name, { siteId: site.id })}
                                            disabled={generatingFor === zone.id || !zone.name}
                                          >
                                            {generatingFor === zone.id ? (
                                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            ) : (
                                              <Sparkles className="h-4 w-4 mr-1" />
                                            )}
                                            Générer risques
                                          </Button>
                                          {zone.risks.length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              {zone.risks.filter(r => r.isValidated).length} risque(s)
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      <div className="border-l-2 border-muted pl-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Unités de travail
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => addWorkUnit(site.id, zone.id)}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Ajouter
                                          </Button>
                                        </div>

                                        {zone.workUnits.map((unit, unitIndex) => (
                                          <Card key={unit.id} className="border bg-muted/20">
                                            <Collapsible
                                              open={expandedUnits.has(unit.id)}
                                              onOpenChange={() => toggleExpanded(unit.id, 'unit')}
                                            >
                                              <CollapsibleTrigger asChild>
                                                <CardHeader className="py-2 cursor-pointer">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                      {expandedUnits.has(unit.id) ? (
                                                        <ChevronDown className="h-3 w-3" />
                                                      ) : (
                                                        <ChevronRight className="h-3 w-3" />
                                                      )}
                                                      <Users className="h-4 w-4 text-purple-600" />
                                                      <span className="text-sm font-medium">
                                                        {unit.name || 'Nouvelle unité'}
                                                      </span>
                                                    </div>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeWorkUnit(site.id, zone.id, unit.id);
                                                      }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </CardHeader>
                                              </CollapsibleTrigger>

                                              <CollapsibleContent>
                                                <CardContent className="py-2 space-y-2">
                                                  <Input
                                                    placeholder="Nom de l'unité (ex: Poste de soudure, Accueil...)"
                                                    value={unit.name}
                                                    onChange={(e) => updateWorkUnit(site.id, zone.id, unit.id, { name: e.target.value })}
                                                    className="text-sm"
                                                  />
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => generateRisksForElement('Unité', unit.id, unit.name, { siteId: site.id, zoneId: zone.id })}
                                                      disabled={generatingFor === unit.id || !unit.name}
                                                    >
                                                      {generatingFor === unit.id ? (
                                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                      ) : (
                                                        <Sparkles className="h-3 w-3 mr-1" />
                                                      )}
                                                      Risques
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => addActivity(site.id, zone.id, unit.id)}
                                                    >
                                                      <ActivityIcon className="h-3 w-3 mr-1" />
                                                      + Activité
                                                    </Button>
                                                  </div>

                                                  {unit.activities.length > 0 && (
                                                    <div className="pl-4 border-l space-y-1 mt-2">
                                                      {unit.activities.map((activity, actIndex) => (
                                                        <div key={activity.id} className="flex items-center gap-2 py-1">
                                                          <ActivityIcon className="h-3 w-3 text-orange-500" />
                                                          <Input
                                                            placeholder="Activité (ex: Soudage à l'arc...)"
                                                            value={activity.name}
                                                            onChange={(e) => updateActivity(site.id, zone.id, unit.id, activity.id, { name: e.target.value })}
                                                            className="text-xs h-8 flex-1"
                                                          />
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => generateRisksForElement('Activité', activity.id, activity.name, { siteId: site.id, zoneId: zone.id, unitId: unit.id })}
                                                            disabled={generatingFor === activity.id || !activity.name}
                                                            className="h-8 px-2"
                                                          >
                                                            {generatingFor === activity.id ? (
                                                              <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                              <Sparkles className="h-3 w-3" />
                                                            )}
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeActivity(site.id, zone.id, unit.id, activity.id)}
                                                            className="h-8 px-2"
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
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
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}

              <Button onClick={addSite} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un site
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button onClick={onSave}>
          Sauvegarder
        </Button>
      </div>

      {pendingRisks && (
        <RiskValidationModal
          risks={pendingRisks.risks}
          onValidate={handleValidateRisks}
          onCancel={() => setPendingRisks(null)}
          elementName={pendingRisks.elementName}
          level={pendingRisks.level}
        />
      )}
    </div>
  );
}
