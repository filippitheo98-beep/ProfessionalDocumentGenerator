import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import NewDuerpGenerator from "@/pages/new-duerp-generator";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Documents from "@/pages/documents";
import Revisions from "@/pages/revisions";
import RiskLibraryManagement from "@/pages/RiskLibraryManagement";
import { ThemeProvider } from "./components/ThemeProvider";

// Router simplifié : plus d'auth Replit, on expose directement
// le tableau de bord et le générateur en local.
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/duerp-generator" component={NewDuerpGenerator} />
      <Route path="/documents" component={Documents} />
      <Route path="/revisions" component={Revisions} />
      <Route path="/risk-library" component={RiskLibraryManagement} />
      {/* Page de présentation accessible manuellement si besoin */}
      <Route path="/landing" component={Landing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="duerp-theme">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
