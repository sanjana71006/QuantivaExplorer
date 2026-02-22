import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import Landing from "./pages/Landing";
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DatasetSelection />} />
              <Route path="simulation" element={<SimulationControls />} />
              <Route path="visualization" element={<Visualization />} />
              <Route path="results" element={<Results />} />
              <Route path="settings" element={<DashboardSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <QuantivaAssistant />
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
