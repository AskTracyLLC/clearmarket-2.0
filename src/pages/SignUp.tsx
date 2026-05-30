import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role");
  const roleLabel =
    role === "rep" ? "Field Rep" : role === "vendor" ? "Vendor" : "User";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <Link to="/" className="text-xl font-bold text-primary hover:underline">
            ClearMarket
          </Link>
          <div className="mt-6 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2 mt-4 text-foreground">
            Sign Ups Coming Soon
          </h1>
          <p className="text-muted-foreground">
            New {roleLabel} accounts are temporarily unavailable while we put
            the finishing touches on ClearMarket. Check back shortly.
          </p>
          <p className="text-xs text-secondary font-medium mt-3">Coming Soon</p>
        </div>

        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link to="/signin">Sign In Instead</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SignUp;
