import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Company, Location, WorkUnit, Risk, PreventionMeasure } from "@shared/schema";
import CompanyForm from "@/components/CompanyForm";
import LocationSection from "@/components/LocationSection";

export default function DuerpGenerator() {
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
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
      setLocations(updatedCompany.locations || []);
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
      name: "",
      workUnits: []
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

  const updateLocation = (locationId: string, updates: Partial<Location>) => {
    const updatedLocations = locations.map(loc => 
      loc.id === locationId ? { ...loc, ...updates } : loc
    );
    setLocations(updatedLocations);
    
    if (company) {
      updateCompanyMutation.mutate({
        id: company.id,
        updates: { locations: updatedLocations }
      });
    }
  };

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
            <h2 className="text-xl font-semibold text-slate-900">Lieux et unités de travail</h2>
            <Button onClick={addLocation} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un lieu
            </Button>
          </div>

          {locations.map((location) => (
            <LocationSection
              key={location.id}
              location={location}
              onUpdateLocation={(updates) => updateLocation(location.id, updates)}
              onRemoveLocation={() => removeLocation(location.id)}
              onAddWorkUnit={() => addWorkUnit(location.id)}
              onUpdateWorkUnit={(workUnitId, updates) => updateWorkUnit(location.id, workUnitId, updates)}
              onRemoveWorkUnit={(workUnitId) => removeWorkUnit(location.id, workUnitId)}
              onGenerateRisks={(workUnitId) => generateRisks(location.id, workUnitId)}
              onAddPreventionMeasure={(workUnitId) => addPreventionMeasure(location.id, workUnitId)}
              onUpdatePreventionMeasure={(workUnitId, measureId, description) => 
                updatePreventionMeasure(location.id, workUnitId, measureId, description)
              }
              onRemovePreventionMeasure={(workUnitId, measureId) => 
                removePreventionMeasure(location.id, workUnitId, measureId)
              }
              isGeneratingRisks={generateRisksMutation.isPending}
              companyActivity={company?.activity || ""}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-12">
          <Button 
            size="lg" 
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={generateRisksMutation.isPending}
          >
            <Shield className="h-4 w-4 mr-2" />
            Générer tous les risques
          </Button>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter le DUERP
          </Button>
        </div>
      </main>
    </div>
  );
}
