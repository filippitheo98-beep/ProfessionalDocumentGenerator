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
    <Card className="overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <Input
                value={location.name}
                onChange={(e) => onUpdateLocation({ name: e.target.value })}
                placeholder="Nom du lieu"
                className="text-lg font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              />
              <p className="text-sm text-slate-600">
                {location.workUnits.length} unité{location.workUnits.length !== 1 ? 's' : ''} de travail
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddWorkUnit}
              className="text-primary hover:text-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
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
        {location.workUnits.map((workUnit) => (
          <div key={workUnit.id} className="border-l-4 border-primary pl-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <Input
                    value={workUnit.name}
                    onChange={(e) => onUpdateWorkUnit(workUnit.id, { name: e.target.value })}
                    placeholder="Nom de l'unité de travail"
                    className="text-lg font-medium border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  />
                  <p className="text-sm text-slate-600">
                    {workUnit.risks.length} risque{workUnit.risks.length !== 1 ? 's' : ''} identifié{workUnit.risks.length !== 1 ? 's' : ''}
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
