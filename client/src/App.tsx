import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PricingSimulator from "./pages/PricingSimulator";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Simulations from "./pages/Simulations";
import SimulationDetail from "./pages/SimulationDetail";
import SimulationsExport from "./pages/SimulationsExport";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

function ProtectedRoute({ component: Component, ...props }: { component: React.ComponentType<any>, [key: string]: any }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <Component {...props} />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"} component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path={"/dashboard"} component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path={"/produtos"} component={() => <ProtectedRoute component={Products} />} />
      <Route path={"/produtos/novo"} component={() => <ProtectedRoute component={() => <ProductForm />} />} />
      <Route path={"/produtos/:id/editar"} component={(p: any) => <ProtectedRoute component={() => <ProductForm id={Number(p.params.id)} />} />} />
      <Route path={"/simulador"} component={() => <ProtectedRoute component={PricingSimulator} />} />
      <Route path={"/simulacoes"} component={() => <ProtectedRoute component={Simulations} />} />
      <Route path={"/simulacoes/exportar"} component={() => <ProtectedRoute component={SimulationsExport} />} />
      <Route path={"/simulacoes/:id"} component={(p: any) => <ProtectedRoute component={() => <SimulationDetail id={Number(p.params.id)} />} />} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
