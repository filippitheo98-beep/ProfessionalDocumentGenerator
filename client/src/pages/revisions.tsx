import { RevisionNotifications } from '@/components/RevisionNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/Header';

export default function Revisions() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Révisions DUERP</h1>
            <p className="text-muted-foreground mt-2">
              Gérez le suivi des révisions annuelles de vos documents d'évaluation des risques
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Révisions en retard
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Documents dépassant la date limite
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                À réviser sous 30 jours
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Notifications à envoyer
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Révisions à jour
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Documents conformes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Prochaine révision
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">
                Plus proche échéance
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations légales</CardTitle>
            <CardDescription>
              Cadre réglementaire des révisions DUERP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Obligation légale</h4>
                <p className="text-sm text-muted-foreground">
                  Selon l'article R4121-2 du Code du travail, le DUERP doit être mis à jour au moins une fois par an.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Déclencheurs de révision</h4>
                <p className="text-sm text-muted-foreground">
                  La révision est obligatoire en cas de modification des conditions de travail ou d'accident du travail.
                </p>
              </div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Rappel :</strong> Ce système vous notifie automatiquement 30 jours avant l'échéance annuelle 
                pour vous laisser le temps de réviser et mettre à jour vos documents.
              </p>
            </div>
          </CardContent>
        </Card>

        <RevisionNotifications />
      </div>
      </div>
    </div>
  );
}