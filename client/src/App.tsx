/**
 * App.tsx — Roteamento por domínio
 *
 * shoop.permupay.com.br  → Vitrine pública (Marketplace, Desejos, Simulador)
 * autopay.permupay.com.br → Área logada (Dashboard, Produtos, Simulações, etc.)
 *
 * Em desenvolvimento (localhost) renderiza ambas as rotas normalmente.
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
import WishlistPublic from "./pages/WishlistPublic";
import WishlistAdmin from "./pages/WishlistAdmin";
import { ProtectedRoute } from "./components/ProtectedRoute";

// ─── Detecção de domínio ──────────────────────────────────────────────────────

const hostname = window.location.hostname;

const IS_STOREFRONT =
  hostname === "shoop.permupay.com.br" ||
  hostname.startsWith("shoop.");

const IS_PANEL =
  hostname === "autopay.permupay.com.br" ||
  hostname.startsWith("autopay.");

// Em localhost/dev: mostra tudo
const IS_DEV = !IS_STOREFRONT && !IS_PANEL;

// ─── Roteador da Vitrine (shoop.permupay.com.br) ─────────────────────────────

function StorefrontRouter() {
  return (
    <Switch>
      <Route path="/" component={Marketplace} />
      <Route path="/vitrine" component={Marketplace} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/desejos" component={WishlistPublic} />
      <Route>{() => <Marketplace />}</Route>
    </Switch>
  );
}

// ─── Roteador do Painel (autopay.permupay.com.br) ────────────────────────────

function PanelRouter() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />

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

      <Route path="/lotes/novo">
        {() => (
          <ProtectedRoute>
            <BatchPricing />
          </ProtectedRoute>
        )}
      </Route>

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

      <Route path="/desejos-admin">
        {() => (
          <ProtectedRoute>
            <WishlistAdmin />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── Roteador de Desenvolvimento (localhost) ──────────────────────────────────

function DevRouter() {
  return (
    <Switch>
      <Route path="/" component={Marketplace} />
      <Route path="/vitrine" component={Marketplace} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/desejos" component={WishlistPublic} />
      <Route path="/login" component={Login} />

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
      <Route path="/lotes/novo">
        {() => (
          <ProtectedRoute>
            <BatchPricing />
          </ProtectedRoute>
        )}
      </Route>
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
      <Route path="/desejos-admin">
        {() => (
          <ProtectedRoute>
            <WishlistAdmin />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────

export default function App() {
  const Router = IS_STOREFRONT
    ? StorefrontRouter
    : IS_PANEL
      ? PanelRouter
      : DevRouter;

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
