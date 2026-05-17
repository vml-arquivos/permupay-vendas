import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

// Páginas públicas
import Marketplace from "./pages/Marketplace";
import ProductPage from "./pages/ProductPage";
import Login from "./pages/Login";
import PricingSimulator from "./pages/PricingSimulator";
import WishlistPublic from "./pages/WishlistPublic";

// Páginas protegidas
import Dashboard from "./pages/Dashboard";
import WishlistAdmin from "./pages/WishlistAdmin";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import SimulationsExport from "./pages/SimulationsExport";
import SimulationDetail from "./pages/SimulationDetail";
import BatchPricing from "./pages/BatchPricing";
import Estoque from "./pages/Estoque";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";

/**
 * PL = Protected + Layout
 *
 * Envolve o conteúdo com ProtectedRoute (autenticação) e DashboardLayout (menu lateral).
 * Páginas que já importam DashboardLayout internamente (Estoque, Relatorios, etc.)
 * receberão um DashboardLayout duplo — para evitar isso, essas páginas devem ser
 * migradas para não usar DashboardLayout internamente. Por ora, usamos apenas PL
 * para as páginas que NÃO têm DashboardLayout interno.
 */
const PL = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

/**
 * P = Protected only
 *
 * Para páginas que JÁ têm DashboardLayout interno (Estoque, Relatorios, Usuarios,
 * Configuracoes, WishlistAdmin) — evita duplicação do layout.
 */
const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

function Router() {
  return (
    <Switch>
      {/* ── PÚBLICAS ──────────────────────────────────────────────────── */}
      <Route path="/" component={Marketplace} />
      <Route path="/vitrine" component={Marketplace} />
      <Route path="/vitrine/:id" component={ProductPage} />
      <Route path="/login" component={Login} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/desejos" component={WishlistPublic} />

      {/* ── DASHBOARD (sem DashboardLayout interno) ───────────────────── */}
      <Route path="/dashboard">{() => <PL><Dashboard /></PL>}</Route>

      {/* ── PRODUTOS (sem DashboardLayout interno) ────────────────────── */}
      <Route path="/produtos">{() => <PL><Products /></PL>}</Route>
      <Route path="/produtos/novo">{() => <PL><ProductForm /></PL>}</Route>
      <Route path="/produtos/:id/editar">{() => <PL><ProductForm /></PL>}</Route>

      {/* ── ESTOQUE (tem DashboardLayout interno) ─────────────────────── */}
      <Route path="/estoque">{() => <P><Estoque /></P>}</Route>

      {/* ── SIMULAÇÕES (sem DashboardLayout interno) ──────────────────── */}
      <Route path="/simulacoes">{() => <P><SimulationsExport /></P>}</Route>
      <Route path="/simulacoes/:id">
        {(params: any) => <PL><SimulationDetail id={Number(params.id)} /></PL>}
      </Route>

      {/* ── LOTES (sem DashboardLayout interno) ───────────────────────── */}
      <Route path="/lotes">{() => <PL><BatchPricing /></PL>}</Route>
      <Route path="/lotes/novo">{() => <PL><BatchPricing /></PL>}</Route>

      {/* ── RELATÓRIOS (tem DashboardLayout interno) ──────────────────── */}
      <Route path="/relatorios">{() => <P><Relatorios /></P>}</Route>

      {/* ── LISTA DE DESEJOS ADMIN (tem DashboardLayout interno) ──────── */}
      <Route path="/desejos-admin">{() => <P><WishlistAdmin /></P>}</Route>

      {/* ── ADMIN (tem DashboardLayout interno) ───────────────────────── */}
      <Route path="/usuarios">{() => <P><Usuarios /></P>}</Route>
      <Route path="/configuracoes">{() => <P><Configuracoes /></P>}</Route>

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
