import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RiskLibrarySelector from "@/components/RiskLibrarySelector";
import { 
  Building2, 
  MapPin, 
  Users, 
  Briefcase,
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
  Table,
  Library,
  Wand2
} from "lucide-react";
import type { 
  Site, 
  WorkUnit, 
  Workstation,
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
  type: 'all' | 'site' | 'unit';
  siteId?: string;
  unitId?: string;
}

interface TableRisk {
  risk: Risk;
  siteName: string;
  unitName?: string;
  path: TreeSelection;
  level: 'Site' | 'Unité';
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
  const [librarySelector, setLibrarySelector] = useState<{
    isOpen: boolean;
    level: 'Site' | 'Unité';
    elementId: string;
    elementName: string;
    path: TreeSelection;
  } | null>(null);
  const [newWorkstationName, setNewWorkstationName] = useState<Record<string, string>>({});
  const [groupingFor, setGroupingFor] = useState<string | null>(null);

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
      for (const risk of (site.risks || [])) {
        risks.push({ risk, siteName: site.name, path: { type: 'site', siteId: site.id }, level: 'Site' });
      }
      for (const unit of site.workUnits || []) {
        for (const risk of (unit.risks || [])) {
          risks.push({ risk, siteName: site.name, unitName: unit.name, path: { type: 'unit', siteId: site.id, unitId: unit.id }, level: 'Unité' });
        }
      }
    }
    return risks;
  }, [sites]);

  const filteredRisks = useMemo(() => {
    if (selection.type === 'all') return allRisks;
    return allRisks.filter(r => {
      if (selection.type === 'unit') return r.path.unitId === selection.unitId;
      return r.path.siteId === selection.siteId;
    });
  }, [allRisks, selection]);

  const getSelectionLabel = () => {
    if (selection.type === 'all') return 'Tous les sites';
    const site = sites.find(s => s.id === selection.siteId);
    if (selection.type === 'site') return site?.name || '';
    const unit = site?.workUnits.find(u => u.id === selection.unitId);
    return `${site?.name} > ${unit?.name}`;
  };

  const updateSite = (siteId: string, updates: Partial<Site>) => {
    onUpdateSites(sites.map(s => s.id === siteId ? { ...s, ...updates } : s));
  };

  const updateUnit = (siteId: string, unitId: string, updates: Partial<WorkUnit>) => {
    const site = sites.find(s => s.id === siteId);
    if (site) updateSite(siteId, { workUnits: site.workUnits.map(u => u.id === unitId ? { ...u, ...updates } : u) });
  };

  const addSite = () => {
    const id = crypto.randomUUID();
    onUpdateSites([...sites, { id, name: 'Nouveau site', priority: 'Principal', companyId, workUnits: [], risks: [], preventionMeasures: [], order: sites.length }]);
    setExpandedNodes(prev => new Set(Array.from(prev).concat(id)));
    setEditingNode(id);
  };

  const addWorkUnit = (siteId: string, name?: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const id = crypto.randomUUID();
    updateSite(siteId, { workUnits: [...site.workUnits, { id, name: name || 'Nouvelle unité', siteId, workstations: [], risks: [], preventionMeasures: [], order: site.workUnits.length }] });
    setExpandedNodes(prev => new Set(Array.from(prev).concat([siteId, id])));
    if (!name) setEditingNode(id);
    return id;
  };

  const addWorkstation = (siteId: string, unitId: string) => {
    const key = `${siteId}-${unitId}`;
    const name = newWorkstationName[key]?.trim();
    if (!name) return;
    const site = sites.find(s => s.id === siteId);
    const unit = site?.workUnits.find(u => u.id === unitId);
    if (!unit) return;
    const id = crypto.randomUUID();
    updateUnit(siteId, unitId, { workstations: [...unit.workstations, { id, name, order: unit.workstations.length }] });
    setNewWorkstationName(prev => ({ ...prev, [key]: '' }));
  };

  const removeWorkstation = (siteId: string, unitId: string, wsId: string) => {
    const site = sites.find(s => s.id === siteId);
    const unit = site?.workUnits.find(u => u.id === unitId);
    if (unit) updateUnit(siteId, unitId, { workstations: unit.workstations.filter(w => w.id !== wsId) });
  };

  const removeSite = (id: string) => { onUpdateSites(sites.filter(s => s.id !== id)); if (selection.siteId === id) setSelection({ type: 'all' }); };
  const removeUnit = (siteId: string, id: string) => { const site = sites.find(s => s.id === siteId); if (site) updateSite(siteId, { workUnits: site.workUnits.filter(u => u.id !== id) }); if (selection.unitId === id) setSelection({ type: 'site', siteId }); };

  const countRisks = (path: TreeSelection): number => {
    return allRisks.filter(r => {
      if (path.type === 'unit') return r.path.unitId === path.unitId;
      if (path.type === 'site') return r.path.siteId === path.siteId;
      return true;
    }).length;
  };

  const generateRisks = async (level: 'Site' | 'Unité', elementId: string, elementName: string, path: TreeSelection) => {
    if (!elementName.trim()) { toast({ title: "Nom requis", variant: "destructive" }); return; }
    setGeneratingFor(elementId);
    try {
      const site = path.siteId ? sites.find(s => s.id === path.siteId) : undefined;
      const unit = site?.workUnits.find(u => u.id === elementId);
      const workstationNames = unit?.workstations?.map(w => w.name) || [];
      const response = await apiRequest('/api/generate-hierarchical-risks', {
        method: 'POST',
        body: JSON.stringify({ level, elementName, companyActivity, companyDescription, companyId, siteName: site?.name, workstationNames }),
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

  const groupWorkstationsWithAI = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    
    const allWorkstations: string[] = [];
    for (const unit of site.workUnits) {
      for (const ws of unit.workstations) {
        allWorkstations.push(ws.name);
      }
    }
    
    if (allWorkstations.length === 0) {
      toast({ title: "Ajoutez d'abord des postes de travail", variant: "destructive" });
      return;
    }

    setGroupingFor(siteId);
    try {
      const response = await apiRequest('/api/group-workstations', {
        method: 'POST',
        body: JSON.stringify({ workstations: allWorkstations, companyActivity, companyDescription, siteName: site.name }),
      });

      if (response.groups?.length > 0) {
        const newUnits: WorkUnit[] = response.groups.map((group: { name: string; workstations: string[] }, idx: number) => ({
          id: crypto.randomUUID(),
          name: group.name,
          siteId,
          workstations: group.workstations.map((wsName: string, wsIdx: number) => ({
            id: crypto.randomUUID(),
            name: wsName,
            order: wsIdx
          })),
          risks: [],
          preventionMeasures: [],
          order: idx,
        }));
        updateSite(siteId, { workUnits: newUnits });
        setExpandedNodes(prev => {
          const next = new Set(prev);
          next.add(siteId);
          newUnits.forEach((u: WorkUnit) => next.add(u.id));
          return next;
        });
        toast({ title: `${newUnits.length} unité(s) de travail créée(s)`, description: `${allWorkstations.length} postes regroupés intelligemment` });
      }
    } catch (error) {
      toast({ title: "Erreur lors du regroupement", variant: "destructive" });
    } finally {
      setGroupingFor(null);
    }
  };

  const validateSelectedRisks = () => {
    if (!pendingRisks) return;
    const { level, path, elementId } = pendingRisks;
    const validatedRisks = pendingRisks.risks.filter(r => selectedPendingRisks.has(r.id)).map(r => ({ ...r, isValidated: true }));

    const getCurrentRisks = (): Risk[] => {
      if (level === 'Site') return sites.find(s => s.id === elementId)?.risks || [];
      if (level === 'Unité' && path.siteId) { const site = sites.find(s => s.id === path.siteId); return site?.workUnits.find(u => u.id === elementId)?.risks || []; }
      return [];
    };

    const existingRisks = getCurrentRisks().filter(r => r.isValidated);
    const mergedRisks = [...existingRisks, ...validatedRisks];

    if (level === 'Site') updateSite(elementId, { risks: mergedRisks });
    else if (level === 'Unité' && path.siteId) updateUnit(path.siteId, elementId, { risks: mergedRisks });

    toast({ title: `${validatedRisks.length} risque(s) ajouté(s)` });
    setPendingRisks(null);
    setSelectedPendingRisks(new Set());
  };

  const removeRisk = (tableRisk: TableRisk) => {
    const { risk, path, level } = tableRisk;
    const removeFromArray = (risks: Risk[]) => risks.filter(r => r.id !== risk.id);
    if (level === 'Site') { const site = sites.find(s => s.id === path.siteId); if (site) updateSite(path.siteId!, { risks: removeFromArray(site.risks || []) }); }
    else if (level === 'Unité' && path.unitId) { const site = sites.find(s => s.id === path.siteId); const unit = site?.workUnits.find(u => u.id === path.unitId); if (unit) updateUnit(path.siteId!, path.unitId, { risks: removeFromArray(unit.risks || []) }); }
    toast({ title: "Risque retiré" });
  };

  const validateSingleRisk = (tableRisk: TableRisk) => {
    const { risk, path, level } = tableRisk;
    const validateInArray = (risks: Risk[]) => risks.map(r => r.id === risk.id ? { ...r, isValidated: true } : r);
    if (level === 'Site') { const site = sites.find(s => s.id === path.siteId); if (site) updateSite(path.siteId!, { risks: validateInArray(site.risks || []) }); }
    else if (level === 'Unité' && path.unitId) { const site = sites.find(s => s.id === path.siteId); const unit = site?.workUnits.find(u => u.id === path.unitId); if (unit) updateUnit(path.siteId!, path.unitId, { risks: validateInArray(unit.risks || []) }); }
    toast({ title: "Risque validé" });
  };

  const openLibrary = (level: 'Site' | 'Unité', elementId: string, elementName: string, path: TreeSelection) => {
    setLibrarySelector({ isOpen: true, level, elementId, elementName, path });
  };

  const handleLibraryRisksSelected = (risks: Risk[]) => {
    if (!librarySelector) return;
    const { level, elementId, path } = librarySelector;
    
    const getCurrentRisks = (): Risk[] => {
      if (level === 'Site') return sites.find(s => s.id === elementId)?.risks || [];
      if (level === 'Unité' && path.siteId) { const site = sites.find(s => s.id === path.siteId); return site?.workUnits.find(u => u.id === elementId)?.risks || []; }
      return [];
    };
    
    const existingRisks = getCurrentRisks();
    const existingCatalogIds = new Set(existingRisks.map((r: any) => r.catalogId).filter(Boolean));
    const existingDangers = new Set(existingRisks.map(r => r.danger.toLowerCase().trim()));
    
    const newRisks = risks.filter((r: any) => {
      const hasCatalogId = r.catalogId && existingCatalogIds.has(r.catalogId);
      const hasDuplicate = existingDangers.has(r.danger.toLowerCase().trim());
      return !hasCatalogId && !hasDuplicate;
    });
    
    const duplicateCount = risks.length - newRisks.length;
    const mergedRisks = [...existingRisks, ...newRisks];
    
    if (level === 'Site') updateSite(elementId, { risks: mergedRisks });
    else if (level === 'Unité' && path.siteId) updateUnit(path.siteId, elementId, { risks: mergedRisks });
    
    const message = duplicateCount > 0 
      ? `${newRisks.length} risque(s) ajouté(s), ${duplicateCount} doublon(s) ignoré(s)`
      : `${newRisks.length} risque(s) ajouté(s) depuis la bibliothèque`;
    toast({ title: message, description: newRisks.length > 0 ? "Les risques sont en attente de validation." : undefined });
    setLibrarySelector(null);
  };

  const TreeNode = ({ icon: Icon, iconColor, label, nodeId, isSelected, onSelect, onToggle, isExpanded, hasChildren, onAdd, onRemove, onGenerate, onOpenLibrary, isGenerating, riskCount, depth = 0, workstationCount }: {
    icon: any; iconColor: string; label: string; nodeId: string; isSelected: boolean; onSelect: () => void; onToggle: () => void; isExpanded: boolean; hasChildren: boolean; onAdd?: () => void; onRemove: () => void; onGenerate: () => void; onOpenLibrary: () => void; isGenerating: boolean; riskCount: number; depth?: number; workstationCount?: number;
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
            const unit = s.workUnits.find(u => u.id === nodeId);
            if (unit) { updateUnit(s.id, nodeId, { name: e.target.value }); return; }
          }
        }} onBlur={() => setEditingNode(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)} className="h-5 text-xs flex-1 min-w-0" />
      ) : (
        <span className="text-xs flex-1 truncate" onClick={onSelect} onDoubleClick={() => setEditingNode(nodeId)}>{label}</span>
      )}
      {workstationCount !== undefined && workstationCount > 0 && <Badge variant="outline" className="text-[8px] h-4 px-1 border-blue-300 text-blue-600">{workstationCount} postes</Badge>}
      {riskCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{riskCount}</Badge>}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onOpenLibrary(); }} title="Bibliothèque INRS">
          <Library className="h-3 w-3 text-blue-600" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onGenerate(); }} disabled={isGenerating} title="Générer avec IA">
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

      <div className="grid grid-cols-12 gap-4 h-[650px]">
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="py-2 px-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Structure
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
                      hasChildren={(site.workUnits || []).length > 0}
                      onAdd={() => addWorkUnit(site.id)}
                      onRemove={() => removeSite(site.id)}
                      onGenerate={() => generateRisks('Site', site.id, site.name, { type: 'site', siteId: site.id })}
                      onOpenLibrary={() => openLibrary('Site', site.id, site.name, { type: 'site', siteId: site.id })}
                      isGenerating={generatingFor === site.id}
                      riskCount={countRisks({ type: 'site', siteId: site.id })}
                      depth={0}
                    />
                    {expandedNodes.has(site.id) && (site.workUnits || []).map(unit => (
                      <div key={unit.id}>
                        <TreeNode
                          icon={Users} iconColor="text-purple-600" label={unit.name} nodeId={unit.id}
                          isSelected={selection.type === 'unit' && selection.unitId === unit.id}
                          onSelect={() => setSelection({ type: 'unit', siteId: site.id, unitId: unit.id })}
                          onToggle={() => toggleNode(unit.id)}
                          isExpanded={expandedNodes.has(unit.id)}
                          hasChildren={(unit.workstations || []).length > 0}
                          onRemove={() => removeUnit(site.id, unit.id)}
                          onGenerate={() => generateRisks('Unité', unit.id, unit.name, { type: 'unit', siteId: site.id, unitId: unit.id })}
                          onOpenLibrary={() => openLibrary('Unité', unit.id, unit.name, { type: 'unit', siteId: site.id, unitId: unit.id })}
                          isGenerating={generatingFor === unit.id}
                          riskCount={countRisks({ type: 'unit', siteId: site.id, unitId: unit.id })}
                          workstationCount={(unit.workstations || []).length}
                          depth={1}
                        />
                        {expandedNodes.has(unit.id) && (unit.workstations || []).map(ws => (
                          <div key={ws.id} className="flex items-center gap-1 py-0.5 group" style={{ paddingLeft: '44px' }}>
                            <Briefcase className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate flex-1">{ws.name}</span>
                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hidden group-hover:flex" onClick={() => removeWorkstation(site.id, unit.id, ws.id)}>
                              <X className="h-2.5 w-2.5 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        {expandedNodes.has(unit.id) && (
                          <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: '44px' }}>
                            <Input
                              placeholder="+ Ajouter un poste..."
                              value={newWorkstationName[`${site.id}-${unit.id}`] || ''}
                              onChange={(e) => setNewWorkstationName(prev => ({ ...prev, [`${site.id}-${unit.id}`]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addWorkstation(site.id, unit.id)}
                              className="h-5 text-[10px] flex-1 min-w-0 border-dashed"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {expandedNodes.has(site.id) && (
                      <div className="pl-6 py-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] w-full border-dashed"
                          onClick={() => groupWorkstationsWithAI(site.id)}
                          disabled={groupingFor === site.id}
                        >
                          {groupingFor === site.id ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Regroupement...</>
                          ) : (
                            <><Wand2 className="h-3 w-3 mr-1" />Regrouper les postes en unités</>
                          )}
                        </Button>
                      </div>
                    )}
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
                    <th className="text-left p-2 font-semibold border-b w-[140px]">Unité de travail</th>
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
                      <tr key={r.risk.id} className={`${r.risk.isValidated ? RISK_ROW_COLORS[r.risk.priority || ''] || '' : 'bg-amber-50 dark:bg-amber-950/30 border-l-2 border-l-amber-400'} hover:bg-muted/50 transition-colors`}>
                        <td className="p-2 border-b">
                          <div className="text-xs font-medium">{r.unitName || r.siteName}</div>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[8px]">{r.level}</Badge>
                            {!r.risk.isValidated && <Badge variant="outline" className="text-[8px] border-amber-400 text-amber-600 dark:text-amber-400">En attente</Badge>}
                          </div>
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
                            {!r.risk.isValidated && (
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-green-600 hover:text-green-700" onClick={() => validateSingleRisk(r)} title="Valider ce risque"><Check className="h-3 w-3" /></Button>
                            )}
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
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Validation des risques - {pendingRisks?.level}: {pendingRisks?.elementName}</DialogTitle>
            <DialogDescription>Sélectionnez les risques à ajouter au tableau DUERP ({selectedPendingRisks.size}/{pendingRisks?.risks.length || 0})</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 pr-2" style={{ maxHeight: 'calc(85vh - 160px)' }}>
            <div className="space-y-2 pb-2">
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
          </div>
          <DialogFooter className="border-t pt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}><X className="h-4 w-4 mr-2" />Annuler</Button>
            <Button onClick={validateSelectedRisks} disabled={selectedPendingRisks.size === 0}><Check className="h-4 w-4 mr-2" />Valider ({selectedPendingRisks.size})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewingRisk} onOpenChange={() => setReviewingRisk(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du risque</DialogTitle>
            <DialogDescription>{reviewingRisk && `${reviewingRisk.siteName}${reviewingRisk.unitName ? ' > ' + reviewingRisk.unitName : ''}`}</DialogDescription>
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

      {librarySelector && (
        <RiskLibrarySelector
          isOpen={librarySelector.isOpen}
          onClose={() => setLibrarySelector(null)}
          onSelectRisks={handleLibraryRisksSelected}
          hierarchyLevel={librarySelector.level}
          elementName={librarySelector.elementName}
        />
      )}
    </div>
  );
}
