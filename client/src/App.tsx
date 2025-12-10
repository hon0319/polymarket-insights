import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import Dashboard from "./pages/Dashboard";
import WhaleTrades from "./pages/WhaleTrades";
import AddressLeaderboard from "./pages/AddressLeaderboard";
import AddressDetail from "./pages/AddressDetail";
import Subscriptions from "./pages/Subscriptions";
import Notifications from "./pages/Notifications";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/markets"} component={Markets} />
      <Route path={"/market/:id"} component={MarketDetail} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/whale-trades"} component={WhaleTrades} />
      <Route path={"/addresses"} component={AddressLeaderboard} />
      <Route path={"/address/:id"} component={AddressDetail} />
      <Route path={"/subscriptions"} component={Subscriptions} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
