import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Páginas públicas
import Marketplace from "./pages/Marketplace";
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

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

function Router() {
  return (
    <Switch>
      {/* Públicas */}
      <Route path="/" component={Marketplace} />
      <Route path="/vitrine" component={Marketplace} />
      <Route path="/login" component={Login} />
      <Route path="/simulador" component={PricingSimulator} />
      <Route path="/desejos" component={WishlistPublic} />

      {/* Dashboard */}
      <Route path="/dashboard">{() => <P><Dashboard /></P>}</Route>

      {/* Produtos */}
      <Route path="/produtos">{() => <P><Products /></P>}</Route>
      <Route path="/produtos/novo">{() => <P><ProductForm /></P>}</Route>
      <Route path="/produtos/:id/editar">
        {() => <P><ProductForm /></P>}
      </Route>

      {/* Estoque */}
      <Route path="/estoque">{() => <P><Estoque /></P>}</Route>

      {/* Simulações */}
      <Route path="/simulacoes">{() => <P><SimulationsExport /></P>}</Route>
      <Route path="/simulacoes/:id">
        {(params: any) => <P><SimulationDetail id={Number(params.id)} /></P>}
      </Route>

      {/* Lotes */}
      <Route path="/lotes">{() => <P><BatchPricing /></P>}</Route>
      <Route path="/lotes/novo">{() => <P><BatchPricing /></P>}</Route>

      {/* Relatórios */}
      <Route path="/relatorios">{() => <P><Relatorios /></P>}</Route>

      {/* Lista de Desejos Admin */}
      <Route path="/desejos-admin">{() => <P><WishlistAdmin /></P>}</Route>

      {/* Admin */}
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
