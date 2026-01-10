import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Inbox, Star, ShieldAlert, FileCheck, Flag, Headphones, AlertTriangle } from "lucide-react";
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
  // All items now link to the Support Queue with category filters
  const items: AttentionItem[] = [
    {
      count: counts.reviews,
      label: "pending reviews",
      singularLabel: "pending review",
      href: "/admin/support-queue?category=reviews",
      icon: <Star className="w-4 h-4 text-amber-400" />,
    },
    {
      count: counts.moderation,
      label: "moderation flags",
      singularLabel: "moderation flag",
      href: "/admin/support-queue?category=moderation",
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
    },
    {
      count: counts.user_reports,
      label: "user reports",
      singularLabel: "user report",
      href: "/admin/support-queue?category=user_reports",
      icon: <Flag className="w-4 h-4 text-orange-400" />,
    },
    {
      count: counts.background_checks,
      label: "background checks",
      singularLabel: "background check",
      href: "/admin/support-queue?category=background_checks",
      icon: <FileCheck className="w-4 h-4 text-blue-400" />,
    },
    {
      count: counts.support_tickets,
      label: "support tickets",
      singularLabel: "support ticket",
      href: "/admin/support-queue?category=support_tickets",
      icon: <Headphones className="w-4 h-4 text-purple-400" />,
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
          {counts.urgent > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-normal ml-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {counts.urgent} urgent
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quick link to full queue */}
        <Link
          to="/admin/support-queue"
          className="flex items-center gap-2 text-sm text-primary hover:underline mb-3"
        >
          <Inbox className="w-4 h-4" />
          Open Support Queue ({counts.total} total)
        </Link>
        
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
