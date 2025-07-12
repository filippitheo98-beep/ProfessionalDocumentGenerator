import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, X } from "lucide-react";
import type { Company, PreventionMeasure } from "@shared/schema";

const companyFormSchema = z.object({
  name: z.string().min(1, "Le nom de la société est requis"),
  activity: z.string().min(1, "Le secteur d'activité est requis"),
  existingPreventionMeasures: z.array(z.object({
    id: z.string(),
    description: z.string(),
  })).default([]),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

interface CompanyFormProps {
  onSubmit: (data: CompanyFormData) => void;
  isLoading: boolean;
  initialData?: Company | null;
}

export default function CompanyForm({ onSubmit, isLoading, initialData }: CompanyFormProps) {
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      activity: initialData?.activity || "",
      existingPreventionMeasures: initialData?.existingPreventionMeasures || [],
    },
  });

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
