import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PricingSimulator from "./pages/PricingSimulator";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={PricingSimulator} />
      <Route path={"/simulador"} component={PricingSimulator} />
      <Route path={"/login"} component={Login} />
      <Route path={"/dashboard"} component={PricingSimulator} />
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
