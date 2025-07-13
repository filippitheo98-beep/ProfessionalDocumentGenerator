import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Risk } from "@shared/simpleSchema";

interface RiskTableProps {
  risks: Risk[];
  showSource?: boolean;
}

export default function RiskTable({ risks, showSource = false }: RiskTableProps) {
  const getGravityColor = (gravity: string) => {
    switch (gravity) {
      case 'Faible': return 'bg-green-100 text-green-800';
      case 'Moyenne': return 'bg-yellow-100 text-yellow-800';
      case 'Élevée': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'Rare': return 'bg-green-100 text-green-800';
      case 'Occasionnel': return 'bg-yellow-100 text-yellow-800';
      case 'Hebdomadaire': return 'bg-yellow-100 text-yellow-800';
      case 'Quotidien': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getControlColor = (control: string) => {
    switch (control) {
      case 'Élevée': return 'bg-green-100 text-green-800';
      case 'Moyenne': return 'bg-yellow-100 text-yellow-800';
      case 'Faible': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFinalRiskColor = (risk: string) => {
    switch (risk) {
      case 'Faible': return 'bg-green-100 text-green-800';
      case 'Moyen': return 'bg-yellow-100 text-yellow-800';
      case 'Important': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (risks.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-slate-900 mb-3">Évaluation des risques professionnels</h4>
        <p className="text-sm text-slate-600">Aucun risque généré. Cliquez sur "Générer les risques" pour analyser cette unité de travail.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg p-4 mb-6">
      <h4 className="font-medium text-slate-900 mb-3">Évaluation des risques professionnels</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {showSource && <TableHead className="font-medium text-slate-700">Source</TableHead>}
              <TableHead className="font-medium text-slate-700">Risque</TableHead>
              <TableHead className="font-medium text-slate-700">Danger potentiel</TableHead>
              <TableHead className="font-medium text-slate-700">Gravité</TableHead>
              <TableHead className="font-medium text-slate-700">Fréquence</TableHead>
              <TableHead className="font-medium text-slate-700">Maîtrise</TableHead>
              <TableHead className="font-medium text-slate-700">Risque final</TableHead>
              <TableHead className="font-medium text-slate-700">Mesures existantes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => (
              <TableRow key={risk.id} className="hover:bg-slate-50">
                {showSource && (
                  <TableCell className="font-medium text-slate-900">
                    <Badge variant="outline" className={risk.sourceType === 'Lieu' ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'}>
                      {risk.sourceType}: {risk.source}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="font-medium text-slate-900">{risk.type}</TableCell>
                <TableCell className="text-slate-700">{risk.danger}</TableCell>
                <TableCell>
                  <Badge className={getGravityColor(risk.gravity)} variant="secondary">
                    {risk.gravity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getFrequencyColor(risk.frequency)} variant="secondary">
                    {risk.frequency}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getControlColor(risk.control)} variant="secondary">
                    {risk.control}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getFinalRiskColor(risk.finalRisk)} variant="secondary">
                    {risk.finalRisk}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-700">{risk.measures}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
