import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute, SuperAdminRoute } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { StoreProvider } from "@/contexts/StoreContext";
import Landing from "./pages/Landing";
import Search from "./pages/Search";
import ProductResults from "./pages/ProductResults";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import SuperAdmin from "./pages/SuperAdmin";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import AdminInviteCallback from "./pages/AdminInviteCallback";
import SetPassword from "./pages/SetPassword";
import SetPasswordStore from "./pages/SetPasswordStore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
          <AuthProvider>
            <StoreProvider>
              <Routes>
                {/* Landing page */}
                <Route path="/" element={<Landing />} />

                {/* Kiosk routes - public facing for each store */}
                <Route path="/kiosk/:storeId" element={<Search />} />
                <Route path="/kiosk/:storeId/results" element={<ProductResults />} />

                {/* Auth routes */}
                <Route path="/login" element={<Login />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route path="/team/login" element={<SuperAdminLogin />} />
                <Route path="/team/set-password" element={<SetPassword />} />
                <Route path="/admin/set-password" element={<SetPasswordStore />} />
                <Route path="/admin-invite-callback" element={<AdminInviteCallback />} />
                <Route
                  path="/team"
                  element={
                    <SuperAdminRoute>
                      <SuperAdmin />
                    </SuperAdminRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </StoreProvider>
          </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
