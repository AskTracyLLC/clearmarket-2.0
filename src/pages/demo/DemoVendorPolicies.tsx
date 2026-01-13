import { DemoAppShell } from "@/demo/DemoAppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, AlertTriangle, Info, CreditCard, Shield } from "lucide-react";

export default function DemoVendorPolicies() {
  return (
    <DemoAppShell role="vendor">
      <div className="container mx-auto py-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Policies & Support</h1>
          <p className="text-muted-foreground">
            Important information about refunds, chargebacks, and getting help
          </p>
        </div>

        <Alert>
          <Mail className="h-4 w-4" />
          <AlertTitle>Need Help?</AlertTitle>
          <AlertDescription>
            Contact our support team at{" "}
            <a
              href="mailto:support@clearmarket.io"
              className="font-medium underline"
            >
              support@clearmarket.io
            </a>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Refund Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Most fees on ClearMarket are <strong>non-refundable</strong> once
              access has been delivered (e.g., contact information unlocked).
            </p>

            <div className="space-y-2">
              <p className="font-medium">Refunds may be considered for:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Outdated or incorrect contact information</li>
                <li>Duplicate charges</li>
                <li>Failed boosts or promotional features</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Refund requests must be submitted within 7 days of the transaction.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Chargeback Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Filing a chargeback with your bank <strong>without first contacting ClearMarket support</strong> may result in:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Immediate account suspension</li>
              <li>Permanent ban from the platform</li>
              <li>Loss of any remaining credits</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              We encourage you to reach out to support first — we're here to help resolve any issues.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Connection Disputes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              ClearMarket is a networking platform. Once a connection is made between
              a Vendor and Field Rep, ClearMarket does not mediate disputes related to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Work quality or completion</li>
              <li>Payment between parties</li>
              <li>Scheduling conflicts</li>
              <li>Contract terms negotiated outside the platform</li>
            </ul>
          </CardContent>
        </Card>

        <Alert variant="default" className="bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Mode</AlertTitle>
          <AlertDescription>
            This is a demo view of ClearMarket's policies. No real transactions
            or credits are involved in demo mode.
          </AlertDescription>
        </Alert>
      </div>
    </DemoAppShell>
  );
}
