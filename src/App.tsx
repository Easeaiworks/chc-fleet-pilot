import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import VehicleDetails from "./pages/VehicleDetails";
import UserRoles from "./pages/UserRoles";
import ExpenseApprovals from "./pages/ExpenseApprovals";
import Admin from "./pages/Admin";
import TireManagement from "./pages/TireManagement";
import VehicleInspection from "./pages/VehicleInspection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/vehicles/:id" element={<VehicleDetails />} />
          <Route path="/roles" element={<UserRoles />} />
          <Route path="/approvals" element={<ExpenseApprovals />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/tires" element={<TireManagement />} />
          <Route path="/inspections" element={<VehicleInspection />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
