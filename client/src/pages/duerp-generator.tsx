import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  FileText,
  FileSpreadsheet
} from 'lucide-react';
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
  Risk
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
  const [isGeneratingFinalRisks, setIsGeneratingFinalRisks] = useState(false);

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

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending company data:", data);
      const response = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (newCompany: Company, variables: any) => {
      setCompany(newCompany);
      setLocations(variables.locations || []);
      setWorkStations(variables.workStations || []);
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

  // Handle company form submission
  const handleCompanySubmit = (data: any) => {
    if (company) {
      setCompany({ ...company, ...data });
      setLocations(data.locations || []);
      setWorkStations(data.workStations || []);
      toast({
        title: "Entreprise mise à jour",
        description: "Les informations ont été mises à jour avec succès.",
      });
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  // Generate final risks table
  const generateFinalTable = async () => {
    if (!company) return;
    
    setIsGeneratingFinalRisks(true);
    const allRisks: Risk[] = [];
    
    try {
      // Generate risks for each location
      for (const location of locations) {
        if (location.name.trim()) {
          const response = await apiRequest('/api/generate-risks', {
            method: 'POST',
            body: JSON.stringify({
              workUnitName: location.name,
              locationName: location.name,
              companyActivity: company.activity,
            }),
          });
          
          response.risks.forEach((risk: Risk) => {
            allRisks.push({
              ...risk,
              source: location.name,
              sourceType: 'Lieu'
            });
          });
        }
      }
      
      // Generate risks for each work station
      for (const workStation of workStations) {
        if (workStation.name.trim()) {
          const response = await apiRequest('/api/generate-risks', {
            method: 'POST',
            body: JSON.stringify({
              workUnitName: workStation.name,
              locationName: workStation.description || workStation.name,
              companyActivity: company.activity,
            }),
          });
          
          response.risks.forEach((risk: Risk) => {
            allRisks.push({
              ...risk,
              source: workStation.name,
              sourceType: 'Poste'
            });
          });
        }
      }
      
      setFinalRisks(allRisks);
      toast({
        title: "Tableau final généré",
        description: `${allRisks.length} risques consolidés dans le tableau final.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le tableau final des risques.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFinalRisks(false);
    }
  };

  // Check if final table can be generated
  const canGenerateFinalTable = () => {
    return (
      locations.some(loc => loc.name.trim()) || 
      workStations.some(ws => ws.name.trim())
    );
  };

  // Export functions
  const exportToExcel = async () => {
    try {
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risks: finalRisks,
          companyName: company?.name || 'Export'
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DUERP_${company?.name || 'Export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Le fichier Excel a été téléchargé avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter en Excel.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async () => {
    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risks: finalRisks,
          companyName: company?.name || 'Export',
          companyActivity: company?.activity || 'Non renseigné'
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DUERP_${company?.name || 'Export'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Le fichier PDF a été téléchargé avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter en PDF.",
        variant: "destructive",
      });
    }
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
              {canGenerateFinalTable() && (
                <Button 
                  onClick={generateFinalTable}
                  disabled={isGeneratingFinalRisks}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isGeneratingFinalRisks ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Générer le tableau des risques
                    </>
                  )}
                </Button>
              )}
              {finalRisks.length > 0 && (
                <>
                  <Button 
                    onClick={exportToExcel}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exporter Excel
                  </Button>
                  <Button 
                    onClick={exportToPDF}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter PDF
                  </Button>
                </>
              )}
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
              <CardTitle>Création du DUERP</CardTitle>
              <Badge variant="secondary">Configuration complète</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CompanyForm 
              onSubmit={handleCompanySubmit} 
              isLoading={createCompanyMutation.isPending}
              initialData={company}
              locations={locations}
              workStations={workStations}
            />
          </CardContent>
        </Card>

        {/* Final Risk Table */}
        {finalRisks.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Tableau final des risques
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {finalRisks.length} risque{finalRisks.length !== 1 ? 's' : ''} identifié{finalRisks.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Synthèse de tous les risques identifiés pour votre entreprise
              </p>
            </CardHeader>
            <CardContent>
              <RiskTable risks={finalRisks} showSource={true} />
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!company && (
          <Card>
            <CardHeader>
              <CardTitle>Comment utiliser ce générateur ?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full p-2 text-sm font-semibold">1</div>
                  <div>
                    <h3 className="font-medium">Remplissez les informations de votre entreprise</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Nom, activité et mesures de prévention déjà en place
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full p-2 text-sm font-semibold">2</div>
                  <div>
                    <h3 className="font-medium">Ajoutez vos lieux et postes de travail</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Définissez tous les espaces et postes où s'exercent les activités
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 text-green-600 rounded-full p-2 text-sm font-semibold">3</div>
                  <div>
                    <h3 className="font-medium">Générez le tableau des risques</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      L'IA analysera automatiquement tous vos lieux et postes pour identifier les risques
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}