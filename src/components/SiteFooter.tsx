import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/60 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          {/* Left side - Links */}
          <nav className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <Link 
              to="/support" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </Link>
            <Link 
              to="/help" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Help Center
            </Link>
            <Link 
              to="/terms" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              to="/privacy" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>

          {/* Right side - Copyright */}
          <div className="flex flex-col items-center md:items-end gap-1 text-center md:text-right">
            <p className="text-xs text-muted-foreground">
              © 2025 ClearMarket. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Questions? hello@useclearmarket.io
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
