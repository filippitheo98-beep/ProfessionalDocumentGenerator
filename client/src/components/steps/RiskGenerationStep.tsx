import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Download,
  RefreshCw
} from 'lucide-react';
import RiskTable from '@/components/RiskTable';
import type { Location, WorkStation, Risk } from '@shared/schema';

interface RiskGenerationStepProps {
  locations: Location[];
  workStations: WorkStation[];
  finalRisks: Risk[];
  companyActivity: string;
  onGenerateRisks: () => void;
  onRegenerateRisks: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  isGenerating: boolean;
  onSave: () => void;
}

export default function RiskGenerationStep({
  locations,
  workStations,
  finalRisks,
  companyActivity,
  onGenerateRisks,
  onRegenerateRisks,
  onExportExcel,
  onExportPDF,
  isGenerating,
  onSave
}: RiskGenerationStepProps) {
  const [generationProgress, setGenerationProgress] = useState(0);
  
  const totalItems = locations.length + workStations.length;
  const hasRisks = finalRisks.length > 0;
  
  const risksByLevel = {
    'Faible': finalRisks.filter(r => r.finalRisk === 'Faible').length,
    'Moyen': finalRisks.filter(r => r.finalRisk === 'Moyen').length,
    'Important': finalRisks.filter(r => r.finalRisk === 'Important').length,
  };

  const handleGenerate = () => {
    setGenerationProgress(0);
    onGenerateRisks();
    
    // Simuler la progression
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 500);
  };

  const handleRegenerate = () => {
    setGenerationProgress(0);
    onRegenerateRisks();
    
    // Simuler la progression
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Résumé avant génération */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Génération du tableau des risques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {locations.length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-300">
                Lieux de travail
              </div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {workStations.length}
              </div>
              <div className="text-sm text-green-600 dark:text-green-300">
                Postes de travail
              </div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {finalRisks.length}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-300">
                Risques identifiés
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <strong>Secteur d'activité :</strong> {companyActivity}
          </div>

          {/* Progress bar pour la génération */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Génération des risques en cours...</span>
              </div>
              <Progress value={generationProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            {!hasRisks ? (
              <Button 
                onClick={handleGenerate}
                disabled={isGenerating || totalItems === 0}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Générer les risques
              </Button>
            ) : (
              <Button 
                onClick={handleRegenerate}
                disabled={isGenerating}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Régénérer les risques
              </Button>
            )}
            
            {hasRisks && (
              <>
                <Button 
                  onClick={onExportExcel}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exporter Excel
                </Button>
                
                <Button 
                  onClick={onExportPDF}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Exporter PDF
                </Button>
              </>
            )}
          </div>

          {totalItems === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Vous devez ajouter au moins un lieu ou un poste de travail pour générer des risques.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Statistiques des risques */}
      {hasRisks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Répartition des risques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {risksByLevel['Faible']}
                </div>
                <div className="text-sm text-green-600 dark:text-green-300">
                  Risques faibles
                </div>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {risksByLevel['Moyen']}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-300">
                  Risques moyens
                </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {risksByLevel['Important']}
                </div>
                <div className="text-sm text-red-600 dark:text-red-300">
                  Risques importants
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau des risques */}
      {hasRisks && (
        <Card>
          <CardHeader>
            <CardTitle>Tableau des risques professionnels</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskTable risks={finalRisks} showSource={true} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}