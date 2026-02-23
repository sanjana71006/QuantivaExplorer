import { Link } from "react-router-dom";
import { Atom } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeSelector from "@/components/ThemeSelector";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";

const LandingNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={quantivaLogo} alt="Quantiva Explorer" className="h-8 w-8 rounded-full" />
          <span className="font-display font-bold text-lg text-foreground">Quantiva Explorer</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Use Cases</a>
          <Link to="/exploration-lab" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            🧪 Exploration Lab
          </Link>
          <Link to="/dashboard">
            <Button size="sm" className="btn-glow gradient-primary text-primary-foreground font-semibold">
              Launch App
            </Button>
          </Link>
        </div>
        <ThemeSelector />
      </div>
    </nav>
  );
};

export default LandingNav;
