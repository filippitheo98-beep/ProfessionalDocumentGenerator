import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Search, 
  Calendar, 
  Building, 
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  Archive
} from 'lucide-react';
import { Link } from 'wouter';
import { Header } from '@/components/Header';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: number;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'expired' | 'draft';
  nextReviewDate: string;
  riskCount: number;
}

export default function Documents() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'draft'>('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const archiveMutation = useMutation({
    mutationFn: async (documentId: number) => {
      await apiRequest(`/api/duerp-documents/${documentId}/archive`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document archivé",
        description: "Le document a été archivé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'archiver le document",
        variant: "destructive",
      });
    },
  });

  const filteredDocuments = documents?.filter((doc: Document) => {
    const matchesSearch = doc.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'expired': return 'Expiré';
      case 'draft': return 'Brouillon';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Documents DUERP</h1>
            <p className="text-muted-foreground">
              Gérez vos Documents Uniques d'Évaluation des Risques Professionnels
            </p>
          </div>
          <Button asChild>
            <Link href="/duerp-generator">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau DUERP
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom d'entreprise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
              size="sm"
            >
              Tous
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('active')}
              size="sm"
            >
              Actifs
            </Button>
            <Button
              variant={statusFilter === 'expired' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('expired')}
              size="sm"
            >
              Expirés
            </Button>
            <Button
              variant={statusFilter === 'draft' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('draft')}
              size="sm"
            >
              Brouillons
            </Button>
          </div>
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-300 rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun document trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? "Aucun document ne correspond à vos critères de recherche."
                : "Vous n'avez pas encore créé de document DUERP."}
            </p>
            <Button asChild>
              <Link href="/duerp-generator">
                <Plus className="h-4 w-4 mr-2" />
                Créer votre premier DUERP
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc: Document) => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {doc.companyName}
                      </CardTitle>
                      <Badge className={`mt-2 ${getStatusColor(doc.status)}`}>
                        {getStatusLabel(doc.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Créé le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {doc.riskCount} risques identifiés
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Prochaine révision: {new Date(doc.nextReviewDate).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/duerp-generator?view=${doc.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Voir
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/duerp-generator?edit=${doc.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => archiveMutation.mutate(doc.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}