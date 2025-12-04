import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Search from "./pages/Search";
import ProductResults from "./pages/ProductResults";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
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
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/results" element={<ProductResults />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={<Admin />}
                  // <ProtectedRoute>
                  //   <Admin />
                  // </ProtectedRoute>
              />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
