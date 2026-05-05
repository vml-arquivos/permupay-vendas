import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PricingSimulator from "./pages/PricingSimulator";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Simulations from "./pages/Simulations";
import SimulationDetail from "./pages/SimulationDetail";
import Dashboard from "./pages/Dashboard";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/produtos"} component={Products} />
      <Route path={"/produtos/novo"} component={()=><ProductForm />} />
      <Route path={"/produtos/:id/editar"} component={(p:any)=><ProductForm id={Number(p.id)} />} />
      <Route path={"/simulador"} component={PricingSimulator} />
      <Route path={"/simulacoes"} component={Simulations} />
      <Route path={"/simulacoes/:id"} component={(p:any)=><SimulationDetail id={Number(p.id)} />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
