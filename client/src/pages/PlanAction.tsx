import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ListTodo,
  Plus,
  Sparkles,
  Library,
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ActionRow {
  id: number;
  duerpId: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignedTo: number | null;
  dueDate: string | null;
  completedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

export default function PlanAction() {
  const [match, params] = useRoute("/plan-action/:documentId");
  const documentId = params?.documentId ? parseInt(params.documentId, 10) : null;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editAction, setEditAction] = useState<ActionRow | null>(null);
  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false);
  const [librarySuggestionsOpen, setLibrarySuggestionsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [selectedAi, setSelectedAi] = useState<Set<number>>(new Set());
  const [selectedLibrary, setSelectedLibrary] = useState<Set<number>>(new Set());

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: [`/api/duerp/document/${documentId}`],
    queryFn: () =>
      apiRequest(`/api/duerp/document/${documentId}`).then((d: any) => d),
    enabled: !!documentId,
  });

  const {
    data: actions = [],
    isLoading: actionsLoading,
  } = useQuery<ActionRow[]>({
    queryKey: [`/api/duerp-documents/${documentId}/actions`],
    queryFn: getQueryFn(),
    enabled: !!documentId,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/duerp-documents/${documentId}/actions/generate-from-duerp`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      toast({ title: "Plan généré", description: "Actions créées à partir du DUERP." });
    },
    onError: (e: Error) => {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de générer le plan",
        variant: "destructive",
      });
    },
  });

  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ title: string; description?: string; priority: string }>
  >([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [librarySuggestions, setLibrarySuggestions] = useState<
    Array<{ id: number; measures: string; family?: string }>
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    setAiSuggestionsOpen(true);
    try {
      const list = await apiRequest(
        `/api/duerp-documents/${documentId}/actions/suggest-by-ai`,
        { method: "POST" }
      );
      setAiSuggestions(Array.isArray(list) ? list : []);
      setSelectedAi(new Set());
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Suggestions IA indisponibles",
        variant: "destructive",
      });
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchLibrarySuggestions = async () => {
    setLibraryLoading(true);
    setLibrarySuggestionsOpen(true);
    try {
      const list = await apiRequest(
        `/api/duerp-documents/${documentId}/actions/suggest-from-library`,
        { method: "POST" }
      );
      setLibrarySuggestions(Array.isArray(list) ? list : []);
      setSelectedLibrary(new Set());
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Suggestions bibliothèque indisponibles",
        variant: "destructive",
      });
      setLibrarySuggestions([]);
    } finally {
      setLibraryLoading(false);
    }
  };

  const addFromAi = useMutation({
    mutationFn: async (indices: number[]) => {
      const created = [];
      for (const i of indices) {
        const s = aiSuggestions[i];
        if (!s?.title) continue;
        const action = await apiRequest(
          `/api/duerp-documents/${documentId}/actions`,
          {
            method: "POST",
            body: JSON.stringify({
              title: s.title,
              description: s.description || undefined,
              priority: s.priority || "medium",
              sourceType: "ai",
            }),
          }
        );
        created.push(action);
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      setAiSuggestionsOpen(false);
      toast({ title: "Actions ajoutées" });
    },
  });

  const addFromLibrary = useMutation({
    mutationFn: async (indices: number[]) => {
      for (const i of indices) {
        const s = librarySuggestions[i];
        if (!s?.measures) continue;
        await apiRequest(`/api/duerp-documents/${documentId}/actions`, {
          method: "POST",
          body: JSON.stringify({
            title: s.measures.slice(0, 200),
            priority: "medium",
            sourceType: "library",
            sourceId: String(s.id),
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      setLibrarySuggestionsOpen(false);
      toast({ title: "Actions ajoutées" });
    },
  });

  const createActionMutation = useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      priority: string;
    }) =>
      apiRequest(`/api/duerp-documents/${documentId}/actions`, {
        method: "POST",
        body: JSON.stringify({ ...body, sourceType: "manual" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      setAddOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      toast({ title: "Action créée" });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: ({
      actionId,
      updates,
    }: {
      actionId: number;
      updates: Partial<ActionRow>;
    }) =>
      apiRequest(
        `/api/duerp-documents/${documentId}/actions/${actionId}`,
        {
          method: "PUT",
          body: JSON.stringify(updates),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      setEditAction(null);
      toast({ title: "Action mise à jour" });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: number) =>
      apiRequest(
        `/api/duerp-documents/${documentId}/actions/${actionId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
      toast({ title: "Action supprimée" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({
      actionId,
      status,
    }: {
      actionId: number;
      status: string;
    }) =>
      apiRequest(
        `/api/duerp-documents/${documentId}/actions/${actionId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
            ...(status === "completed"
              ? { completedAt: new Date().toISOString() }
              : {}),
          }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/duerp-documents/${documentId}/actions`],
      });
    },
  });

  if (!match || documentId == null) {
    navigate("/documents");
    return null;
  }

  const docTitle = document?.title ?? `Document #${documentId}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListTodo className="h-7 w-7" />
              Plan d&apos;action
            </h1>
            <p className="text-muted-foreground">{docTitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || docLoading}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ListTodo className="h-4 w-4 mr-2" />
            )}
            Générer à partir du DUERP
          </Button>
          <Button
            variant="outline"
            onClick={fetchAiSuggestions}
            disabled={aiLoading || docLoading}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Suggérer par IA
          </Button>
          <Button
            variant="outline"
            onClick={fetchLibrarySuggestions}
            disabled={libraryLoading || docLoading}
          >
            {libraryLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Library className="h-4 w-4 mr-2" />
            )}
            Suggérer depuis la bibliothèque
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une action
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tableau des actions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
              {actionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Aucune action. Générez à partir du DUERP ou ajoutez des actions.
                        </TableCell>
                      </TableRow>
                    ) : (
                      actions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell className="font-medium">{action.title}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {action.description || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {PRIORITY_LABELS[action.priority] ?? action.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                action.status === "completed"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {STATUS_LABELS[action.status] ?? action.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {action.dueDate
                              ? new Date(action.dueDate).toLocaleDateString("fr-FR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {action.sourceType === "risk" && "Risque"}
                            {action.sourceType === "measure" && "Mesure"}
                            {action.sourceType === "ai" && "IA"}
                            {action.sourceType === "library" && "Bibliothèque"}
                            {action.sourceType === "manual" && "Manuelle"}
                            {!action.sourceType && "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {action.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  toggleStatusMutation.mutate({
                                    actionId: action.id,
                                    status: "completed",
                                  })
                                }
                                title="Marquer terminée"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditAction(action)}
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteActionMutation.mutate(action.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </main>

      {/* Modal Ajouter */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Titre</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titre de l'action"
              />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select
                value={newPriority}
                onValueChange={setNewPriority}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                createActionMutation.mutate({
                  title: newTitle.trim(),
                  description: newDescription.trim() || undefined,
                  priority: newPriority,
                })
              }
              disabled={!newTitle.trim() || createActionMutation.isPending}
            >
              {createActionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Éditer */}
      <Dialog
        open={!!editAction}
        onOpenChange={(open) => !open && setEditAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;action</DialogTitle>
          </DialogHeader>
          {editAction && (
            <EditActionForm
              action={editAction}
              onSave={(updates) =>
                updateActionMutation.mutate({
                  actionId: editAction.id,
                  updates,
                })
              }
              onCancel={() => setEditAction(null)}
              isPending={updateActionMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Suggestions IA */}
      <Dialog
        open={aiSuggestionsOpen}
        onOpenChange={setAiSuggestionsOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suggestions par IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {aiSuggestions.length === 0 && !aiLoading && (
              <p className="text-muted-foreground">Aucune suggestion.</p>
            )}
            {aiSuggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                <Checkbox
                  checked={selectedAi.has(i)}
                  onCheckedChange={(checked) => {
                    setSelectedAi((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(i);
                      else next.delete(i);
                      return next;
                    });
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{s.title}</p>
                  {s.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {s.description}
                    </p>
                  )}
                  <Badge variant="secondary" className="mt-1">
                    {PRIORITY_LABELS[s.priority] ?? s.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiSuggestionsOpen(false)}>
              Fermer
            </Button>
            <Button
              onClick={() =>
                addFromAi.mutate(Array.from(selectedAi))
              }
              disabled={selectedAi.size === 0 || addFromAi.isPending}
            >
              Ajouter les {selectedAi.size} sélectionnée(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Suggestions Bibliothèque */}
      <Dialog
        open={librarySuggestionsOpen}
        onOpenChange={setLibrarySuggestionsOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suggestions depuis la bibliothèque</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {librarySuggestions.length === 0 && !libraryLoading && (
              <p className="text-muted-foreground">Aucune mesure trouvée.</p>
            )}
            {librarySuggestions.map((s, i) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                <Checkbox
                  checked={selectedLibrary.has(i)}
                  onCheckedChange={(checked) => {
                    setSelectedLibrary((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(i);
                      else next.delete(i);
                      return next;
                    });
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{s.measures}</p>
                  {s.family && (
                    <Badge variant="outline" className="mt-1">
                      {s.family}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLibrarySuggestionsOpen(false)}
            >
              Fermer
            </Button>
            <Button
              onClick={() =>
                addFromLibrary.mutate(Array.from(selectedLibrary))
              }
              disabled={selectedLibrary.size === 0 || addFromLibrary.isPending}
            >
              Ajouter les {selectedLibrary.size} sélectionnée(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditActionForm({
  action,
  onSave,
  onCancel,
  isPending,
}: {
  action: ActionRow;
  onSave: (updates: Partial<ActionRow>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(action.title);
  const [description, setDescription] = useState(action.description ?? "");
  const [priority, setPriority] = useState(action.priority);
  const [status, setStatus] = useState(action.status);

  return (
    <>
      <div className="space-y-4 py-4">
        <div>
          <Label>Titre</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
        </div>
        <div>
          <Label>Priorité</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Faible</SelectItem>
              <SelectItem value="medium">Moyenne</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Statut</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          onClick={() =>
            onSave({
              title: title.trim(),
              description: description.trim() || null,
              priority,
              status,
            })
          }
          disabled={!title.trim() || isPending}
        >
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  );
}
