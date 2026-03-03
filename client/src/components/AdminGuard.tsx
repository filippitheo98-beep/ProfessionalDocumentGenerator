import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "./AuthGuard";
import { useToast } from "@/hooks/use-toast";

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Protège les routes admin : doit être connecté ET avoir le rôle admin.
 * Utilise AuthGuard en interne, puis vérifie le rôle.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;
    if (user && (user as { role?: string }).role !== "admin") {
      toast({
        title: "Accès refusé",
        description: "Cette page est réservée aux administrateurs.",
        variant: "destructive",
      });
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate, toast]);

  return (
    <AuthGuard>
      {user && (user as { role?: string }).role === "admin" ? children : null}
    </AuthGuard>
  );
}
