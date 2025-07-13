import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, X, MapPin, Settings } from "lucide-react";
import type { Company, PreventionMeasure, Location, WorkStation } from "@shared/simpleSchema";

const companyFormSchema = z.object({
  name: z.string().min(1, "Le nom de la société est requis"),
  activity: z.string().min(1, "Le secteur d'activité est requis"),
  existingPreventionMeasures: z.array(z.object({
    id: z.string(),
    description: z.string(),
  })).default([]),
  locations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    risks: z.array(z.any()).default([]),
    preventionMeasures: z.array(z.any()).default([]),
  })).default([]),
  workStations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    risks: z.array(z.any()).default([]),
    preventionMeasures: z.array(z.any()).default([]),
  })).default([]),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

interface CompanyFormProps {
  onSubmit: (data: CompanyFormData) => void;
  isLoading: boolean;
  initialData?: Company | null;
  locations?: Location[];
  workStations?: WorkStation[];
}

export default function CompanyForm({ onSubmit, isLoading, initialData, locations = [], workStations = [] }: CompanyFormProps) {
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      activity: initialData?.activity || "",
      existingPreventionMeasures: initialData?.existingPreventionMeasures || [],
      locations: locations,
      workStations: workStations,
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      console.log("Updating CompanyForm with new initialData:", initialData);
      form.setValue("name", initialData.name || "");
      form.setValue("activity", initialData.activity || "");
      form.setValue("existingPreventionMeasures", initialData.existingPreventionMeasures || []);
    }
  }, [initialData, form]);

  // Update form when locations/workStations change
  useEffect(() => {
    form.setValue("locations", locations);
    form.setValue("workStations", workStations);
  }, [locations, workStations, form]);

  const addPreventionMeasure = () => {
    const currentMeasures = form.getValues("existingPreventionMeasures");
    const newMeasure: PreventionMeasure = {
      id: Date.now().toString(),
      description: "",
    };
    form.setValue("existingPreventionMeasures", [...currentMeasures, newMeasure]);
  };

  const removePreventionMeasure = (id: string) => {
    const currentMeasures = form.getValues("existingPreventionMeasures");
    const filteredMeasures = currentMeasures.filter(measure => measure.id !== id);
    form.setValue("existingPreventionMeasures", filteredMeasures);
  };

  const updatePreventionMeasure = (id: string, description: string) => {
    const currentMeasures = form.getValues("existingPreventionMeasures");
    const updatedMeasures = currentMeasures.map(measure => 
      measure.id === id ? { ...measure, description } : measure
    );
    form.setValue("existingPreventionMeasures", updatedMeasures);
  };

  // Locations management
  const addLocation = () => {
    const currentLocations = form.getValues("locations");
    const newLocation: Location = {
      id: Date.now().toString(),
      name: "",
      risks: [],
      preventionMeasures: [],
    };
    form.setValue("locations", [...currentLocations, newLocation]);
  };

  const removeLocation = (id: string) => {
    const currentLocations = form.getValues("locations");
    const filteredLocations = currentLocations.filter(location => location.id !== id);
    form.setValue("locations", filteredLocations);
  };

  const updateLocation = (id: string, name: string) => {
    const currentLocations = form.getValues("locations");
    const updatedLocations = currentLocations.map(location => 
      location.id === id ? { ...location, name } : location
    );
    form.setValue("locations", updatedLocations);
  };

  // WorkStations management
  const addWorkStation = () => {
    const currentWorkStations = form.getValues("workStations");
    const newWorkStation: WorkStation = {
      id: Date.now().toString(),
      name: "",
      description: "",
      risks: [],
      preventionMeasures: [],
    };
    form.setValue("workStations", [...currentWorkStations, newWorkStation]);
  };

  const removeWorkStation = (id: string) => {
    const currentWorkStations = form.getValues("workStations");
    const filteredWorkStations = currentWorkStations.filter(ws => ws.id !== id);
    form.setValue("workStations", filteredWorkStations);
  };

  const updateWorkStation = (id: string, field: string, value: string) => {
    const currentWorkStations = form.getValues("workStations");
    const updatedWorkStations = currentWorkStations.map(ws => 
      ws.id === id ? { ...ws, [field]: value } : ws
    );
    form.setValue("workStations", updatedWorkStations);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la société *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ex: ACME Industries"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="activity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secteur d'activité *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ex: Industrie manufacturière"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Mesures de prévention existantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Mesures de prévention existantes dans la société
            </CardTitle>
            <p className="text-sm text-gray-600">
              Listez les équipements de protection, formations, procédures et autres mesures de sécurité déjà en place dans votre entreprise.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {form.watch("existingPreventionMeasures")?.map((measure, index) => (
                <div key={measure.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Ex: Casques de protection fournis à tous les employés, Formation annuelle aux premiers secours, Procédure d'évacuation affichée..."
                      value={measure.description}
                      onChange={(e) => updatePreventionMeasure(measure.id, e.target.value)}
                      className="min-h-[60px] resize-none"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePreventionMeasure(measure.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addPreventionMeasure}
                className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une mesure de prévention
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lieux de travail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Lieux de travail
            </CardTitle>
            <p className="text-sm text-gray-600">
              Définissez les différents lieux où s'exerce l'activité de votre entreprise.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {form.watch("locations")?.map((location, index) => (
                <div key={location.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <Input
                    placeholder="Ex: Atelier principal, Bureau, Entrepôt, Zone de stockage..."
                    value={location.name}
                    onChange={(e) => updateLocation(location.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLocation(location.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addLocation}
                className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un lieu de travail
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Postes de travail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              Postes de travail
            </CardTitle>
            <p className="text-sm text-gray-600">
              Définissez les postes de travail spécifiques avec leurs équipements et activités.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {form.watch("workStations")?.map((workStation, index) => (
                <div key={workStation.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-start gap-3">
                    <Settings className="h-4 w-4 text-orange-600 mt-1" />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Ex: Poste de soudage, Bureau comptable, Zone de stockage..."
                        value={workStation.name}
                        onChange={(e) => updateWorkStation(workStation.id, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Description détaillée (optionnel): machines, outils, produits utilisés..."
                        value={workStation.description || ""}
                        onChange={(e) => updateWorkStation(workStation.id, "description", e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWorkStation(workStation.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addWorkStation}
                className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un poste de travail
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {!initialData && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
