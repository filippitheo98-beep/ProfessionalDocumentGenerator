import { Bell, Building, FileText, Home, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = '/api/auth/logout';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Générateur DUERP</span>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <Button
              variant={location === '/' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className="transition-all"
            >
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
            <Button
              variant={location === '/duerp-generator' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/duerp-generator')}
              className="transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Générateur
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">Nouveau risque détecté</span>
                  <span className="text-xs text-muted-foreground">Il y a 2h</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  L'IA a identifié un nouveau risque pour le poste "Secrétaire"
                </p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">Sauvegarde automatique</span>
                  <span className="text-xs text-muted-foreground">Il y a 5h</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Votre DUERP "Vostra" a été sauvegardé automatiquement
                </p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">Mise à jour disponible</span>
                  <span className="text-xs text-muted-foreground">Hier</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  De nouvelles fonctionnalités d'analyse sont disponibles
                </p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}