import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BadgeVariant = "pending" | "urgent" | "info";

interface AdminDashboardTileProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  badgeCount?: number;
  badgeVariant?: BadgeVariant;
}

const badgeStyles: Record<BadgeVariant, string> = {
  pending: "bg-amber-600/30 text-amber-200",
  urgent: "bg-red-600/30 text-red-200",
  info: "bg-blue-600/30 text-blue-200",
};

export function AdminDashboardTile({
  title,
  description,
  icon,
  onClick,
  badgeCount,
  badgeVariant = "pending",
}: AdminDashboardTileProps) {
  const showBadge = badgeCount !== undefined && badgeCount > 0;

  return (
    <Card
      className="hover:border-primary transition-colors cursor-pointer relative"
      onClick={onClick}
    >
      {showBadge && (
        <span
          className={cn(
            "absolute top-2 right-2 rounded-full px-2 py-[2px] text-[11px] font-medium",
            badgeStyles[badgeVariant]
          )}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
