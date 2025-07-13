import { Bell, Building, FileText, Home, Settings, Users, TrendingUp, Shield, Archive } from 'lucide-react';
import { RevisionNotifications } from './RevisionNotifications';
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

export function Header() {
  const [location, navigate] = useLocation();

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
              <Shield className="h-4 w-4 mr-2" />
              Générateur
            </Button>
            <Button
              variant={location === '/documents' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/documents')}
              className="transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </Button>
            <Button
              variant={location === '/archives' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/archives')}
              className="transition-all"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archives
            </Button>
            <Button
              variant={location === '/collaborators' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/collaborators')}
              className="transition-all"
            >
              <Users className="h-4 w-4 mr-2" />
              Équipe
            </Button>
            <Button
              variant={location === '/reports' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/reports')}
              className="transition-all"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Rapports
            </Button>
            <Button
              variant={location === '/revisions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/revisions')}
              className="transition-all"
            >
              <Shield className="h-4 w-4 mr-2" />
              Révisions
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications de révision */}
          <RevisionNotifications showInHeader={true} />

          <ThemeToggle />

          {/* Menu Paramètres */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                Générateur DUERP
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}