import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import ThemeSelector from "@/components/ThemeSelector";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={quantivaLogo} alt="Quantiva Explorer" className="h-8 w-8 rounded-full" />
            <span className="font-display font-bold text-lg text-foreground">Quantiva Explorer</span>
          </Link>
          <ThemeSelector />
        </div>
      </header>

      {/* 404 Content */}
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="mb-4 text-6xl font-bold text-primary">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <Link to="/" className="text-primary underline hover:text-primary/90 font-semibold">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
