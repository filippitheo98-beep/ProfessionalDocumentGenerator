import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  Loader2,
  Eye,
  FolderTree,
  Table
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

interface TreeSelection {
  type: 'all' | 'site' | 'zone' | 'unit' | 'activity';
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
  path: TreeSelection;
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
  const [selection, setSelection] = useState<TreeSelection>({ type: 'all' });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [pendingRisks, setPendingRisks] = useState<{
    risks: Risk[];
    elementId: string;
    elementName: string;
    level: string;
    path: TreeSelection;
  } | null>(null);
  const [selectedPendingRisks, setSelectedPendingRisks] = useState<Set<string>>(new Set());
  const [reviewingRisk, setReviewingRisk] = useState<TableRisk | null>(null);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const allRisks = useMemo((): TableRisk[] => {
    const risks: TableRisk[] = [];
    for (const site of sites) {
      for (const risk of (site.risks || []).filter(r => r.isValidated)) {
        risks.push({ risk, siteName: site.name, path: { type: 'site', siteId: site.id }, level: 'Site' });
      }
      for (const zone of site.zones || []) {
        for (const risk of (zone.risks || []).filter(r => r.isValidated)) {
          risks.push({ risk, siteName: site.name, zoneName: zone.name, path: { type: 'zone', siteId: site.id, zoneId: zone.id }, level: 'Zone' });
        }
        for (const unit of zone.workUnits || []) {
          for (const risk of (unit.risks || []).filter(r => r.isValidated)) {
            risks.push({ risk, siteName: site.name, zoneName: zone.name, unitName: unit.name, path: { type: 'unit', siteId: site.id, zoneId: zone.id, unitId: unit.id }, level: 'Unité' });
          }
          for (const activity of unit.activities || []) {
            for (const risk of (activity.risks || []).filter(r => r.isValidated)) {
              risks.push({ risk, siteName: site.name, zoneName: zone.name, unitName: unit.name, activityName: activity.name, path: { type: 'activity', siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id }, level: 'Activité' });
            }
          }
        }
      }
    }
    return risks;
  }, [sites]);

  const filteredRisks = useMemo(() => {
    if (selection.type === 'all') return allRisks;
    return allRisks.filter(r => {
      if (selection.type === 'activity') return r.path.activityId === selection.activityId;
      if (selection.type === 'unit') return r.path.unitId === selection.unitId;
      if (selection.type === 'zone') return r.path.zoneId === selection.zoneId;
      return r.path.siteId === selection.siteId;
    });
  }, [allRisks, selection]);

  const getSelectionLabel = () => {
    if (selection.type === 'all') return 'Tous les sites';
    const site = sites.find(s => s.id === selection.siteId);
    if (selection.type === 'site') return site?.name || '';
    const zone = site?.zones.find(z => z.id === selection.zoneId);
    if (selection.type === 'zone') return `${site?.name} > ${zone?.name}`;
    const unit = zone?.workUnits.find(u => u.id === selection.unitId);
    if (selection.type === 'unit') return `${site?.name} > ${zone?.name} > ${unit?.name}`;
    const activity = unit?.activities.find(a => a.id === selection.activityId);
    return `${site?.name} > ${zone?.name} > ${unit?.name} > ${activity?.name}`;
  };

  const updateSite = (siteId: string, updates: Partial<Site>) => {
    onUpdateSites(sites.map(s => s.id === siteId ? { ...s, ...updates } : s));
  };

  const updateZone = (siteId: string, zoneId: string, updates: Partial<WorkZone>) => {
    const site = sites.find(s => s.id === siteId);
    if (site) updateSite(siteId, { zones: site.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z) });
  };

  const updateUnit = (siteId: string, zoneId: string, unitId: string, updates: Partial<WorkUnit>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (zone) updateZone(siteId, zoneId, { workUnits: zone.workUnits.map(u => u.id === unitId ? { ...u, ...updates } : u) });
  };

  const updateActivity = (siteId: string, zoneId: string, unitId: string, actId: string, updates: Partial<Activity>) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (unit) updateUnit(siteId, zoneId, unitId, { activities: unit.activities.map(a => a.id === actId ? { ...a, ...updates } : a) });
  };

  const addSite = () => {
    const id = crypto.randomUUID();
    onUpdateSites([...sites, { id, name: 'Nouveau site', priority: 'Principal', companyId, zones: [], risks: [], preventionMeasures: [], order: sites.length }]);
    setExpandedNodes(prev => new Set(Array.from(prev).concat(id)));
    setEditingNode(id);
  };

  const addZone = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const id = crypto.randomUUID();
    updateSite(siteId, { zones: [...site.zones, { id, name: 'Nouvelle zone', siteId, workUnits: [], risks: [], preventionMeasures: [], order: site.zones.length }] });
    setExpandedNodes(prev => new Set(Array.from(prev).concat([siteId, id])));
    setEditingNode(id);
  };

  const addUnit = (siteId: string, zoneId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    if (!zone) return;
    const id = crypto.randomUUID();
    updateZone(siteId, zoneId, { workUnits: [...zone.workUnits, { id, name: 'Nouvelle unité', zoneId, activities: [], risks: [], preventionMeasures: [], order: zone.workUnits.length }] });
    setExpandedNodes(prev => new Set(Array.from(prev).concat([zoneId, id])));
    setEditingNode(id);
  };

  const addActivity = (siteId: string, zoneId: string, unitId: string) => {
    const site = sites.find(s => s.id === siteId);
    const zone = site?.zones.find(z => z.id === zoneId);
    const unit = zone?.workUnits.find(u => u.id === unitId);
    if (!unit) return;
    const id = crypto.randomUUID();
    updateUnit(siteId, zoneId, unitId, { activities: [...unit.activities, { id, name: 'Nouvelle activité', workUnitId: unitId, risks: [], preventionMeasures: [], order: unit.activities.length }] });
    setExpandedNodes(prev => new Set(Array.from(prev).concat(unitId)));
    setEditingNode(id);
  };

  const removeSite = (id: string) => { onUpdateSites(sites.filter(s => s.id !== id)); if (selection.siteId === id) setSelection({ type: 'all' }); };
  const removeZone = (siteId: string, id: string) => { const site = sites.find(s => s.id === siteId); if (site) updateSite(siteId, { zones: site.zones.filter(z => z.id !== id) }); if (selection.zoneId === id) setSelection({ type: 'site', siteId }); };
  const removeUnit = (siteId: string, zoneId: string, id: string) => { const site = sites.find(s => s.id === siteId); const zone = site?.zones.find(z => z.id === zoneId); if (zone) updateZone(siteId, zoneId, { workUnits: zone.workUnits.filter(u => u.id !== id) }); if (selection.unitId === id) setSelection({ type: 'zone', siteId, zoneId }); };
  const removeActivity = (siteId: string, zoneId: string, unitId: string, id: string) => { const site = sites.find(s => s.id === siteId); const zone = site?.zones.find(z => z.id === zoneId); const unit = zone?.workUnits.find(u => u.id === unitId); if (unit) updateUnit(siteId, zoneId, unitId, { activities: unit.activities.filter(a => a.id !== id) }); if (selection.activityId === id) setSelection({ type: 'unit', siteId, zoneId, unitId }); };

  const countRisks = (path: TreeSelection): number => {
    return allRisks.filter(r => {
      if (path.type === 'activity') return r.path.activityId === path.activityId;
      if (path.type === 'unit') return r.path.unitId === path.unitId;
      if (path.type === 'zone') return r.path.zoneId === path.zoneId;
      if (path.type === 'site') return r.path.siteId === path.siteId;
      return true;
    }).length;
  };

  const generateRisks = async (level: 'Site' | 'Zone' | 'Unité' | 'Activité', elementId: string, elementName: string, path: TreeSelection) => {
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
    else if (level === 'Unité' && path.siteId && path.zoneId) updateUnit(path.siteId, path.zoneId, elementId, { risks: mergedRisks });
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
    else if (level === 'Unité' && path.unitId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); const unit = zone?.workUnits.find(u => u.id === path.unitId); if (unit) updateUnit(path.siteId!, path.zoneId!, path.unitId, { risks: removeFromArray(unit.risks || []) }); }
    else if (level === 'Activité' && path.activityId) { const site = sites.find(s => s.id === path.siteId); const zone = site?.zones.find(z => z.id === path.zoneId); const unit = zone?.workUnits.find(u => u.id === path.unitId); const activity = unit?.activities.find(a => a.id === path.activityId); if (activity) updateActivity(path.siteId!, path.zoneId!, path.unitId!, path.activityId, { risks: removeFromArray(activity.risks || []) }); }
    toast({ title: "Risque retiré" });
  };

  const TreeNode = ({ icon: Icon, iconColor, label, nodeId, isSelected, onSelect, onToggle, isExpanded, hasChildren, onAdd, onRemove, onGenerate, isGenerating, riskCount, depth = 0 }: {
    icon: any; iconColor: string; label: string; nodeId: string; isSelected: boolean; onSelect: () => void; onToggle: () => void; isExpanded: boolean; hasChildren: boolean; onAdd?: () => void; onRemove: () => void; onGenerate: () => void; isGenerating: boolean; riskCount: number; depth?: number;
  }) => (
    <div className={`group flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`} style={{ paddingLeft: `${depth * 12 + 8}px` }}>
      {hasChildren ? (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 hover:bg-muted rounded">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : <span className="w-4" />}
      <Icon className={`h-3.5 w-3.5 ${iconColor} flex-shrink-0`} />
      {editingNode === nodeId ? (
        <Input autoFocus value={label} onChange={(e) => {
          const site = sites.find(s => s.id === nodeId);
          if (site) { updateSite(nodeId, { name: e.target.value }); return; }
          for (const s of sites) {
            const zone = s.zones.find(z => z.id === nodeId);
            if (zone) { updateZone(s.id, nodeId, { name: e.target.value }); return; }
            for (const z of s.zones) {
              const unit = z.workUnits.find(u => u.id === nodeId);
              if (unit) { updateUnit(s.id, z.id, nodeId, { name: e.target.value }); return; }
              for (const u of z.workUnits) {
                const act = u.activities.find(a => a.id === nodeId);
                if (act) { updateActivity(s.id, z.id, u.id, nodeId, { name: e.target.value }); return; }
              }
            }
          }
        }} onBlur={() => setEditingNode(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)} className="h-5 text-xs flex-1 min-w-0" />
      ) : (
        <span className="text-xs flex-1 truncate" onClick={onSelect} onDoubleClick={() => setEditingNode(nodeId)}>{label}</span>
      )}
      {riskCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{riskCount}</Badge>}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onGenerate(); }} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
        </Button>
        {onAdd && <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onAdd(); }}><Plus className="h-3 w-3" /></Button>}
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Évaluation des Risques Professionnels</h2>
            <p className="text-blue-100 text-sm mt-1">Document Unique - Tableau conforme INRS</p>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white text-sm">{allRisks.length} risque(s) évalué(s)</Badge>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[600px]">
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="py-2 px-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Arborescence
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addSite}>
                <Plus className="h-3 w-3 mr-1" />Site
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-0.5">
                <div className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 ${selection.type === 'all' ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`} onClick={() => setSelection({ type: 'all' })}>
                  <Building2 className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-medium">Tous les sites</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-auto">{allRisks.length}</Badge>
                </div>

                {sites.map(site => (
                  <div key={site.id}>
                    <TreeNode
                      icon={MapPin} iconColor="text-blue-600" label={site.name} nodeId={site.id}
                      isSelected={selection.type === 'site' && selection.siteId === site.id}
                      onSelect={() => setSelection({ type: 'site', siteId: site.id })}
                      onToggle={() => toggleNode(site.id)}
                      isExpanded={expandedNodes.has(site.id)}
                      hasChildren={site.zones.length > 0}
                      onAdd={() => addZone(site.id)}
                      onRemove={() => removeSite(site.id)}
                      onGenerate={() => generateRisks('Site', site.id, site.name, { type: 'site', siteId: site.id })}
                      isGenerating={generatingFor === site.id}
                      riskCount={countRisks({ type: 'site', siteId: site.id })}
                      depth={0}
                    />
                    {expandedNodes.has(site.id) && site.zones.map(zone => (
                      <div key={zone.id}>
                        <TreeNode
                          icon={Layers} iconColor="text-green-600" label={zone.name} nodeId={zone.id}
                          isSelected={selection.type === 'zone' && selection.zoneId === zone.id}
                          onSelect={() => setSelection({ type: 'zone', siteId: site.id, zoneId: zone.id })}
                          onToggle={() => toggleNode(zone.id)}
                          isExpanded={expandedNodes.has(zone.id)}
                          hasChildren={zone.workUnits.length > 0}
                          onAdd={() => addUnit(site.id, zone.id)}
                          onRemove={() => removeZone(site.id, zone.id)}
                          onGenerate={() => generateRisks('Zone', zone.id, zone.name, { type: 'zone', siteId: site.id, zoneId: zone.id })}
                          isGenerating={generatingFor === zone.id}
                          riskCount={countRisks({ type: 'zone', siteId: site.id, zoneId: zone.id })}
                          depth={1}
                        />
                        {expandedNodes.has(zone.id) && zone.workUnits.map(unit => (
                          <div key={unit.id}>
                            <TreeNode
                              icon={Users} iconColor="text-purple-600" label={unit.name} nodeId={unit.id}
                              isSelected={selection.type === 'unit' && selection.unitId === unit.id}
                              onSelect={() => setSelection({ type: 'unit', siteId: site.id, zoneId: zone.id, unitId: unit.id })}
                              onToggle={() => toggleNode(unit.id)}
                              isExpanded={expandedNodes.has(unit.id)}
                              hasChildren={unit.activities.length > 0}
                              onAdd={() => addActivity(site.id, zone.id, unit.id)}
                              onRemove={() => removeUnit(site.id, zone.id, unit.id)}
                              onGenerate={() => generateRisks('Unité', unit.id, unit.name, { type: 'unit', siteId: site.id, zoneId: zone.id, unitId: unit.id })}
                              isGenerating={generatingFor === unit.id}
                              riskCount={countRisks({ type: 'unit', siteId: site.id, zoneId: zone.id, unitId: unit.id })}
                              depth={2}
                            />
                            {expandedNodes.has(unit.id) && unit.activities.map(activity => (
                              <TreeNode
                                key={activity.id}
                                icon={ActivityIcon} iconColor="text-orange-500" label={activity.name} nodeId={activity.id}
                                isSelected={selection.type === 'activity' && selection.activityId === activity.id}
                                onSelect={() => setSelection({ type: 'activity', siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id })}
                                onToggle={() => {}}
                                isExpanded={false}
                                hasChildren={false}
                                onRemove={() => removeActivity(site.id, zone.id, unit.id, activity.id)}
                                onGenerate={() => generateRisks('Activité', activity.id, activity.name, { type: 'activity', siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id })}
                                isGenerating={generatingFor === activity.id}
                                riskCount={countRisks({ type: 'activity', siteId: site.id, zoneId: zone.id, unitId: unit.id, activityId: activity.id })}
                                depth={3}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {sites.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Cliquez sur "+ Site" pour commencer</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="col-span-9 flex flex-col">
          <CardHeader className="py-2 px-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Table className="h-4 w-4" />
                {getSelectionLabel()}
              </CardTitle>
              <Badge variant="secondary">{filteredRisks.length} risque(s)</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2 font-semibold border-b w-[140px]">Localisation</th>
                    <th className="text-left p-2 font-semibold border-b w-[100px]">Famille de risque</th>
                    <th className="text-left p-2 font-semibold border-b">Situation d'exposition</th>
                    <th className="text-center p-2 font-semibold border-b w-[35px]">G</th>
                    <th className="text-center p-2 font-semibold border-b w-[35px]">F</th>
                    <th className="text-center p-2 font-semibold border-b w-[35px]">M</th>
                    <th className="text-center p-2 font-semibold border-b w-[45px]">Score</th>
                    <th className="text-left p-2 font-semibold border-b w-[200px]">Mesures de prévention</th>
                    <th className="text-center p-2 font-semibold border-b w-[70px]">Priorité</th>
                    <th className="text-center p-2 font-semibold border-b w-[50px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-muted-foreground">
                        <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Aucun risque évalué</p>
                        <p className="text-xs mt-1">Survolez un élément dans l'arborescence et cliquez sur <Sparkles className="h-3 w-3 inline" /></p>
                      </td>
                    </tr>
                  ) : (
                    filteredRisks.map((r) => (
                      <tr key={r.risk.id} className={`${RISK_ROW_COLORS[r.risk.priority || ''] || ''} hover:bg-muted/50 transition-colors`}>
                        <td className="p-2 border-b">
                          <div className="text-xs font-medium">{r.zoneName && `${r.zoneName}`}{r.unitName && ` > ${r.unitName}`}{r.activityName && ` > ${r.activityName}`}</div>
                          <Badge variant="outline" className="text-[8px] mt-0.5">{r.level}</Badge>
                        </td>
                        <td className="p-2 border-b"><Badge variant="secondary" className="text-[9px]">{r.risk.family || r.risk.type || '-'}</Badge></td>
                        <td className="p-2 border-b"><div className="line-clamp-2">{r.risk.danger}</div></td>
                        <td className="p-2 border-b text-center font-mono font-bold">{r.risk.gravityValue || '-'}</td>
                        <td className="p-2 border-b text-center font-mono font-bold">{r.risk.frequencyValue || '-'}</td>
                        <td className="p-2 border-b text-center font-mono font-bold">{r.risk.controlValue || '-'}</td>
                        <td className="p-2 border-b text-center"><span className="font-mono font-bold">{r.risk.riskScore?.toFixed(1) || '-'}</span></td>
                        <td className="p-2 border-b"><div className="line-clamp-2 text-muted-foreground">{r.risk.measures || '-'}</div></td>
                        <td className="p-2 border-b text-center"><Badge className={`text-[8px] ${PRIORITY_BADGE_COLORS[r.risk.priority || ''] || 'bg-gray-500'}`}>{r.risk.priority?.replace('Priorité ', 'P').replace(' (Forte)', '').replace(' (Moyenne)', '').replace(' (Modéré)', '').replace(' (Faible)', '') || '-'}</Badge></td>
                        <td className="p-2 border-b text-center">
                          <div className="flex justify-center gap-0.5">
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setReviewingRisk(r)}><Eye className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeRisk(r)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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
      </div>

      <Dialog open={!!pendingRisks} onOpenChange={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Validation des risques - {pendingRisks?.level}: {pendingRisks?.elementName}</DialogTitle>
            <DialogDescription>Sélectionnez les risques à ajouter au tableau DUERP ({selectedPendingRisks.size}/{pendingRisks?.risks.length || 0})</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
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
