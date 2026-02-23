import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Atom, Database, SlidersHorizontal, LineChart, Trophy, Settings, Menu, X, User, ChevronLeft, Home, FlaskConical } from "lucide-react";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";
import { Button } from "@/components/ui/button";
import ThemeSelector from "@/components/ThemeSelector";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dataset Selector", path: "/dashboard", icon: Database },
  { title: "Simulation Controls", path: "/dashboard/simulation", icon: SlidersHorizontal },
  { title: "Visualization", path: "/dashboard/visualization", icon: LineChart },
  { title: "Ranking Results", path: "/dashboard/results", icon: Trophy },
  { title: "🧪 Exploration Lab", path: "/exploration-lab", icon: FlaskConical },
  { title: "Settings", path: "/dashboard/settings", icon: Settings },
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border gap-3">
          <img src={quantivaLogo} alt="Quantiva Explorer" className="h-8 w-8 flex-shrink-0 rounded-full" />
          {sidebarOpen && (
            <span className="font-display font-bold text-foreground truncate">Quantiva Explorer</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary glow-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className={cn("flex-1 flex flex-col transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="font-display font-semibold text-foreground">
              Quantiva Explorer — Autonomous Drug Hunter
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                title="Return to Home"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <ThemeSelector />
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 molecular-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
