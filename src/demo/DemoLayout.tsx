import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Search,
  Users,
  MessageSquare,
  FileText,
  Map,
  LogOut,
  User,
  Building2,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoLayoutProps {
  children: ReactNode;
  role: "vendor" | "rep";
}

export function DemoLayout({ children, role }: DemoLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const vendorNavItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/demo/vendor" },
    { label: "Find Reps", icon: Search, path: "/demo/vendor/search" },
    { label: "Community", icon: MessageSquare, path: "/demo/vendor/community" },
    { label: "Coverage Map", icon: Map, path: "/demo/vendor/coverage-map" },
    { label: "Policies", icon: FileText, path: "/demo/vendor/policies" },
  ];

  const repNavItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/demo/rep" },
    { label: "My Profile", icon: User, path: "/demo/rep/profile" },
    { label: "Vendors", icon: Building2, path: "/demo/rep/vendors" },
    { label: "Community", icon: MessageSquare, path: "/demo/rep/community" },
    { label: "Coverage Map", icon: Map, path: "/demo/rep/coverage-map" },
  ];

  const navItems = role === "vendor" ? vendorNavItems : repNavItems;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Demo Banner */}
      <div className="bg-yellow-500 text-yellow-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4">
        <span>🎮 DEMO MODE — No real data, no payments</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/demo")}
          className="bg-yellow-400 border-yellow-600 text-yellow-950 hover:bg-yellow-300"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Exit Demo
        </Button>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card hidden md:block">
          <div className="p-4 border-b">
            <Link to="/demo" className="flex items-center gap-2">
              <span className="font-bold text-xl">ClearMarket</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                Demo
              </span>
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              {role === "vendor" ? "Vendor View" : "Field Rep View"}
            </p>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-4 right-4 md:left-0 md:w-64 p-4">
            <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  This is a demo. Actions like "Unlock Contact" simulate the real
                  experience without using credits or saving data.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50">
          <nav className="flex justify-around p-2">
            {navItems.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-md text-xs transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
