import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Upload, ShieldCheck } from "lucide-react";

export default function OpsLayout() {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b bg-card">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <ShieldCheck className="h-6 w-6" />
                        <span>ClearCheck Ops</span>
                    </div>
                    <nav className="flex items-center gap-4">
                        <Link to="/ops/clearcheck">
                            <Button variant={isActive("/ops/clearcheck") ? "default" : "ghost"} size="sm">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Dashboard
                            </Button>
                        </Link>
                        <Link to="/ops/imports">
                            <Button variant={isActive("/ops/imports") ? "default" : "ghost"} size="sm">
                                <Upload className="mr-2 h-4 w-4" />
                                Imports
                            </Button>
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="flex-1 container mx-auto py-6 px-4">
                <Outlet />
            </main>
        </div>
    );
}
