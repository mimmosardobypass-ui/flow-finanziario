import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Scadenziario from "./pages/Scadenziario";
import Conti from "./pages/Conti";
import Bilancio from "./pages/Bilancio";
import Regole from "./pages/Regole";
import RiconciliazioneIntelligente from "./pages/RiconciliazioneIntelligente";
import FattureFornitori from "./pages/FattureFornitori";
import ImportTransazioni from "./pages/ImportTransazioni";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Transactions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Categories />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scadenziario"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Scadenziario />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conti"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Conti />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bilancio"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Bilancio />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/regole"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Regole />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/riconciliazione-intelligente"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RiconciliazioneIntelligente />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import-transazioni"
              element={
                <ProtectedRoute>
                  <ImportTransazioni />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
