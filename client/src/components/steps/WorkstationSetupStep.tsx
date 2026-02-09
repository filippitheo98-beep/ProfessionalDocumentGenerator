import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2,
  MapPin,
  Plus,
  Trash2,
  Briefcase,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Users
} from "lucide-react";
import type { Site, WorkUnit, Workstation, SitePriority } from "@shared/schema";

interface WorkstationSetupStepProps {
  companyId: number;
  companyActivity: string;
  companyDescription?: string;
  sites: Site[];
  onUpdateSites: (sites: Site[]) => void;
  onSave: () => void;
}

const SITE_PRIORITIES: SitePriority[] = ['Principal', 'Secondaire', 'Occasionnel', 'Temporaire'];

export default function WorkstationSetupStep({
  companyId,
  companyActivity,
  companyDescription,
  sites,
  onUpdateSites,
  onSave
}: WorkstationSetupStepProps) {
  const { toast } = useToast();
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set(sites.map(s => s.id)));
  const [newSiteName, setNewSiteName] = useState('');
  const [newWorkstationInputs, setNewWorkstationInputs] = useState<Record<string, string>>({});
  const [groupingFor, setGroupingFor] = useState<string | null>(null);

  const toggleSite = (id: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSite = () => {
    const name = newSiteName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    onUpdateSites([...sites, {
      id, name, priority: 'Principal', companyId,
      workUnits: [{
        id: crypto.randomUUID(),
        name: 'Général',
        siteId: id,
        workstations: [],
        risks: [],
        preventionMeasures: [],
        order: 0
      }],
      risks: [], preventionMeasures: [], order: sites.length
    }]);
    setExpandedSites(prev => new Set(prev).add(id));
    setNewSiteName('');
  };

  const removeSite = (id: string) => {
    onUpdateSites(sites.filter(s => s.id !== id));
  };

  const updateSite = (siteId: string, updates: Partial<Site>) => {
    onUpdateSites(sites.map(s => s.id === siteId ? { ...s, ...updates } : s));
  };

  const getAllWorkstationsForSite = (site: Site): string[] => {
    const ws: string[] = [];
    for (const unit of site.workUnits) {
      for (const w of unit.workstations) {
        ws.push(w.name);
      }
    }
    return ws;
  };

  const addWorkstation = (siteId: string) => {
    const name = newWorkstationInputs[siteId]?.trim();
    if (!name) return;
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    let targetUnit = site.workUnits[0];
    if (!targetUnit) {
      targetUnit = {
        id: crypto.randomUUID(),
        name: 'Général',
        siteId,
        workstations: [],
        risks: [],
        preventionMeasures: [],
        order: 0
      };
      updateSite(siteId, { workUnits: [targetUnit] });
    }

    const newWs: Workstation = {
      id: crypto.randomUUID(),
      name,
      order: targetUnit.workstations.length
    };

    const updatedUnits = site.workUnits.map((u, idx) =>
      idx === 0 ? { ...u, workstations: [...u.workstations, newWs] } : u
    );

    updateSite(siteId, { workUnits: updatedUnits });
    setNewWorkstationInputs(prev => ({ ...prev, [siteId]: '' }));
  };

  const removeWorkstation = (siteId: string, wsId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const updatedUnits = site.workUnits.map(u => ({
      ...u,
      workstations: u.workstations.filter(w => w.id !== wsId)
    }));
    updateSite(siteId, { workUnits: updatedUnits });
  };

  const groupWorkstationsWithAI = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    const allWs = getAllWorkstationsForSite(site);
    if (allWs.length < 2) {
      toast({ title: "Ajoutez au moins 2 postes pour le regroupement IA", variant: "destructive" });
      return;
    }

    setGroupingFor(siteId);
    try {
      const response = await apiRequest('/api/group-workstations', {
        method: 'POST',
        body: JSON.stringify({
          workstations: allWs,
          companyActivity,
          companyDescription,
          siteName: site.name
        }),
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
        toast({
          title: `${newUnits.length} unité(s) de travail créée(s)`,
          description: `${allWs.length} postes regroupés intelligemment`
        });
      }
    } catch (error) {
      toast({ title: "Erreur lors du regroupement", variant: "destructive" });
    } finally {
      setGroupingFor(null);
    }
  };

  const totalWorkstations = sites.reduce((sum, site) => sum + getAllWorkstationsForSite(site).length, 0);
  const totalUnits = sites.reduce((sum, site) => sum + site.workUnits.length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-4 rounded-lg">
        <h2 className="text-xl font-bold">Paramétrage des postes de travail</h2>
        <p className="text-indigo-100 text-sm mt-1">
          Ajoutez vos sites et listez les postes de travail. L'IA regroupera ensuite les postes en unités de travail.
        </p>
        <div className="flex gap-4 mt-3">
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Building2 className="h-3 w-3 mr-1" />{sites.length} site(s)
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Briefcase className="h-3 w-3 mr-1" />{totalWorkstations} poste(s)
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Users className="h-3 w-3 mr-1" />{totalUnits} unité(s)
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ajouter un site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nom du site (ex: Siège social, Entrepôt Lyon, Chantier A...)"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSite()}
              className="flex-1"
            />
            <Button onClick={addSite} disabled={!newSiteName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {sites.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Commencez par ajouter au moins un site ci-dessus
            </p>
          </CardContent>
        </Card>
      )}

      {sites.map(site => (
        <Card key={site.id} className="overflow-hidden">
          <CardHeader className="bg-muted/30 py-3 cursor-pointer" onClick={() => toggleSite(site.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedSites.has(site.id) ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <MapPin className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base">{site.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {getAllWorkstationsForSite(site).length} poste(s) •{' '}
                    {site.workUnits.length} unité(s) de travail
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={site.priority}
                  onValueChange={(val) => updateSite(site.id, { priority: val as SitePriority })}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); removeSite(site.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {expandedSites.has(site.id) && (
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  <Briefcase className="h-4 w-4 inline mr-1" />
                  Postes de travail
                </Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Nom du poste (ex: Soudeur, Cariste, Secrétaire, Opérateur machine...)"
                    value={newWorkstationInputs[site.id] || ''}
                    onChange={(e) => setNewWorkstationInputs(prev => ({ ...prev, [site.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addWorkstation(site.id)}
                  />
                  <Button variant="outline" onClick={() => addWorkstation(site.id)} disabled={!newWorkstationInputs[site.id]?.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getAllWorkstationsForSite(site).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucun poste ajouté</p>
                  ) : (
                    site.workUnits.flatMap(unit =>
                      unit.workstations.map(ws => (
                        <Badge key={ws.id} variant="secondary" className="py-1.5 px-3 text-sm flex items-center gap-2">
                          <Briefcase className="h-3 w-3" />
                          {ws.name}
                          <button
                            onClick={() => removeWorkstation(site.id, ws.id)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </Badge>
                      ))
                    )
                  )}
                </div>
              </div>

              {getAllWorkstationsForSite(site).length >= 2 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                        Regroupement intelligent par l'IA
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        L'IA va regrouper vos postes en unités de travail cohérentes
                      </p>
                    </div>
                    <Button
                      onClick={() => groupWorkstationsWithAI(site.id)}
                      disabled={groupingFor === site.id}
                      variant="outline"
                    >
                      {groupingFor === site.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Regroupement...</>
                      ) : (
                        <><Wand2 className="h-4 w-4 mr-2" />Regrouper avec l'IA</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {site.workUnits.length > 0 && site.workUnits.some(u => u.name !== 'Général' || site.workUnits.length > 1) && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">
                    <Users className="h-4 w-4 inline mr-1" />
                    Unités de travail créées
                  </Label>
                  <div className="space-y-2">
                    {site.workUnits.map(unit => (
                      <div key={unit.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <Users className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{unit.name}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {unit.workstations.map(ws => (
                              <Badge key={ws.id} variant="outline" className="text-[10px]">
                                {ws.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {unit.workstations.length} poste(s)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
