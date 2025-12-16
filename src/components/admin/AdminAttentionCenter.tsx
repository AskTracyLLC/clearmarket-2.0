import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ShieldAlert, Headphones, FileCheck, ClipboardList, FileText, Star } from "lucide-react";
import { AdminOverviewCounts } from "@/hooks/useAdminOverview";

interface AdminAttentionCenterProps {
  counts: AdminOverviewCounts;
  loading: boolean;
}

interface AttentionItem {
  count: number;
  label: string;
  singularLabel: string;
  href: string;
  icon: React.ReactNode;
}

export function AdminAttentionCenter({ counts, loading }: AdminAttentionCenterProps) {
  const items: AttentionItem[] = [
    {
      count: counts.moderation_pending,
      label: "moderation flags",
      singularLabel: "moderation flag",
      href: "/admin/moderation",
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
    },
    {
      count: counts.support_open,
      label: "support tickets",
      singularLabel: "support ticket",
      href: "/admin/support",
      icon: <Headphones className="w-4 h-4 text-blue-400" />,
    },
    {
      count: counts.background_checks_pending,
      label: "background checks",
      singularLabel: "background check",
      href: "/admin/background-checks",
      icon: <FileCheck className="w-4 h-4 text-amber-400" />,
    },
    {
      count: counts.checklist_stuck,
      label: "checklist issues",
      singularLabel: "checklist issue",
      href: "/admin/checklists?tab=feedback",
      icon: <ClipboardList className="w-4 h-4 text-amber-400" />,
    },
    {
      count: counts.reports_new,
      label: "new reports",
      singularLabel: "new report",
      href: "/admin/reports",
      icon: <FileText className="w-4 h-4 text-red-400" />,
    },
    {
      count: counts.reviews_pending,
      label: "pending reviews",
      singularLabel: "pending review",
      href: "/admin/review-settings",
      icon: <Star className="w-4 h-4 text-blue-400" />,
    },
  ];

  const activeItems = items.filter((item) => item.count > 0);
  const totalCount = activeItems.reduce((sum, item) => sum + item.count, 0);

  if (loading) {
    return (
      <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Items Requiring Your Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          Items Requiring Your Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {activeItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.icon}
                <span className="font-medium text-foreground">{item.count}</span>
                {item.count === 1 ? item.singularLabel : item.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
