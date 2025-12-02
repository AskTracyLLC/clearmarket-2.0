import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface SoftWarningBannerProps {
  message: string;
  type: "reports" | "reviews";
}

export function SoftWarningBanner({ message, type }: SoftWarningBannerProps) {
  return (
    <Alert className="border-orange-500/50 bg-orange-500/10 mb-6">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-sm text-foreground">
        <strong className="font-medium">Heads up:</strong> {message}
      </AlertDescription>
    </Alert>
  );
}
