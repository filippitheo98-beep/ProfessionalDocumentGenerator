import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DuerpGenerator from "@/pages/duerp-generator";
import NewDuerpGenerator from "@/pages/new-duerp-generator";
import Home from "@/pages/home";
import Documents from "@/pages/documents";
import Archives from "@/pages/archives";
import Collaborators from "@/pages/collaborators";
import Reports from "@/pages/reports";
import Revisions from "@/pages/revisions";
import { ThemeProvider } from "./components/ThemeProvider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/duerp-generator" component={NewDuerpGenerator} />
      <Route path="/old-duerp-generator" component={DuerpGenerator} />
      <Route path="/documents" component={Documents} />
      <Route path="/archives" component={Archives} />
      <Route path="/collaborators" component={Collaborators} />
      <Route path="/reports" component={Reports} />
      <Route path="/revisions" component={Revisions} />
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
