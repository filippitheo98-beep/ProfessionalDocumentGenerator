import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Building, 
  CheckCircle, 
  FileText, 
  TrendingUp, 
  Users 
} from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalCompanies: number;
    totalDocuments: number;
    pendingActions: number;
    completedActions: number;
    riskScore: number;
    expiringSoon: number;
  };
  risks?: any[];
}

export function StatsCards({ stats, risks = [] }: StatsCardsProps) {
  const riskSeverityCount = risks.reduce((acc, risk) => {
    const severity = risk.finalRisk?.toLowerCase() || 'unknown';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const completionRate = stats.totalDocuments > 0 
    ? Math.round((stats.completedActions / (stats.completedActions + stats.pendingActions)) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
      <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Entreprises</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCompanies}</div>
          <p className="text-xs text-muted-foreground">
            Documents créés
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documents DUERP</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalDocuments}</div>
          <p className="text-xs text-muted-foreground">
            Total générés
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Actions en cours</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingActions}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-orange-600">{stats.expiringSoon} expire(nt) bientôt</span>
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taux de completion</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completionRate}%</div>
          <Progress value={completionRate} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {stats.completedActions} actions terminées
          </p>
        </CardContent>
      </Card>

      {risks.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4 transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Répartition des risques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {riskSeverityCount.faible && (
                <Badge variant="secondary" className="risk-low">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Faible: {riskSeverityCount.faible}
                </Badge>
              )}
              {riskSeverityCount.moyen && (
                <Badge variant="secondary" className="risk-medium">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Moyen: {riskSeverityCount.moyen}
                </Badge>
              )}
              {riskSeverityCount.important && (
                <Badge variant="secondary" className="risk-high">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Important: {riskSeverityCount.important}
                </Badge>
              )}
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                Total: {risks.length} risques
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}