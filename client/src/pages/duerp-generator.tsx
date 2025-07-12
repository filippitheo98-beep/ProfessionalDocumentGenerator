import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, Plus, MapPin, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Company, Location, WorkStation, Risk, PreventionMeasure } from "@shared/schema";
import CompanyForm from "@/components/CompanyForm";
import LocationSection from "@/components/LocationSection";
import RiskTable from "@/components/RiskTable";

export default function DuerpGenerator() {
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [finalRisks, setFinalRisks] = useState<Risk[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; activity: string }) => {
      const response = await apiRequest("POST", "/api/companies", data);
      return response.json();
    },
    onSuccess: (newCompany: Company) => {
      setCompany(newCompany);
      toast({
        title: "Entreprise créée",
        description: "Les informations de l'entreprise ont été enregistrées.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'entreprise.",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Company> }) => {
      const response = await apiRequest("PUT", `/api/companies/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: (updatedCompany: Company) => {
      setCompany(updatedCompany);
      // Ne pas écraser les locations locales - elles sont déjà à jour
    },
  });

  const generateRisksMutation = useMutation({
    mutationFn: async (data: { workUnitName: string; locationName: string; companyActivity: string }) => {
      const response = await apiRequest("POST", "/api/generate-risks", data);
      return response.json();
    },
    onSuccess: (data: { risks: Risk[] }, variables) => {
      toast({
        title: "Risques générés",
        description: `${data.risks.length} risques ont été générés pour ${variables.workUnitName}.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de générer les risques.",
        variant: "destructive",
      });
    },
  });

  const handleCompanySubmit = (data: { name: string; activity: string }) => {
    createCompanyMutation.mutate(data);
  };

  const addLocation = () => {
    const newLocation: Location = {
      id: crypto.randomUUID(),
      name: `Lieu ${locations.length + 1}`,
      risks: [],
      preventionMeasures: []
    };
    const updatedLocations = [...locations, newLocation];
    setLocations(updatedLocations);
    
    if (company) {
      updateCompanyMutation.mutate({
        id: company.id,
        updates: { locations: updatedLocations }
      });
    }
  };

  const addWorkStation = () => {
    const newWorkStation: WorkStation = {
      id: crypto.randomUUID(),
      name: `Poste ${workStations.length + 1}`,
      description: "",
      risks: [],
      preventionMeasures: []
    };
    const updatedWorkStations = [...workStations, newWorkStation];
    setWorkStations(updatedWorkStations);
    
    if (company) {
      updateCompanyMutation.mutate({
        id: company.id,
        updates: { workStations: updatedWorkStations }
      });
    }
  };

  const updateLocation = useCallback((locationId: string, updates: Partial<Location>) => {
    const updatedLocations = locations.map(loc => 
      loc.id === locationId ? { ...loc, ...updates } : loc
    );
    setLocations(updatedLocations);
    
    // Débouncer les appels API pour éviter les conflits
    if (company) {
      setTimeout(() => {
        updateCompanyMutation.mutate({
          id: company.id,
          updates: { locations: updatedLocations }
        });
      }, 500);
    }
  }, [locations, company, updateCompanyMutation]);

  const removeLocation = (locationId: string) => {
    const updatedLocations = locations.filter(loc => loc.id !== locationId);
    setLocations(updatedLocations);
    
    if (company) {
      updateCompanyMutation.mutate({
        id: company.id,
        updates: { locations: updatedLocations }
      });
    }
  };

  const addWorkUnit = (locationId: string) => {
    const newWorkUnit: WorkUnit = {
      id: crypto.randomUUID(),
      name: "",
      risks: [],
      preventionMeasures: []
    };
    
    updateLocation(locationId, {
      workUnits: [...(locations.find(l => l.id === locationId)?.workUnits || []), newWorkUnit]
    });
  };

  const updateWorkUnit = (locationId: string, workUnitId: string, updates: Partial<WorkUnit>) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;
    
    const updatedWorkUnits = location.workUnits.map(wu => 
      wu.id === workUnitId ? { ...wu, ...updates } : wu
    );
    
    updateLocation(locationId, { workUnits: updatedWorkUnits });
  };

  const removeWorkUnit = (locationId: string, workUnitId: string) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;
    
    const updatedWorkUnits = location.workUnits.filter(wu => wu.id !== workUnitId);
    updateLocation(locationId, { workUnits: updatedWorkUnits });
  };

  const generateRisks = async (locationId: string, workUnitId: string) => {
    const location = locations.find(l => l.id === locationId);
    const workUnit = location?.workUnits.find(wu => wu.id === workUnitId);
    
    if (!location || !workUnit || !company) return;
    
    try {
      const response = await generateRisksMutation.mutateAsync({
        workUnitName: workUnit.name,
        locationName: location.name,
        companyActivity: company.activity
      });
      
      updateWorkUnit(locationId, workUnitId, { risks: response.risks });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const generateLocationRisks = async (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    
    if (!location || !company) return;
    
    try {
      const response = await generateRisksMutation.mutateAsync({
        workUnitName: "Lieu général",
        locationName: location.name,
        companyActivity: company.activity
      });
      
      updateLocation(locationId, { risks: response.risks });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addPreventionMeasure = (locationId: string, workUnitId: string) => {
    const location = locations.find(l => l.id === locationId);
    const workUnit = location?.workUnits.find(wu => wu.id === workUnitId);
    
    if (!workUnit) return;
    
    const newMeasure: PreventionMeasure = {
      id: crypto.randomUUID(),
      description: ""
    };
    
    updateWorkUnit(locationId, workUnitId, {
      preventionMeasures: [...workUnit.preventionMeasures, newMeasure]
    });
  };

  const updatePreventionMeasure = (locationId: string, workUnitId: string, measureId: string, description: string) => {
    const location = locations.find(l => l.id === locationId);
    const workUnit = location?.workUnits.find(wu => wu.id === workUnitId);
    
    if (!workUnit) return;
    
    const updatedMeasures = workUnit.preventionMeasures.map(m => 
      m.id === measureId ? { ...m, description } : m
    );
    
    updateWorkUnit(locationId, workUnitId, { preventionMeasures: updatedMeasures });
  };

  const removePreventionMeasure = (locationId: string, workUnitId: string, measureId: string) => {
    const location = locations.find(l => l.id === locationId);
    const workUnit = location?.workUnits.find(wu => wu.id === workUnitId);
    
    if (!workUnit) return;
    
    const updatedMeasures = workUnit.preventionMeasures.filter(m => m.id !== measureId);
    updateWorkUnit(locationId, workUnitId, { preventionMeasures: updatedMeasures });
  };

  // Work Station functions
  const updateWorkStation = useCallback((workStationId: string, updates: Partial<WorkStation>) => {
    const updatedWorkStations = workStations.map(ws => 
      ws.id === workStationId ? { ...ws, ...updates } : ws
    );
    setWorkStations(updatedWorkStations);
    
    if (company) {
      setTimeout(() => {
        updateCompanyMutation.mutate({
          id: company.id,
          updates: { workStations: updatedWorkStations }
        });
      }, 500);
    }
  }, [workStations, company, updateCompanyMutation]);

  const removeWorkStation = (workStationId: string) => {
    const updatedWorkStations = workStations.filter(ws => ws.id !== workStationId);
    setWorkStations(updatedWorkStations);
    
    if (company) {
      updateCompanyMutation.mutate({
        id: company.id,
        updates: { workStations: updatedWorkStations }
      });
    }
  };

  const generateWorkStationRisks = async (workStationId: string) => {
    const workStation = workStations.find(ws => ws.id === workStationId);
    
    if (!workStation || !company) return;
    
    try {
      const response = await generateRisksMutation.mutateAsync({
        workUnitName: workStation.name,
        locationName: workStation.description || "Poste de travail",
        companyActivity: company.activity
      });
      
      updateWorkStation(workStationId, { risks: response.risks });
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Final table functions
  const canGenerateFinalTable = () => {
    const locationRisks = locations.some(loc => loc.risks.length > 0);
    const workStationRisks = workStations.some(ws => ws.risks.length > 0);
    return locationRisks || workStationRisks;
  };

  const generateFinalTable = () => {
    const allRisks: Risk[] = [];
    
    // Ajouter les risques des lieux
    locations.forEach(location => {
      location.risks.forEach(risk => {
        allRisks.push({
          ...risk,
          source: location.name,
          sourceType: 'Lieu'
        });
      });
    });
    
    // Ajouter les risques des postes de travail
    workStations.forEach(workStation => {
      workStation.risks.forEach(risk => {
        allRisks.push({
          ...risk,
          source: workStation.name,
          sourceType: 'Poste'
        });
      });
    });
    
    setFinalRisks(allRisks);
    
    toast({
      title: "Tableau final généré",
      description: `${allRisks.length} risques consolidés dans le tableau final.`,
    });
  };

  const downloadDocument = () => {
    if (!company || finalRisks.length === 0) return;
    
    const csvContent = [
      ["Source", "Type de risque", "Danger", "Gravité", "Fréquence", "Maîtrise", "Risque final", "Mesures de prévention"],
      ...finalRisks.map(risk => [
        `${risk.sourceType}: ${risk.source}`,
        risk.type,
        risk.danger,
        risk.gravity,
        risk.frequency,
        risk.control,
        risk.finalRisk,
        risk.measures
      ])
    ];
    
    const csvString = csvContent.map(row => row.join(";")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `DUERP_${company.name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Document téléchargé",
      description: "Le DUERP a été téléchargé avec succès.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Générateur de DUERP</h1>
                <p className="text-sm text-slate-600">Document Unique d'Évaluation des Risques Professionnels</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button className="bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Company Information */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Informations de l'entreprise</CardTitle>
              <Badge variant="secondary">Étape 1</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CompanyForm 
              onSubmit={handleCompanySubmit} 
              isLoading={createCompanyMutation.isPending}
              initialData={company}
            />
          </CardContent>
        </Card>

        {/* Locations Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Lieux de travail</h2>
              <p className="text-sm text-slate-600 mt-1">
                Espaces physiques : bureaux, ateliers, entrepôts, etc.
              </p>
            </div>
            <Button onClick={addLocation} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un lieu
            </Button>
          </div>

          {locations.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">Aucun lieu défini</p>
              <p className="text-sm">Optionnel : ajoutez des lieux physiques si nécessaire</p>
            </div>
          )}

          {locations.map((location) => (
            <Card key={location.id} className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 mb-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        Lieu de travail
                      </Badge>
                      <input
                        type="text"
                        value={location.name}
                        onChange={(e) => updateLocation(location.id, { name: e.target.value })}
                        className="text-lg font-medium bg-white border-2 border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900 placeholder-blue-500"
                        placeholder="Ex: Atelier principal, Bureau comptable, Entrepôt..."
                      />
                      <p className="text-sm text-blue-600 mt-1">
                        Espace physique : structure, accès, circulation, éclairage
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => generateLocationRisks(location.id)}
                      disabled={generateRisksMutation.isPending || !location.name}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {generateRisksMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-1" />
                          Générer risques
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLocation(location.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-base font-medium text-blue-900 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Risques du lieu
                    </h5>
                    <span className="text-sm text-blue-600">
                      {location.risks.length} risque{location.risks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {location.risks.length > 0 ? (
                    <RiskTable risks={location.risks} />
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                      <p className="text-sm text-blue-700 font-medium">Aucun risque généré</p>
                      <p className="text-xs text-blue-600 mt-1">Cliquez sur "Générer risques" pour analyser ce lieu</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Work Stations Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Postes de travail</h2>
              <p className="text-sm text-slate-600 mt-1">
                Activités professionnelles : machines, outils, tâches spécifiques
              </p>
            </div>
            <Button onClick={addWorkStation} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un poste
            </Button>
          </div>

          {workStations.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">Aucun poste de travail défini</p>
              <p className="text-sm">Ajoutez des postes de travail pour évaluer les risques</p>
            </div>
          )}

          {workStations.map((workStation) => (
            <Card key={workStation.id} className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300 mb-2">
                        <Settings className="h-3 w-3 mr-1" />
                        Poste de travail
                      </Badge>
                      <input
                        type="text"
                        value={workStation.name}
                        onChange={(e) => updateWorkStation(workStation.id, { name: e.target.value })}
                        className="text-lg font-medium bg-white border-2 border-orange-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-orange-900 placeholder-orange-500"
                        placeholder="Ex: Poste de soudage, Réception téléphonique, Machine CNC..."
                      />
                      <input
                        type="text"
                        value={workStation.description || ''}
                        onChange={(e) => updateWorkStation(workStation.id, { description: e.target.value })}
                        className="text-sm bg-white border-2 border-orange-200 rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-orange-700 placeholder-orange-400"
                        placeholder="Ex: Soudure à l'arc, Accueil clients, Usinage de précision..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => generateWorkStationRisks(workStation.id)}
                      disabled={generateRisksMutation.isPending || !workStation.name}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {generateRisksMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-1" />
                          Générer risques
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWorkStation(workStation.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-orange-100 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-base font-medium text-orange-900 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Risques du poste
                    </h5>
                    <span className="text-sm text-orange-600">
                      {workStation.risks.length} risque{workStation.risks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {workStation.risks.length > 0 ? (
                    <RiskTable risks={workStation.risks} />
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-orange-400" />
                      <p className="text-sm text-orange-700 font-medium">Aucun risque généré</p>
                      <p className="text-xs text-orange-600 mt-1">Cliquez sur "Générer risques" pour analyser ce poste</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section Tableau Final */}
        {(locations.length > 0 || workStations.length > 0) && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500 mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-green-800 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Tableau final des risques
              </h2>
              <Button 
                onClick={generateFinalTable}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!canGenerateFinalTable()}
              >
                Générer le tableau final
              </Button>
            </div>
            
            {finalRisks.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-green-700 mb-4">
                  <p className="font-medium">Tableau consolidé avec {finalRisks.length} risque{finalRisks.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs">Comprend les risques de {locations.length} lieu{locations.length !== 1 ? 'x' : ''} et {workStations.length} poste{workStations.length !== 1 ? 's' : ''}</p>
                </div>
                <RiskTable risks={finalRisks} showSource={true} />
                <div className="flex justify-end mt-4">
                  <Button 
                    onClick={downloadDocument}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger le DUERP
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
                <Shield className="h-12 w-12 mx-auto mb-4 text-green-400" />
                <p className="text-green-700 font-medium mb-2">Tableau final non généré</p>
                <p className="text-sm text-green-600">
                  {!canGenerateFinalTable() 
                    ? "Générez des risques pour vos lieux et postes de travail avant de créer le tableau final"
                    : "Cliquez sur 'Générer le tableau final' pour consolider tous les risques"
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
