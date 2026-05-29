import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import HomePage from "./pages/Home.tsx";
import AuthPage from "./pages/Auth.tsx";
import DashboardCustomerPage from "./pages/DashboardCustomer.tsx";
import DashboardAgentPage from "./pages/DashboardAgent.tsx";
import PublicBuyPage from "./pages/PublicBuy.tsx";
import PublicTrackPage from "./pages/PublicTrack.tsx";
import AdminPage from "./pages/Admin.tsx";
import AgentDashboardPage from "./pages/AgentDashboard.tsx";
import AgentStorePage from "./pages/AgentStore.tsx";
import DashboardProfilePage from "./pages/DashboardProfile.tsx";
import PaymentCallbackPage from "./pages/PaymentCallback.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useAuth } from "@/contexts/AuthContext";

const DashboardIndex = () => {
  const { roles } = useAuth();
  if (roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (roles.includes("agent")) return <Navigate to="/agent" replace />;
  return <Navigate to="/dashboard/customer" replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/buy" element={<PublicBuyPage />} />
              <Route path="/track" element={<PublicTrackPage />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardIndex /></RequireAuth>} />
              <Route path="/dashboard/customer" element={<RequireAuth><DashboardCustomerPage /></RequireAuth>} />
              <Route path="/dashboard/buy" element={<RequireAuth><Navigate to="/buy" replace /></RequireAuth>} />
              <Route path="/dashboard/track" element={<RequireAuth><Navigate to="/track" replace /></RequireAuth>} />
              <Route path="/dashboard/agent" element={<RequireAuth><DashboardAgentPage /></RequireAuth>} />
              <Route path="/dashboard/profile" element={<RequireAuth><DashboardProfilePage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
              <Route path="/agent" element={<RequireAuth role="agent"><AgentDashboardPage /></RequireAuth>} />
              <Route path="/store/:slug" element={<AgentStorePage />} />
              <Route path="/payment/callback" element={<PaymentCallbackPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
