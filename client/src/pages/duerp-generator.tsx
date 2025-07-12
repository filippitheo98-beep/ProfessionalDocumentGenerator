import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Download, 
  Plus, 
  MapPin, 
  Settings, 
  Trash2, 
  ChevronDown, 
  ChevronRight 
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import CompanyForm from '@/components/CompanyForm';
import RiskTable from '@/components/RiskTable';
import type { 
  Company, 
  Location, 
  WorkStation, 
  Risk, 
  PreventionMeasure 
} from '@shared/schema';

export default function DuerpGenerator() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [finalRisks, setFinalRisks] = useState<Risk[]>([]);
  const [expandedRiskSections, setExpandedRiskSections] = useState<Set<string>>(new Set());

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Mutations
  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending company data:", data);
      const response = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (newCompany: Company) => {
      setCompany(newCompany);
      toast({
        title: "Entreprise créée",
        description: "Les informations de l'entreprise ont été enregistrées avec succès.",
      });
    },
    onError: (error) => {
      console.error("Error creating company:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Non connecté",
          description: "Vous n'êtes pas connecté. Redirection vers la page de connexion...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: `Impossible de créer l'entreprise: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const generateRisksMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/generate-risks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Risques générés",
        description: `${data.risks.length} risques ont été générés avec succès.`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erreur",
        description: "Impossible de générer les risques. Veuillez réessayer.",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleCompanySubmit = (data: any) => {
    if (company) {
      setCompany({ ...company, ...data });
      toast({
        title: "Entreprise mise à jour",
        description: "Les informations ont été mises à jour avec succès.",
      });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const addLocation = () => {
    const newLocation: Location = {
      id: Date.now().toString(),
      name: '',
      risks: [],
      preventionMeasures: [],
    };
    setLocations([...locations, newLocation]);
  };

  const addWorkStation = () => {
    const newWorkStation: WorkStation = {
      id: Date.now().toString(),
      name: '',
      description: '',
      risks: [],
      preventionMeasures: [],
    };
    setWorkStations([...workStations, newWorkStation]);
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, ...updates } : loc
    ));
  };

  const updateWorkStation = (id: string, updates: Partial<WorkStation>) => {
    setWorkStations(workStations.map(ws => 
      ws.id === id ? { ...ws, ...updates } : ws
    ));
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter(loc => loc.id !== id));
  };

  const removeWorkStation = (id: string) => {
    setWorkStations(workStations.filter(ws => ws.id !== id));
  };

  const generateLocationRisks = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    if (!location || !company) return;

    generateRisksMutation.mutate({
      workUnitName: location.name,
      locationName: location.name,
      companyActivity: company.activity,
    }, {
      onSuccess: (data) => {
        setLocations(locations.map(loc => 
          loc.id === locationId ? { ...loc, risks: data.risks } : loc
        ));
      },
    });
  };

  const generateWorkStationRisks = (workStationId: string) => {
    const workStation = workStations.find(ws => ws.id === workStationId);
    if (!workStation || !company) return;

    generateRisksMutation.mutate({
      workUnitName: workStation.name,
      locationName: workStation.description || workStation.name,
      companyActivity: company.activity,
    }, {
      onSuccess: (data) => {
        setWorkStations(workStations.map(ws => 
          ws.id === workStationId ? { ...ws, risks: data.risks } : ws
        ));
      },
    });
  };

  const toggleRiskSection = (sectionId: string) => {
    const newExpanded = new Set(expandedRiskSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedRiskSections(newExpanded);
  };

  const toggleAllRiskSections = () => {
    const allSections = [
      ...locations.map(loc => `location-${loc.id}`),
      ...workStations.map(ws => `workstation-${ws.id}`)
    ];
    
    const allExpanded = allSections.every(id => expandedRiskSections.has(id));
    
    if (allExpanded) {
      setExpandedRiskSections(new Set());
    } else {
      setExpandedRiskSections(new Set(allSections));
    }
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
    
    // Ajouter les risques des postes
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

  const canGenerateFinalTable = () => {
    return (
      locations.some(loc => loc.risks.length > 0) || 
      workStations.some(ws => ws.risks.length > 0)
    );
  };

  const downloadDocument = () => {
    toast({
      title: "Téléchargement",
      description: "Le document DUERP sera bientôt disponible au téléchargement.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

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
              {(locations.length > 0 || workStations.length > 0) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleAllRiskSections}
                  className="text-xs"
                >
                  {[
                    ...locations.map(loc => `location-${loc.id}`),
                    ...workStations.map(ws => `workstation-${ws.id}`)
                  ].every(id => expandedRiskSections.has(id)) ? 'Réduire tout' : 'Développer tout'}
                </Button>
              )}
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

        {/* Arborescence des lieux et postes */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lieux et postes de travail</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Gérez vos lieux et postes de travail dans une vue simplifiée
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={addLocation}
                  disabled={!company}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lieu
                </Button>
                <Button 
                  onClick={addWorkStation}
                  disabled={!company}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Poste
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Lieux */}
              {locations.map((location) => (
                <div key={location.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <input
                        type="text"
                        value={location.name}
                        onChange={(e) => updateLocation(location.id, { name: e.target.value })}
                        className="flex-1 bg-white border border-blue-300 rounded px-3 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nom du lieu..."
                      />
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                        {location.risks.length} risque{location.risks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => generateLocationRisks(location.id)}
                        size="sm"
                        disabled={!location.name.trim() || generateRisksMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1"
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Générer
                      </Button>
                      <Button
                        onClick={() => toggleRiskSection(`location-${location.id}`)}
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:bg-blue-100 px-2 py-1"
                      >
                        {expandedRiskSections.has(`location-${location.id}`) ? 
                          <ChevronDown className="h-3 w-3" /> : 
                          <ChevronRight className="h-3 w-3" />
                        }
                      </Button>
                      <Button
                        onClick={() => removeLocation(location.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-100 px-2 py-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <Collapsible 
                    open={expandedRiskSections.has(`location-${location.id}`)}
                    onOpenChange={() => toggleRiskSection(`location-${location.id}`)}
                  >
                    <CollapsibleContent>
                      <div className="mt-3 pl-7">
                        {location.risks.length > 0 ? (
                          <div className="bg-white rounded border p-2">
                            <RiskTable risks={location.risks} />
                          </div>
                        ) : (
                          <div className="text-center py-4 border-2 border-dashed border-blue-300 rounded bg-white">
                            <Shield className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                            <p className="text-xs text-blue-600">Cliquez sur "Générer" pour analyser ce lieu</p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
              
              {/* Postes */}
              {workStations.map((workStation) => (
                <div key={workStation.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <Settings className="h-4 w-4 text-orange-600" />
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={workStation.name}
                          onChange={(e) => updateWorkStation(workStation.id, { name: e.target.value })}
                          className="w-full bg-white border border-orange-300 rounded px-3 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Nom du poste..."
                        />
                        <input
                          type="text"
                          value={workStation.description || ''}
                          onChange={(e) => updateWorkStation(workStation.id, { description: e.target.value })}
                          className="w-full bg-white border border-orange-200 rounded px-3 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                          placeholder="Description (optionnelle)..."
                        />
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
                        {workStation.risks.length} risque{workStation.risks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => generateWorkStationRisks(workStation.id)}
                        size="sm"
                        disabled={!workStation.name.trim() || generateRisksMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1"
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Générer
                      </Button>
                      <Button
                        onClick={() => toggleRiskSection(`workstation-${workStation.id}`)}
                        size="sm"
                        variant="ghost"
                        className="text-orange-600 hover:bg-orange-100 px-2 py-1"
                      >
                        {expandedRiskSections.has(`workstation-${workStation.id}`) ? 
                          <ChevronDown className="h-3 w-3" /> : 
                          <ChevronRight className="h-3 w-3" />
                        }
                      </Button>
                      <Button
                        onClick={() => removeWorkStation(workStation.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-100 px-2 py-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <Collapsible 
                    open={expandedRiskSections.has(`workstation-${workStation.id}`)}
                    onOpenChange={() => toggleRiskSection(`workstation-${workStation.id}`)}
                  >
                    <CollapsibleContent>
                      <div className="mt-3 pl-7">
                        {workStation.risks.length > 0 ? (
                          <div className="bg-white rounded border p-2">
                            <RiskTable risks={workStation.risks} />
                          </div>
                        ) : (
                          <div className="text-center py-4 border-2 border-dashed border-orange-300 rounded bg-white">
                            <Shield className="h-6 w-6 mx-auto mb-2 text-orange-400" />
                            <p className="text-xs text-orange-600">Cliquez sur "Générer" pour analyser ce poste</p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
              
              {locations.length === 0 && workStations.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-center space-x-4 mb-4">
                    <MapPin className="h-8 w-8 text-blue-400" />
                    <Settings className="h-8 w-8 text-orange-400" />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Aucun lieu ou poste de travail ajouté</p>
                  <p className="text-xs text-gray-500">Cliquez sur "Lieu" ou "Poste" pour commencer</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                    ? "Générez d'abord des risques pour vos lieux et postes"
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