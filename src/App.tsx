import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import MinhaCarteira from "./pages/MinhaCarteira.tsx";
import Tv from "./pages/Tv.tsx";
import Admin from "./pages/Admin.tsx";
import SetPassword from "./pages/SetPassword.tsx";
import { DealDrawerProvider } from "./contexts/DealDrawer";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { AreaProvider } from "./contexts/AreaContext";
import { CommandPalette } from "./components/CommandPalette";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { PreferencesDialogContext } from "./contexts/PreferencesDialogContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminOnlyRoute } from "./components/AdminOnlyRoute";
import ScrollToTop from "./components/ScrollToTop";
import { PageTransition } from "./components/PageTransition";
import { TutorialProvider } from "./contexts/TutorialContext";
import SucessoDashboard from "./pages/sucesso/Dashboard";
import SucessoChurn from "./pages/sucesso/Churn";
import SucessoClientes from "./pages/sucesso/Clientes";
import SucessoLista from "./pages/sucesso/Lista";
import SucessoKanban from "./pages/sucesso/Kanban";
import SucessoGestor from "./pages/sucesso/AreaGestor";
import SucessoConfig from "./pages/sucesso/Config";
import SucessoMgm from "./pages/sucesso/Mgm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const Shell = () => {
  const [prefsOpen, setPrefsOpen] = useState(false);
  return (
    <PreferencesDialogContext.Provider value={{ open: () => setPrefsOpen(true) }}>
      <ScrollToTop />
      <PageTransition>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/acesso-dash" element={<SetPassword />} />
          <Route path="/" element={<ProtectedRoute viewerAllowed><Index /></ProtectedRoute>} />
          <Route path="/minha-carteira" element={<ProtectedRoute><MinhaCarteira /></ProtectedRoute>} />
          <Route path="/tv" element={<ProtectedRoute><Tv /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/sucesso" element={<ProtectedRoute><AdminOnlyRoute><SucessoDashboard /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/churn" element={<ProtectedRoute><AdminOnlyRoute><SucessoChurn /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/clientes" element={<ProtectedRoute><AdminOnlyRoute><SucessoClientes /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/lista" element={<ProtectedRoute><AdminOnlyRoute><SucessoLista /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/kanban" element={<ProtectedRoute><AdminOnlyRoute><SucessoKanban /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/gestor" element={<ProtectedRoute><AdminOnlyRoute><SucessoGestor /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/config" element={<ProtectedRoute><AdminOnlyRoute><SucessoConfig /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="/sucesso/mgm" element={<ProtectedRoute><AdminOnlyRoute><SucessoMgm /></AdminOnlyRoute></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>
      <CommandPalette onOpenPreferences={() => setPrefsOpen(true)} />
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </PreferencesDialogContext.Provider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PreferencesProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AreaProvider>
            <AuthProvider>
              <NotificationsProvider>
                <DealDrawerProvider>
                  <TutorialProvider>
                    <Shell />
                  </TutorialProvider>
                </DealDrawerProvider>
              </NotificationsProvider>
            </AuthProvider>
          </AreaProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PreferencesProvider>
  </QueryClientProvider>
);

export default App;
