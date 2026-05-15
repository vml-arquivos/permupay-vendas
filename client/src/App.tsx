/**
 * App.tsx — Atualizado com rotas de Lotes, Vitrine e Upload
 *
 * Substitui client/src/App.tsx
 */

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
import Marketplace from "./pages/Marketplace";
import BatchPricing from "./pages/BatchPricing";
import { ProtectedRoute } from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      {/* Rotas públicas */}
      <Route path="/" component={PricingSimulator} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/login" component={Login} />
      <Route path="/vitrine" component={Marketplace} />

      {/* Rotas protegidas */}
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/produtos">
        {() => (
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/produtos/novo">
        {() => (
          <ProtectedRoute>
            <ProductForm />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/produtos/:id/editar">
        {(params: any) => (
          <ProtectedRoute>
            <ProductForm id={Number(params.id)} />
          </ProtectedRoute>
        )}
      </Route>

      {/* Lotes de precificação */}
      <Route path="/lotes/novo">
        {() => (
          <ProtectedRoute>
            <BatchPricing />
          </ProtectedRoute>
        )}
      </Route>

      {/* Simulações */}
      <Route path="/simulacoes">
        {() => (
          <ProtectedRoute>
            <SimulationsExport />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/simulacoes/:id">
        {(params: any) => (
          <ProtectedRoute>
            <SimulationDetail id={Number(params.id)} />
          </ProtectedRoute>
        )}
      </Route>

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
