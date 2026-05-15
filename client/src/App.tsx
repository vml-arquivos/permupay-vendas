import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PricingSimulator from "./pages/PricingSimulator";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import SimulationsExport from "./pages/SimulationsExport";
import SimulationDetail from "./pages/SimulationDetail";

function Router() {
  return (
    <Switch>
      {/* Rota raiz "/" agora abre o simulador público para evitar erro 401 */}
      <Route path="/" component={PricingSimulator} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/produtos" component={Products} />
      <Route path="/produtos/novo">{() => <ProductForm />}</Route>
      <Route path="/produtos/:id/editar">{(params: any) => <ProductForm id={Number(params.id)} />}</Route>
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/simulacoes" component={SimulationsExport} />
      <Route path="/simulacoes/:id">{(params: any) => <SimulationDetail id={Number(params.id)} />}</Route>
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
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
