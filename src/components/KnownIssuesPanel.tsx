import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// Hard-coded known issues for beta
const KNOWN_ISSUES = [
  {
    id: "email-notifications",
    title: "Email Notifications",
    description: "Email notifications are limited during beta. In-app notifications are fully functional.",
  },
];

export function KnownIssuesPanel() {
  if (KNOWN_ISSUES.length === 0) return null;

  return (
    <Card className="border-warning-border bg-warning-bg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-warning-icon">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-foreground">Known Issues &amp; Limitations</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2 text-sm">
          {KNOWN_ISSUES.map((issue) => (
            <li key={issue.id} className="flex items-start gap-2">
              <span className="text-warning-icon mt-1">•</span>
              <div>
                <span className="font-medium text-foreground">{issue.title}:</span>{" "}
                <span className="text-foreground/90">{issue.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
