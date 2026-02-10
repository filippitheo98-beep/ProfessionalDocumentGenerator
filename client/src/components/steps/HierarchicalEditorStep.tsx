import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RiskLibrarySelector from "@/components/RiskLibrarySelector";
import {
  Users,
  Sparkles,
  Check,
  Loader2,
  Eye,
  Library,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Filter,
  Wand2,
  X
} from "lucide-react";
import type { WorkUnit, Risk } from "@shared/schema";

interface HierarchicalEditorStepProps {
  companyId: number;
  companyActivity: string;
  companyDescription?: string;
  workUnits: WorkUnit[];
  onUpdateWorkUnits: (units: WorkUnit[]) => void;
  onSave: () => void;
}

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

const PRIORITY_ICONS: Record<string, any> = {
  'Priorité 1 (Forte)': AlertTriangle,
  'Priorité 2 (Moyenne)': AlertCircle,
  'Priorité 3 (Modéré)': Info,
  'Priorité 4 (Faible)': CheckCircle,
};

interface TableRisk {
  risk: Risk;
  unitName: string;
  unitId: string;
}

export default function HierarchicalEditorStep({
  companyId,
  companyActivity,
  companyDescription,
  workUnits,
  onUpdateWorkUnits,
  onSave
}: HierarchicalEditorStepProps) {
  const { toast } = useToast();

  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const [pendingRisks, setPendingRisks] = useState<{
    risks: Risk[];
    unitId: string;
    elementName: string;
  } | null>(null);
  const [selectedPendingRisks, setSelectedPendingRisks] = useState<Set<string>>(new Set());
  const [reviewingRisk, setReviewingRisk] = useState<TableRisk | null>(null);

  const [librarySelector, setLibrarySelector] = useState<{
    isOpen: boolean;
    unitId: string;
    elementName: string;
  } | null>(null);

  const updateUnit = (unitId: string, updates: Partial<WorkUnit>) => {
    onUpdateWorkUnits(workUnits.map(u => u.id === unitId ? { ...u, ...updates } : u));
  };

  const allRisks = useMemo((): TableRisk[] => {
    const risks: TableRisk[] = [];
    for (const unit of workUnits) {
      for (const risk of (unit.risks || [])) {
        risks.push({ risk, unitName: unit.name, unitId: unit.id });
      }
    }
    return risks;
  }, [workUnits]);

  const filteredRisks = useMemo(() => {
    return allRisks.filter(r => {
      if (filterUnit !== 'all' && r.unitId !== filterUnit) return false;
      if (filterPriority !== 'all' && r.risk.priority !== filterPriority) return false;
      return true;
    });
  }, [allRisks, filterUnit, filterPriority]);

  const generateRisks = async (unitId: string) => {
    const unit = workUnits.find(u => u.id === unitId);
    if (!unit) return;

    const workstationNames = unit.workstations?.map(w => w.name) || [];
    const siteNames = (unit.unitSites || []).map(s => s.name);

    setGeneratingFor(unitId);
    try {
      const response = await apiRequest('/api/generate-hierarchical-risks', {
        method: 'POST',
        body: JSON.stringify({
          level: 'Unité',
          elementName: unit.name,
          companyActivity,
          companyDescription,
          companyId,
          workstationNames,
          siteNames,
        }),
      });

      if (response.risks?.length > 0) {
        setPendingRisks({ risks: response.risks, unitId, elementName: unit.name });
        setSelectedPendingRisks(new Set(response.risks.map((r: Risk) => r.id)));
      } else {
        toast({ title: "Aucun risque identifié" });
      }
    } catch (error) {
      toast({ title: "Erreur de génération", variant: "destructive" });
    } finally {
      setGeneratingFor(null);
    }
  };

  const validateSelectedRisks = () => {
    if (!pendingRisks) return;
    const { unitId } = pendingRisks;
    const validatedRisks = pendingRisks.risks
      .filter(r => selectedPendingRisks.has(r.id))
      .map(r => ({ ...r, isValidated: true }));

    const unit = workUnits.find(u => u.id === unitId);
    const existingRisks = unit?.risks?.filter(r => r.isValidated) || [];
    updateUnit(unitId, { risks: [...existingRisks, ...validatedRisks] });

    toast({ title: `${validatedRisks.length} risque(s) ajouté(s)` });
    setPendingRisks(null);
    setSelectedPendingRisks(new Set());
  };

  const removeRisk = (tableRisk: TableRisk) => {
    const { risk, unitId } = tableRisk;
    const unit = workUnits.find(u => u.id === unitId);
    if (unit) updateUnit(unitId, { risks: (unit.risks || []).filter(r => r.id !== risk.id) });
  };

  const openLibrary = (unitId: string) => {
    const unit = workUnits.find(u => u.id === unitId);
    if (!unit) return;
    setLibrarySelector({ isOpen: true, unitId, elementName: unit.name });
  };

  const handleLibraryRisksSelected = (risks: Risk[]) => {
    if (!librarySelector) return;
    const { unitId } = librarySelector;
    const unit = workUnits.find(u => u.id === unitId);
    const existingRisks = unit?.risks || [];
    const existingDangers = new Set(existingRisks.map(r => r.danger.toLowerCase().trim()));
    const newRisks = risks.filter(r => !existingDangers.has(r.danger.toLowerCase().trim()));
    updateUnit(unitId, { risks: [...existingRisks, ...newRisks] });

    const duplicates = risks.length - newRisks.length;
    toast({
      title: duplicates > 0
        ? `${newRisks.length} ajouté(s), ${duplicates} doublon(s) ignoré(s)`
        : `${newRisks.length} risque(s) ajouté(s)`
    });
    setLibrarySelector(null);
  };

  const validatedCount = allRisks.filter(r => r.risk.isValidated).length;
  const pendingCount = allRisks.filter(r => !r.risk.isValidated).length;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Tableau des Risques Professionnels</h2>
            <p className="text-blue-100 text-sm mt-1">Générez, validez et gérez les risques par unité de travail</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              <CheckCircle className="h-3 w-3 mr-1" />{validatedCount} validé(s)
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/30 text-white">
                {pendingCount} en attente
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Générer des risques
            </CardTitle>
            <div className="flex flex-wrap gap-2 flex-1">
              {workUnits.map(unit => (
                <Button
                  key={unit.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => generateRisks(unit.id)}
                  disabled={generatingFor === unit.id}
                >
                  {generatingFor === unit.id ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {unit.name}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {workUnits.map(unit => (
                <Button
                  key={`lib-${unit.id}`}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openLibrary(unit.id)}
                >
                  <Library className="h-3 w-3 mr-1" />
                  {unit.name}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Toutes les unités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les unités</SelectItem>
                {workUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Toutes priorités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                <SelectItem value="Priorité 1 (Forte)">Priorité 1 (Forte)</SelectItem>
                <SelectItem value="Priorité 2 (Moyenne)">Priorité 2 (Moyenne)</SelectItem>
                <SelectItem value="Priorité 3 (Modéré)">Priorité 3 (Modéré)</SelectItem>
                <SelectItem value="Priorité 4 (Faible)">Priorité 4 (Faible)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredRisks.length} risque(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRisks.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucun risque. Utilisez les boutons ci-dessus pour générer des risques avec l'IA ou depuis la bibliothèque.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px] text-center text-xs">Statut</TableHead>
                    <TableHead className="w-[160px] text-xs">Unité de travail</TableHead>
                    <TableHead className="w-[100px] text-xs">Famille</TableHead>
                    <TableHead className="w-[140px] text-xs">Situation</TableHead>
                    <TableHead className="text-xs">Danger identifié</TableHead>
                    <TableHead className="w-[50px] text-center text-xs">G</TableHead>
                    <TableHead className="w-[50px] text-center text-xs">F</TableHead>
                    <TableHead className="w-[50px] text-center text-xs">M</TableHead>
                    <TableHead className="w-[110px] text-xs">Priorité</TableHead>
                    <TableHead className="text-xs max-w-[200px]">Mesures</TableHead>
                    <TableHead className="w-[80px] text-center text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.map((tr) => {
                    const PIcon = PRIORITY_ICONS[tr.risk.priority] || Info;
                    return (
                      <TableRow key={tr.risk.id} className={`${RISK_ROW_COLORS[tr.risk.priority] || ''} hover:bg-muted/40`}>
                        <TableCell className="text-center">
                          {tr.risk.isValidated ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <Badge variant="outline" className="text-[9px]">En attente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-purple-500 flex-shrink-0" />
                            <span className="font-medium truncate">{tr.unitName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{tr.risk.family || 'Autre'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{tr.risk.type}</TableCell>
                        <TableCell className="text-xs">{tr.risk.danger}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{tr.risk.gravityValue}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{tr.risk.frequencyValue}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{tr.risk.controlValue}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${PRIORITY_BADGE_COLORS[tr.risk.priority] || ''}`}>
                            <PIcon className="h-3 w-3 mr-1" />
                            P{tr.risk.priority?.match(/\d/)?.[0] || '?'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {tr.risk.measures}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReviewingRisk(tr)} title="Voir détails">
                              <Eye className="h-3 w-3" />
                            </Button>
                            {!tr.risk.isValidated && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                const unit = workUnits.find(u => u.id === tr.unitId);
                                if (unit) updateUnit(tr.unitId, { risks: (unit.risks || []).map(r => r.id === tr.risk.id ? { ...r, isValidated: true } : r) });
                              }} title="Valider">
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRisk(tr)} title="Supprimer">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingRisks && (
        <Dialog open={true} onOpenChange={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {pendingRisks.risks.length} risques générés pour « {pendingRisks.elementName} »
              </DialogTitle>
              <DialogDescription>
                Sélectionnez les risques que vous souhaitez conserver puis validez.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={selectedPendingRisks.size === pendingRisks.risks.length}
                  onCheckedChange={(checked) => {
                    setSelectedPendingRisks(checked ? new Set(pendingRisks.risks.map(r => r.id)) : new Set());
                  }}
                />
                <span className="text-sm font-medium">Tout sélectionner ({selectedPendingRisks.size}/{pendingRisks.risks.length})</span>
              </div>
              {pendingRisks.risks.map(risk => (
                <div key={risk.id} className={`flex items-start gap-3 p-3 rounded-lg border ${selectedPendingRisks.has(risk.id) ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
                  <Checkbox
                    checked={selectedPendingRisks.has(risk.id)}
                    onCheckedChange={(checked) => {
                      setSelectedPendingRisks(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(risk.id); else next.delete(risk.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{risk.family}</Badge>
                      <span className="text-sm font-medium">{risk.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{risk.danger}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mesures: {risk.measures}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-[9px] ${PRIORITY_BADGE_COLORS[risk.priority] || ''}`}>
                        {risk.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        G={risk.gravityValue} × F={risk.frequencyValue} × M={risk.controlValue} = {risk.riskScore}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPendingRisks(null); setSelectedPendingRisks(new Set()); }}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button onClick={validateSelectedRisks} disabled={selectedPendingRisks.size === 0}>
                <Check className="h-4 w-4 mr-2" />
                Valider {selectedPendingRisks.size} risque(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {reviewingRisk && (
        <Dialog open={true} onOpenChange={() => setReviewingRisk(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détail du risque</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Unité de travail</Label>
                <p className="text-sm font-medium">{reviewingRisk.unitName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Famille</Label>
                <p className="text-sm">{reviewingRisk.risk.family}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Situation d'exposition</Label>
                <p className="text-sm">{reviewingRisk.risk.type}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Danger identifié</Label>
                <p className="text-sm">{reviewingRisk.risk.danger}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Gravité</Label>
                  <p className="text-sm">{reviewingRisk.risk.gravity} ({reviewingRisk.risk.gravityValue})</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fréquence</Label>
                  <p className="text-sm">{reviewingRisk.risk.frequency} ({reviewingRisk.risk.frequencyValue})</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Maîtrise</Label>
                  <p className="text-sm">{reviewingRisk.risk.control} ({reviewingRisk.risk.controlValue})</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Score et Priorité</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono">{reviewingRisk.risk.riskScore}</span>
                  <Badge className={PRIORITY_BADGE_COLORS[reviewingRisk.risk.priority]}>{reviewingRisk.risk.priority}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mesures de prévention</Label>
                <p className="text-sm">{reviewingRisk.risk.measures}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {librarySelector?.isOpen && (
        <RiskLibrarySelector
          isOpen={true}
          onClose={() => setLibrarySelector(null)}
          onSelectRisks={handleLibraryRisksSelected}
          hierarchyLevel="Unité"
          elementName={librarySelector.elementName}
        />
      )}
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={className}>{children}</label>;
}
