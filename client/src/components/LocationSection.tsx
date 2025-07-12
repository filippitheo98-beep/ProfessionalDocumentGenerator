import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Plus, Trash2, Settings, X } from "lucide-react";
import type { Location, WorkUnit } from "@shared/schema";
import RiskTable from "./RiskTable";
import PreventionSection from "./PreventionSection";

interface LocationSectionProps {
  location: Location;
  onUpdateLocation: (updates: Partial<Location>) => void;
  onRemoveLocation: () => void;
  onAddWorkUnit: () => void;
  onUpdateWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>) => void;
  onRemoveWorkUnit: (workUnitId: string) => void;
  onGenerateRisks: (workUnitId: string) => void;
  onGenerateLocationRisks: () => void;
  onAddPreventionMeasure: (workUnitId: string) => void;
  onUpdatePreventionMeasure: (workUnitId: string, measureId: string, description: string) => void;
  onRemovePreventionMeasure: (workUnitId: string, measureId: string) => void;
  isGeneratingRisks: boolean;
  companyActivity: string;
}

export default function LocationSection({
  location,
  onUpdateLocation,
  onRemoveLocation,
  onAddWorkUnit,
  onUpdateWorkUnit,
  onRemoveWorkUnit,
  onGenerateRisks,
  onGenerateLocationRisks,
  onAddPreventionMeasure,
  onUpdatePreventionMeasure,
  onRemovePreventionMeasure,
  isGeneratingRisks,
  companyActivity
}: LocationSectionProps) {
  
  const getWorkUnitIcon = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('soudure')) return "🔥";
    if (nameLower.includes('usinage')) return "⚙️";
    if (nameLower.includes('bureau') || nameLower.includes('écran')) return "💻";
    return "🔧";
  };

  return (
    <Card className="overflow-hidden border-2 border-blue-200">
      <CardHeader className="bg-blue-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">LIEU</span>
                <Input
                  value={location.name}
                  onChange={(e) => onUpdateLocation({ name: e.target.value })}
                  placeholder="Ex: Atelier principal, Bureau, Entrepôt..."
                  className="text-lg font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                />
              </div>
              <p className="text-sm text-blue-600">
                📍 {location.workUnits.length} unité{location.workUnits.length !== 1 ? 's' : ''} de travail dans ce lieu
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={onGenerateLocationRisks}
              disabled={isGeneratingRisks || !location.name}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGeneratingRisks ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-1" />
                  Générer risques du lieu
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddWorkUnit}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter une unité
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveLocation}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Risques du lieu */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-blue-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Risques généraux du lieu
            </h4>
            <span className="text-sm text-blue-600">
              {location.risks.length} risque{location.risks.length !== 1 ? 's' : ''} identifié{location.risks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-blue-700 mb-4">
            Risques liés à l'espace physique : accès, circulation, évacuation, structure, éclairage, etc.
          </p>
          {location.risks.length > 0 && <RiskTable risks={location.risks} />}
        </div>

        {/* Séparateur */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-50 text-gray-500">Unités de travail dans ce lieu</span>
          </div>
        </div>

        {location.workUnits.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Aucune unité de travail</p>
            <p className="text-sm">Cliquez sur "Ajouter une unité" pour commencer</p>
          </div>
        )}
        
        {location.workUnits.map((workUnit) => (
          <div key={workUnit.id} className="border-l-4 border-orange-400 pl-6 bg-orange-50/50 rounded-r-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">UNITÉ DE TRAVAIL</span>
                    <Input
                      value={workUnit.name}
                      onChange={(e) => onUpdateWorkUnit(workUnit.id, { name: e.target.value })}
                      placeholder="Ex: Poste de soudage, Bureau comptable, Zone de stockage..."
                      className="text-lg font-medium border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-sm text-orange-600">
                    ⚠️ {workUnit.risks.length} risque{workUnit.risks.length !== 1 ? 's' : ''} identifié{workUnit.risks.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => onGenerateRisks(workUnit.id)}
                  disabled={isGeneratingRisks || !workUnit.name}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isGeneratingRisks ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-1" />
                      Générer les risques
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveWorkUnit(workUnit.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Prevention Measures Input */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-blue-900">
                  Mesures de prévention initiales (optionnel)
                </h5>
                <div className="flex gap-1">
                  {['EPI obligatoires', 'Formation sécurité', 'Ventilation adaptée', 'Signalisation'].map((measure) => (
                    <Button
                      key={measure}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 px-2 bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        const currentMeasures = workUnit.preventionMeasures;
                        const newMeasure = { id: crypto.randomUUID(), description: measure };
                        const exists = currentMeasures.some(m => m.description === measure);
                        if (!exists) {
                          onUpdateWorkUnit(workUnit.id, { 
                            preventionMeasures: [...currentMeasures, newMeasure] 
                          });
                        }
                      }}
                    >
                      +{measure}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                value={workUnit.preventionMeasures.map(m => m.description).join('\n')}
                placeholder="Décrivez les mesures de prévention existantes pour cette unité de travail..."
                className="min-h-[60px] bg-white border-blue-200 focus:border-blue-400 focus:ring-blue-200"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.trim()) {
                    // Split by line breaks and create measures
                    const measures = value.split('\n').filter(m => m.trim()).map(desc => ({
                      id: crypto.randomUUID(),
                      description: desc.trim()
                    }));
                    onUpdateWorkUnit(workUnit.id, { preventionMeasures: measures });
                  } else {
                    onUpdateWorkUnit(workUnit.id, { preventionMeasures: [] });
                  }
                }}
              />
              <p className="text-xs text-blue-700 mt-1">
                Séparez chaque mesure par une nouvelle ligne ou utilisez les boutons ci-dessus
              </p>
            </div>

            <RiskTable risks={workUnit.risks} />

            <PreventionSection
              measures={workUnit.preventionMeasures}
              onAddMeasure={() => onAddPreventionMeasure(workUnit.id)}
              onUpdateMeasure={(measureId, description) => 
                onUpdatePreventionMeasure(workUnit.id, measureId, description)
              }
              onRemoveMeasure={(measureId) => onRemovePreventionMeasure(workUnit.id, measureId)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
