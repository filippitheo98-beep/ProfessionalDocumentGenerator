import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Shield,
  Target,
  Activity,
  FileText
} from 'lucide-react';
import type { Risk } from '@shared/schema';

interface AnalyticsStepProps {
  risks: Risk[];
  companyName: string;
  onSave: () => void;
  onGeneratePDF: () => void;
  locations: any[];
  workStations: any[];
  preventionMeasures: any[];
}

const COLORS = {
  'Faible': '#10B981',
  'Moyen': '#F59E0B',
  'Important': '#EF4444'
};

const RISK_TYPE_COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#EF4444',
  '#6B7280'
];

export default function AnalyticsStep({ risks, companyName, onSave, onGeneratePDF, locations, workStations, preventionMeasures }: AnalyticsStepProps) {
  // Données pour le graphique en barres (par niveau de risque)
  const riskLevelData = [
    {
      name: 'Faible',
      count: risks.filter(r => r.finalRisk === 'Faible').length,
      color: COLORS['Faible']
    },
    {
      name: 'Moyen',
      count: risks.filter(r => r.finalRisk === 'Moyen').length,
      color: COLORS['Moyen']
    },
    {
      name: 'Important',
      count: risks.filter(r => r.finalRisk === 'Important').length,
      color: COLORS['Important']
    }
  ];

  // Données pour le graphique en secteurs (par type de risque)
  const riskTypeData = risks.reduce((acc, risk) => {
    const existing = acc.find(item => item.name === risk.type);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: risk.type, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Données pour le graphique par source
  const sourceData = risks.reduce((acc, risk) => {
    const source = risk.source || 'Non spécifié';
    const existing = acc.find(item => item.name === source);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: source, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Calculer les statistiques
  const totalRisks = risks.length;
  const highRisks = risks.filter(r => r.finalRisk === 'Important').length;
  const mediumRisks = risks.filter(r => r.finalRisk === 'Moyen').length;
  const lowRisks = risks.filter(r => r.finalRisk === 'Faible').length;
  const riskScore = Math.round(((highRisks * 3 + mediumRisks * 2 + lowRisks * 1) / totalRisks) * 100) || 0;

  // Top 5 des types de risques les plus fréquents
  const topRiskTypes = riskTypeData
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (totalRisks === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analyse des risques
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="text-muted-foreground">
              Aucun risque à analyser. Générez d'abord les risques à l'étape précédente.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{totalRisks}</div>
                <div className="text-sm text-muted-foreground">Total risques</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">{highRisks}</div>
                <div className="text-sm text-muted-foreground">Risques importants</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">{mediumRisks}</div>
                <div className="text-sm text-muted-foreground">Risques moyens</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold text-purple-600">{riskScore}%</div>
                <div className="text-sm text-muted-foreground">Score de risque</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique en barres - Répartition par niveau */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition des risques par niveau</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskLevelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value} risques`, 'Nombre']}
                labelFormatter={(label) => `Niveau : ${label}`}
              />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique en secteurs - Types de risques */}
        <Card>
          <CardHeader>
            <CardTitle>Types de risques</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RISK_TYPE_COLORS[index % RISK_TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} risques`, 'Nombre']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique par source */}
        <Card>
          <CardHeader>
            <CardTitle>Risques par source</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourceData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip 
                  formatter={(value) => [`${value} risques`, 'Nombre']}
                  labelFormatter={(label) => `Source : ${label}`}
                />
                <Bar dataKey="value" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 des types de risques */}
      <Card>
        <CardHeader>
          <CardTitle>Types de risques les plus fréquents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topRiskTypes.map((riskType, index) => (
              <div key={riskType.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <span className="font-medium">{riskType.name}</span>
                </div>
                <Badge variant="secondary">
                  {riskType.value} risque{riskType.value > 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommandations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recommandations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {highRisks > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-400">
                    Action prioritaire
                  </span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {highRisks} risque{highRisks > 1 ? 's' : ''} important{highRisks > 1 ? 's' : ''} identifié{highRisks > 1 ? 's' : ''}. 
                  Mettre en place des mesures de prévention immédiates.
                </p>
              </div>
            )}
            
            {mediumRisks > 0 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-yellow-700 dark:text-yellow-400">
                    Surveillance recommandée
                  </span>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-300">
                  {mediumRisks} risque{mediumRisks > 1 ? 's' : ''} moyen{mediumRisks > 1 ? 's' : ''} à surveiller. 
                  Planifier des mesures préventives.
                </p>
              </div>
            )}
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-400">
                  Objectif
                </span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                Réviser ce document DUERP au moins une fois par an et après tout changement significatif.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bouton de génération PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Générer le rapport DUERP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Générez le rapport DUERP complet avec toutes les informations de l'entreprise, 
              les graphiques d'analyse et le tableau détaillé des risques.
            </p>
            
            <div className="flex gap-4">
              <Button onClick={onGeneratePDF} size="lg" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Générer le rapport PDF complet
              </Button>
              
              <Button onClick={onSave} variant="outline" size="lg">
                Sauvegarder les données
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}