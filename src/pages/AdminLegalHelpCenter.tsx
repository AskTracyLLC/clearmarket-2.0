import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, HelpCircle, BookOpen, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const legalItems = [
  {
    id: "tos",
    title: "Terms of Service",
    description: "Manage the platform Terms of Service agreement",
    icon: FileText,
    route: "/admin/legal-help/tos",
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    description: "Manage the Privacy Policy page",
    icon: Shield,
    route: "/admin/legal-help/privacy",
  },
  {
    id: "support",
    title: "Support Page",
    description: "Manage the Support page content",
    icon: HelpCircle,
    route: "/admin/legal-help/support",
  },
  {
    id: "help-articles",
    title: "Help Center Articles",
    description: "Manage FAQ and help documentation",
    icon: BookOpen,
    route: "/admin/help-articles",
  },
];

export default function AdminLegalHelpCenter() {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !permLoading) {
      if (!user) {
        navigate("/signin");
        return;
      }
      if (!permissions.canViewAdminDashboard) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setLoading(false);
    }
  }, [user, authLoading, permLoading, permissions, navigate, toast]);

  if (loading || authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <PageHeader
        title="Legal & Help Center"
        subtitle="Manage Terms of Service, Privacy Policy, Support page, and Help Center articles"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {legalItems.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => navigate(item.route)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center justify-between">
                  {item.title}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{item.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
