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
import { CommandPalette } from "./components/CommandPalette";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { PreferencesDialogContext } from "./contexts/PreferencesDialogContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import { PageTransition } from "./components/PageTransition";

const queryClient = new QueryClient();

const Shell = () => {
  const [prefsOpen, setPrefsOpen] = useState(false);
  return (
    <PreferencesDialogContext.Provider value={{ open: () => setPrefsOpen(true) }}>
      <ScrollToTop />
      <PageTransition>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/minha-carteira" element={<ProtectedRoute><MinhaCarteira /></ProtectedRoute>} />
          <Route path="/tv" element={<ProtectedRoute><Tv /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
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
          <AuthProvider>
            <NotificationsProvider>
              <DealDrawerProvider>
                <Shell />
              </DealDrawerProvider>
            </NotificationsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PreferencesProvider>
  </QueryClientProvider>
);

export default App;
