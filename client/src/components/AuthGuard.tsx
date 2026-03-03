import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Si true, autorise l'accès même quand mustChangePassword (pour la page /change-password) */
  allowIfMustChangePassword?: boolean;
}

/**
 * Redirige vers /login si l'utilisateur n'est pas connecté.
 * Si mustChangePassword, redirige vers /change-password (sauf si allowIfMustChangePassword).
 */
export function AuthGuard({ children, allowIfMustChangePassword }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const [path, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!allowIfMustChangePassword && (user as { mustChangePassword?: boolean }).mustChangePassword && path !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user, isLoading, navigate, allowIfMustChangePassword, path]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
