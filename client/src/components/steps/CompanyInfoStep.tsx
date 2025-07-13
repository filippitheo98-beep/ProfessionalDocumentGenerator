import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Phone, Mail, Users, MapPin, Briefcase } from "lucide-react";
import type { Company } from "@shared/schema";

const companyInfoSchema = z.object({
  name: z.string().min(1, "Le nom de la société est requis"),
  activity: z.string().min(1, "Le secteur d'activité est requis"),
  sector: z.string().optional(),
  address: z.string().optional(),
  siret: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")),
  employeeCount: z.number().min(0, "Le nombre d'employés ne peut pas être négatif").optional(),
});

type CompanyInfoData = z.infer<typeof companyInfoSchema>;

interface CompanyInfoStepProps {
  onSubmit: (data: CompanyInfoData) => void;
  onSave: (data: CompanyInfoData) => void;
  initialData?: Company | null;
  isLoading?: boolean;
}

export default function CompanyInfoStep({ 
  onSubmit, 
  onSave, 
  initialData, 
  isLoading = false 
}: CompanyInfoStepProps) {
  const form = useForm<CompanyInfoData>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      name: "",
      activity: "",
      sector: "",
      address: "",
      siret: "",
      phone: "",
      email: "",
      employeeCount: undefined,
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        activity: initialData.activity || "",
        sector: initialData.sector || "",
        address: initialData.address || "",
        siret: initialData.siret || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        employeeCount: initialData.employeeCount || undefined,
      });
    }
  }, [initialData, form]);

  const handleSubmit = (data: CompanyInfoData) => {
    onSubmit(data);
  };

  const handleSave = () => {
    const data = form.getValues();
    onSave(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Informations de la société
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nom de la société */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Nom de la société *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Entrez le nom de la société"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* SIRET */}
                <FormField
                  control={form.control}
                  name="siret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SIRET</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="123 456 789 00012"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Secteur d'activité */}
                <FormField
                  control={form.control}
                  name="activity"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Secteur d'activité *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Commerce de détail, Services informatiques, BTP..."
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Secteur (optionnel) */}
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Secteur (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Industrie, Services, Agriculture..."
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Adresse */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Adresse complète
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="123 Rue de la Paix, 75001 Paris"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Téléphone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Téléphone
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="01 23 45 67 89"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="contact@entreprise.com"
                          type="email"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nombre d'employés */}
                <FormField
                  control={form.control}
                  name="employeeCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Nombre d'employés
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="10"
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value ? parseInt(e.target.value) : undefined);
                            handleSave();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="min-w-32"
                >
                  {isLoading ? 'Sauvegarde...' : 'Continuer'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}