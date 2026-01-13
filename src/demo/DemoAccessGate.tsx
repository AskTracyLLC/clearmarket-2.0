import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const DEMO_ACCESS_CODE = "asktracy";

interface DemoAccessGateProps {
  children: ReactNode;
}

export function DemoAccessGate({ children }: DemoAccessGateProps) {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Check if already unlocked from session
  useEffect(() => {
    const savedAccess = sessionStorage.getItem("demo_access");
    if (savedAccess === "granted") {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (accessCode.toLowerCase().trim() === DEMO_ACCESS_CODE) {
      sessionStorage.setItem("demo_access", "granted");
      setIsUnlocked(true);
    } else {
      setError("Invalid access code. Please try again.");
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">
            ClearMarket
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/signin">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Access Code Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Demo Access</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Enter the access code to view the ClearMarket demo
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  placeholder="Enter code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full">
                Access Demo
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Don't have a code?{" "}
              <a href="mailto:support@clearmarket.io" className="text-primary hover:underline">
                Contact us
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
