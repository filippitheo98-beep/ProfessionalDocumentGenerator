import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Risk } from '@shared/schema';

interface SimpleRiskActionsProps {
  risks: Risk[];
  documentId?: number;
  onRisksUpdated: (risks: Risk[]) => void;
  canEdit: boolean;
}

export function SimpleRiskActions({ 
  risks, 
  documentId, 
  onRisksUpdated, 
  canEdit 
}: SimpleRiskActionsProps) {
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [newRisk, setNewRisk] = useState<Partial<Risk>>({
    type: '',
    danger: '',
    gravity: 'Moyenne',
    frequency: 'Occasionnel',
    control: 'Moyenne',
    finalRisk: 'Moyen',
    measures: '',
    source: 'Manuel',
    sourceType: 'Manuel'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Écouter les événements d'édition et de suppression
  useEffect(() => {
    const handleEditRisk = (event: CustomEvent) => {
      setEditingRisk(event.detail);
    };

    const handleDeleteRisk = (event: CustomEvent) => {
      deleteRiskMutation.mutate(event.detail);
    };

    window.addEventListener('editRisk', handleEditRisk as EventListener);
    window.addEventListener('deleteRisk', handleDeleteRisk as EventListener);

    return () => {
      window.removeEventListener('editRisk', handleEditRisk as EventListener);
      window.removeEventListener('deleteRisk', handleDeleteRisk as EventListener);
    };
  }, []);

  // Mutation pour ajouter un risque
  const addRiskMutation = useMutation({
    mutationFn: async (risk: Risk) => {
      if (documentId) {
        return await apiRequest(`/api/duerp/document/${documentId}/risks`, {
          method: 'POST',
          body: JSON.stringify({ risks: [risk] }),
        });
      }
      return risk;
    },
    onSuccess: () => {
      toast({
        title: "Risque ajouté",
        description: "Le nouveau risque a été ajouté avec succès",
      });
      
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['/api/duerp/document', documentId] });
      } else {
        const riskWithId = { ...newRisk, id: crypto.randomUUID() } as Risk;
        onRisksUpdated([...risks, riskWithId]);
      }
      
      setIsAddingRisk(false);
      setNewRisk({
        type: '',
        danger: '',
        gravity: 'Moyenne',
        frequency: 'Occasionnel',
        control: 'Moyenne',
        finalRisk: 'Moyen',
        measures: '',
        source: 'Manuel',
        sourceType: 'Manuel'
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter le risque",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un risque
  const deleteRiskMutation = useMutation({
    mutationFn: async (riskId: string) => {
      if (documentId) {
        return await apiRequest(`/api/duerp/document/${documentId}/risks`, {
          method: 'DELETE',
          body: JSON.stringify({ riskIds: [riskId] }),
        });
      }
      return riskId;
    },
    onSuccess: (_, riskId) => {
      toast({
        title: "Risque supprimé",
        description: "Le risque a été supprimé avec succès",
      });
      
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['/api/duerp/document', documentId] });
      } else {
        onRisksUpdated(risks.filter(r => r.id !== riskId));
      }
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le risque",
        variant: "destructive",
      });
    },
  });

  // Mutation pour modifier un risque
  const updateRiskMutation = useMutation({
    mutationFn: async (updates: { id: string; updates: Partial<Risk> }) => {
      if (documentId) {
        return await apiRequest(`/api/duerp/document/${documentId}/risks`, {
          method: 'PUT',
          body: JSON.stringify({ updates: [updates] }),
        });
      }
      return updates;
    },
    onSuccess: () => {
      toast({
        title: "Risque modifié",
        description: "Le risque a été modifié avec succès",
      });
      
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['/api/duerp/document', documentId] });
      } else {
        const updatedRisks = risks.map(r => 
          r.id === editingRisk?.id ? { ...r, ...editingRisk } : r
        );
        onRisksUpdated(updatedRisks);
      }
      
      setEditingRisk(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le risque",
        variant: "destructive",
      });
    },
  });

  const handleAddRisk = () => {
    if (!newRisk.type || !newRisk.danger || !newRisk.measures) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const riskToAdd: Risk = {
      id: crypto.randomUUID(),
      type: newRisk.type!,
      danger: newRisk.danger!,
      gravity: newRisk.gravity!,
      frequency: newRisk.frequency!,
      control: newRisk.control!,
      finalRisk: newRisk.finalRisk!,
      measures: newRisk.measures!,
      source: newRisk.source,
      sourceType: newRisk.sourceType
    };

    addRiskMutation.mutate(riskToAdd);
  };

  const handleUpdateRisk = () => {
    if (editingRisk) {
      updateRiskMutation.mutate({
        id: editingRisk.id,
        updates: editingRisk
      });
    }
  };

  if (!canEdit) {
    return null;
  }

  return (
    <>
      {/* Bouton d'ajout */}
      <Button
        size="sm"
        onClick={() => setIsAddingRisk(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Ajouter un risque
      </Button>

      {/* Dialog d'ajout */}
      <Dialog open={isAddingRisk} onOpenChange={setIsAddingRisk}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un nouveau risque</DialogTitle>
            <DialogDescription>
              Créez un nouveau risque personnalisé pour votre document DUERP
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type de risque *</Label>
              <Input
                id="type"
                value={newRisk.type}
                onChange={(e) => setNewRisk(prev => ({ ...prev, type: e.target.value }))}
                placeholder="Ex: TMS, Chute, Brûlure..."
              />
            </div>
            <div>
              <Label htmlFor="gravity">Gravité</Label>
              <Select value={newRisk.gravity} onValueChange={(value) => setNewRisk(prev => ({ ...prev, gravity: value as Risk['gravity'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faible">Faible</SelectItem>
                  <SelectItem value="Moyenne">Moyenne</SelectItem>
                  <SelectItem value="Élevée">Élevée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="frequency">Fréquence</Label>
              <Select value={newRisk.frequency} onValueChange={(value) => setNewRisk(prev => ({ ...prev, frequency: value as Risk['frequency'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rare">Rare</SelectItem>
                  <SelectItem value="Occasionnel">Occasionnel</SelectItem>
                  <SelectItem value="Hebdomadaire">Hebdomadaire</SelectItem>
                  <SelectItem value="Quotidien">Quotidien</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="control">Contrôle</Label>
              <Select value={newRisk.control} onValueChange={(value) => setNewRisk(prev => ({ ...prev, control: value as Risk['control'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faible">Faible</SelectItem>
                  <SelectItem value="Moyenne">Moyenne</SelectItem>
                  <SelectItem value="Élevée">Élevée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="danger">Description du danger *</Label>
              <Textarea
                id="danger"
                value={newRisk.danger}
                onChange={(e) => setNewRisk(prev => ({ ...prev, danger: e.target.value }))}
                placeholder="Décrivez le danger identifié..."
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="measures">Mesures de prévention *</Label>
              <Textarea
                id="measures"
                value={newRisk.measures}
                onChange={(e) => setNewRisk(prev => ({ ...prev, measures: e.target.value }))}
                placeholder="Décrivez les mesures de prévention à mettre en place..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddingRisk(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddRisk} disabled={addRiskMutation.isPending}>
              {addRiskMutation.isPending ? 'Ajout...' : 'Ajouter le risque'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition */}
      {editingRisk && (
        <Dialog open={!!editingRisk} onOpenChange={() => setEditingRisk(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier le risque</DialogTitle>
              <DialogDescription>
                Modifiez les détails de ce risque
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Type de risque</Label>
                <Input
                  id="edit-type"
                  value={editingRisk.type}
                  onChange={(e) => setEditingRisk(prev => prev ? { ...prev, type: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-gravity">Gravité</Label>
                <Select 
                  value={editingRisk.gravity} 
                  onValueChange={(value) => setEditingRisk(prev => prev ? { ...prev, gravity: value as Risk['gravity'] } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Faible">Faible</SelectItem>
                    <SelectItem value="Moyenne">Moyenne</SelectItem>
                    <SelectItem value="Élevée">Élevée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-danger">Description du danger</Label>
                <Textarea
                  id="edit-danger"
                  value={editingRisk.danger}
                  onChange={(e) => setEditingRisk(prev => prev ? { ...prev, danger: e.target.value } : null)}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-measures">Mesures de prévention</Label>
                <Textarea
                  id="edit-measures"
                  value={editingRisk.measures}
                  onChange={(e) => setEditingRisk(prev => prev ? { ...prev, measures: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRisk(null)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateRisk} disabled={updateRiskMutation.isPending}>
                {updateRiskMutation.isPending ? 'Modification...' : 'Modifier le risque'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}