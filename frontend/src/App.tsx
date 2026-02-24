import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { GlobalExplorationProvider } from "./context/GlobalExplorationContext";
import { useSettings } from "./hooks/useSettings";
import Landing from "./pages/Landing";
import MolecularPortal from "./pages/MolecularPortal";
import ExplorationLab from "./pages/ExplorationLab";
import DashboardLayout from "./components/DashboardLayout";
import DatasetSelection from "./pages/DatasetSelection";
import SimulationControls from "./pages/SimulationControls";
import Visualization from "./pages/Visualization";
import Results from "./pages/Results";
import DashboardSettings from "./pages/DashboardSettings";
import NotFound from "./pages/NotFound";
import QuantivaAssistant from "./components/QuantivaAssistant";

const queryClient = new QueryClient();

function AppContent() {
  const { settings, isLoaded } = useSettings();

  useEffect(() => {
    if (isLoaded) {
      // Apply theme on startup
      const html = document.documentElement;
      if (settings.theme.colorTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
      } else {
        html.classList.toggle('dark', settings.theme.colorTheme === 'dark');
      }

      // Apply font size
      const fontSizeMap = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg',
        xlarge: 'text-xl',
      };
      html.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');
      html.classList.add(fontSizeMap[settings.theme.fontSize]);

      // Apply animations preference globally
      if (!settings.general.enableAnimations) {
        html.style.setProperty('--disable-animations', '1');
      } else {
        html.style.removeProperty('--disable-animations');
      }

      // Apply font size via CSS variable for better cascade
      const fontSizeValues = {
        small: '14px',
        medium: '16px',
        large: '18px',
        xlarge: '20px',
      };
      html.style.fontSize = fontSizeValues[settings.theme.fontSize];
    }
  }, [isLoaded, settings]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/molecular-portal" element={<MolecularPortal />} />
        <Route path="/exploration-lab" element={<ExplorationLab />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DatasetSelection />} />
          <Route path="simulation" element={<SimulationControls />} />
          <Route path="visualization" element={<Visualization />} />
          <Route path="results" element={<Results />} />
          <Route path="settings" element={<DashboardSettings />} />
        </Route>
        {/* Convenience redirects */}
        <Route path="/visualization" element={<Navigate to="/dashboard/visualization" replace />} />
        <Route path="/simulation" element={<Navigate to="/dashboard/simulation" replace />} />
        <Route path="/results" element={<Navigate to="/dashboard/results" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <GlobalExplorationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
          <QuantivaAssistant />
        </TooltipProvider>
      </GlobalExplorationProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
