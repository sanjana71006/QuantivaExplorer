import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { GlobalExplorationProvider } from "./context/GlobalExplorationContext";
import Landing from "./pages/Landing";
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

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <GlobalExplorationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<Landing />} />
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
          <QuantivaAssistant />
        </TooltipProvider>
      </GlobalExplorationProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
