import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import StepperDuerp from '@/components/StepperDuerp';
import CompanyInfoStep from '@/components/steps/CompanyInfoStep';
import LocationsWorkstationsStep from '@/components/steps/LocationsWorkstationsStep';
import RiskGenerationStep from '@/components/steps/RiskGenerationStep';
import AnalyticsStep from '@/components/steps/AnalyticsStep';
import type { 
  Company, 
  Location, 
  WorkStation, 
  Risk,
  PreventionMeasure
} from '@shared/schema';
import { SelectiveUpdateModal } from '@/components/SelectiveUpdateModal';

export default function NewDuerpGenerator() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // États principaux
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [preventionMeasures, setPreventionMeasures] = useState<PreventionMeasure[]>([]);
  const [finalRisks, setFinalRisks] = useState<Risk[]>([]);
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false);
  const [showSelectiveUpdateModal, setShowSelectiveUpdateModal] = useState(false);
  const [newGeneratedRisks, setNewGeneratedRisks] = useState<Risk[]>([]);
  
  // Gestion du document (création/modification)
  const urlParams = new URLSearchParams(window.location.search);
  const editDocumentId = urlParams.get('edit') || urlParams.get('editDocumentId');
  const viewDocumentId = urlParams.get('view') || urlParams.get('viewDocumentId');
  const documentId = editDocumentId || viewDocumentId;
  const isViewMode = !!viewDocumentId;

  // Chargement du document existant
  const { data: existingDocument, isLoading: isLoadingDocument } = useQuery({
    queryKey: ['/api/duerp/document', documentId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!documentId,
  });

  const { data: existingCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['/api/companies', existingDocument?.companyId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!existingDocument?.companyId,
  });

  // Chargement des données existantes
  useEffect(() => {
    if (existingDocument && existingCompany) {
      setCompany(existingCompany);
      setLocations(existingDocument.locations || []);
      setWorkStations(existingDocument.workStations || []);
      setPreventionMeasures(existingDocument.preventionMeasures || []);
      setFinalRisks(existingDocument.finalRisks || []);
      
      // Marquer les étapes complétées
      const completed = [1]; // Étape 1 toujours complétée si on a une société
      if (existingDocument.locations?.length > 0 || existingDocument.workStations?.length > 0) {
        completed.push(2);
      }
      if (existingDocument.finalRisks?.length > 0) {
        completed.push(3, 4);
      }
      setCompletedSteps(completed);
    }
  }, [existingDocument, existingCompany]);

  // Mutations pour sauvegarder
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: any) => {
      const response = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(companyData),
      });
      return response;
    },
    onSuccess: (newCompany) => {
      setCompany(newCompany);
      if (!completedSteps.includes(1)) {
        setCompletedSteps(prev => [...prev, 1]);
      }
      toast({
        title: "Société créée",
        description: "Les informations de la société ont été sauvegardées",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la société",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (companyData: any) => {
      const response = await apiRequest(`/api/companies/${company?.id}`, {
        method: 'PUT',
        body: JSON.stringify(companyData),
      });
      return response;
    },
    onSuccess: (updatedCompany) => {
      setCompany(updatedCompany);
      toast({
        title: "Société mise à jour",
        description: "Les informations ont été sauvegardées",
      });
    },
  });

  const saveDuerpMutation = useMutation({
    mutationFn: async (data: any) => {
      if (documentId) {
        const response = await apiRequest(`/api/duerp/document/${documentId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        return response;
      } else {
        const response = await apiRequest('/api/duerp/save', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return response;
      }
    },
    onSuccess: () => {
      toast({
        title: "Document sauvegardé",
        description: "Votre DUERP a été sauvegardé avec succès",
      });
    },
  });

  const generateRisksMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingRisks(true);
      const allRisks: Risk[] = [];
      
      // Générer les risques pour chaque lieu
      for (const location of locations) {
        const response = await apiRequest('/api/generate-risks', {
          method: 'POST',
          body: JSON.stringify({
            workUnitName: location.name,
            locationName: location.name,
            companyActivity: company?.activity || '',
          }),
        });
        
        const locationRisks = response.risks.map((risk: Risk) => ({
          ...risk,
          source: location.name,
          sourceType: 'Lieu' as const,
        }));
        
        allRisks.push(...locationRisks);
      }
      
      // Générer les risques pour chaque poste
      for (const workStation of workStations) {
        const response = await apiRequest('/api/generate-risks', {
          method: 'POST',
          body: JSON.stringify({
            workUnitName: workStation.name,
            locationName: workStation.description || workStation.name,
            companyActivity: company?.activity || '',
          }),
        });
        
        const workStationRisks = response.risks.map((risk: Risk) => ({
          ...risk,
          source: workStation.name,
          sourceType: 'Poste' as const,
        }));
        
        allRisks.push(...workStationRisks);
      }
      
      setFinalRisks(allRisks);
      setIsGeneratingRisks(false);
      
      if (!completedSteps.includes(3)) {
        setCompletedSteps(prev => [...prev, 3, 4]);
      }
      
      return allRisks;
    },
    onError: () => {
      setIsGeneratingRisks(false);
      toast({
        title: "Erreur",
        description: "Impossible de générer les risques",
        variant: "destructive",
      });
    },
  });

  // Handlers pour les étapes
  const handleCompanyInfoSubmit = (data: any) => {
    if (company) {
      updateCompanyMutation.mutate(data);
    } else {
      createCompanyMutation.mutate(data);
    }
    setCurrentStep(2);
  };

  const handleSaveCompanyInfo = (data: any) => {
    if (company) {
      updateCompanyMutation.mutate(data);
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const handleLocationsUpdate = (newLocations: Location[]) => {
    setLocations(newLocations);
    if (!completedSteps.includes(2) && (newLocations.length > 0 || workStations.length > 0)) {
      setCompletedSteps(prev => [...prev, 2]);
    }
  };

  const handleWorkStationsUpdate = (newWorkStations: WorkStation[]) => {
    setWorkStations(newWorkStations);
    if (!completedSteps.includes(2) && (locations.length > 0 || newWorkStations.length > 0)) {
      setCompletedSteps(prev => [...prev, 2]);
    }
  };

  const handlePreventionMeasuresUpdate = (newMeasures: PreventionMeasure[]) => {
    setPreventionMeasures(newMeasures);
  };

  const handleAnalyzePhotos = async (photos: any[], locationOrWorkstation: string) => {
    // Ici on pourrait analyser les photos avec l'IA
    toast({
      title: "Analyse des photos",
      description: `Analyse des photos pour ${locationOrWorkstation} en cours...`,
    });
  };

  const handleSaveProgress = () => {
    if (company) {
      saveDuerpMutation.mutate({
        companyId: company.id,
        title: `${company.name} - DUERP`,
        locations,
        workStations,
        finalRisks,
        preventionMeasures,
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risks: finalRisks,
          companyName: company?.name || 'Entreprise',
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DUERP_${company?.name || 'Export'}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export réussi",
          description: "Le fichier Excel a été téléchargé",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter le fichier",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      toast({
        title: "Génération en cours",
        description: "Capture des graphiques...",
      });
      
      // Capturer les graphiques
      const chartImages: { [key: string]: string } = {};
      
      // Importer html2canvas dynamiquement
      const html2canvas = (await import('html2canvas')).default;
      
      // Capturer le graphique en barres
      const barChartElement = document.querySelector('[data-chart="bar"]');
      if (barChartElement) {
        const canvas = await html2canvas(barChartElement as HTMLElement, {
          backgroundColor: 'white',
          scale: 1,
          useCORS: true,
          logging: false,
          width: 800,
          height: 400
        });
        chartImages.barChart = canvas.toDataURL('image/jpeg', 0.8);
      }
      
      // Capturer le graphique en secteurs
      const pieChartElement = document.querySelector('[data-chart="pie"]');
      if (pieChartElement) {
        const canvas = await html2canvas(pieChartElement as HTMLElement, {
          backgroundColor: 'white',
          scale: 1,
          useCORS: true,
          logging: false,
          width: 800,
          height: 400
        });
        chartImages.pieChart = canvas.toDataURL('image/jpeg', 0.8);
      }

      toast({
        title: "Génération en cours",
        description: "Création du document PDF...",
      });

      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risks: finalRisks,
          companyName: company?.name || 'Entreprise',
          companyActivity: company?.activity || '',
          companyData: {
            address: company?.address,
            siret: company?.siret,
            phone: company?.phone,
            email: company?.email,
            employeeCount: company?.employeeCount,
          },
          locations: locations,
          workStations: workStations,
          preventionMeasures: preventionMeasures,
          chartImages: chartImages
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DUERP_${company?.name || 'Export'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export réussi",
          description: "Le rapport PDF complet avec graphiques a été téléchargé",
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter le fichier PDF. Vérifiez que les risques sont générés.",
        variant: "destructive",
      });
    }
  };

  const isLoading = isLoadingDocument || isLoadingCompany;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StepperDuerp
          currentStep={currentStep}
          totalSteps={4}
          onStepChange={setCurrentStep}
          onSave={handleSaveProgress}
          isSaving={saveDuerpMutation.isPending}
          completedSteps={completedSteps}
        />

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <>
            {currentStep === 1 && (
              <CompanyInfoStep
                onSubmit={handleCompanyInfoSubmit}
                onSave={handleSaveCompanyInfo}
                initialData={company}
                isLoading={createCompanyMutation.isPending || updateCompanyMutation.isPending}
              />
            )}

            {currentStep === 2 && (
              <LocationsWorkstationsStep
                locations={locations}
                workStations={workStations}
                preventionMeasures={preventionMeasures}
                onUpdateLocations={handleLocationsUpdate}
                onUpdateWorkStations={handleWorkStationsUpdate}
                onUpdatePreventionMeasures={handlePreventionMeasuresUpdate}
                onAnalyzePhotos={handleAnalyzePhotos}
                onSave={handleSaveProgress}
                companyActivity={company?.activity || ''}
              />
            )}

            {currentStep === 3 && (
              <RiskGenerationStep
                locations={locations}
                workStations={workStations}
                finalRisks={finalRisks}
                companyActivity={company?.activity || ''}
                onGenerateRisks={() => generateRisksMutation.mutate()}
                onRegenerateRisks={() => generateRisksMutation.mutate()}

                isGenerating={isGeneratingRisks}
                onSave={handleSaveProgress}
              />
            )}

            {currentStep === 4 && (
              <AnalyticsStep
                risks={finalRisks}
                companyName={company?.name || 'Entreprise'}
                onSave={handleSaveProgress}
                onGeneratePDF={handleExportPDF}
                locations={locations}
                workStations={workStations}
                preventionMeasures={preventionMeasures}
              />
            )}
          </>
        )}
      </div>

      {/* Modal de mise à jour sélective */}
      <SelectiveUpdateModal
        isOpen={showSelectiveUpdateModal}
        onClose={() => setShowSelectiveUpdateModal(false)}
        documentId={documentId ? parseInt(documentId) : 0}
        documentTitle={existingDocument?.title || `${company?.name} - DUERP`}
        existingRisks={finalRisks}
        newRisks={newGeneratedRisks}
        onUpdateComplete={() => {
          // Recharger le document après la mise à jour
          queryClient.invalidateQueries({ queryKey: ['/api/duerp/document', documentId] });
          toast({
            title: "Document mis à jour",
            description: "Les modifications ont été appliquées avec succès",
          });
        }}
      />
    </div>
  );
}