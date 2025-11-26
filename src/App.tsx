import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import RoleSelection from "./pages/RoleSelection";
import Terms from "./pages/Terms";
import Dashboard from "./pages/Dashboard";
import RepProfile from "./pages/RepProfile";
import RepFindWork from "./pages/RepFindWork";
import VendorProfile from "./pages/VendorProfile";
import VendorFindReps from "./pages/VendorFindReps";
import VendorSeekingCoverage from "./pages/VendorSeekingCoverage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/onboarding/role" element={<RoleSelection />} />
            <Route path="/onboarding/terms" element={<Terms />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/rep/profile" element={<RepProfile />} />
            <Route path="/rep/find-work" element={<RepFindWork />} />
            <Route path="/vendor/profile" element={<VendorProfile />} />
            <Route path="/vendor/find-reps" element={<VendorFindReps />} />
            <Route path="/vendor/seeking-coverage" element={<VendorSeekingCoverage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
