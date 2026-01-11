import { format } from "date-fns";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  getCategoryConfig, 
  getMetadataValue, 
  STATUS_VARIANTS, 
  getStatusLabel,
  QueueCategory,
  QueueStatus 
} from "@/config/supportQueueCategories";

export interface QueueItemData {
  id: string;
  category: string;
  title: string;
  preview: string | null;
  priority: "normal" | "urgent";
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
  assignee?: {
    id: string;
    full_name: string | null;
  } | null;
}

interface SupportQueueItemCardProps {
  item: QueueItemData;
  isSelected: boolean;
  onClick: () => void;
}

export function SupportQueueItemCard({ item, isSelected, onClick }: SupportQueueItemCardProps) {
  const categoryConfig = getCategoryConfig(item.category as QueueCategory);
  const statusVariant = STATUS_VARIANTS[item.status as QueueStatus] || "secondary";
  const statusLabel = getStatusLabel(item.status as QueueStatus);
  const IconComponent = categoryConfig.icon;
  
  // Get summary field values from metadata
  const summaryValues = categoryConfig.summaryFields.map(field => {
    let value = "—";
    if (field.metadataPath) {
      value = getMetadataValue(item.metadata || {}, field.metadataPath);
    }
    // Fall back to item properties
    if (value === "—" && field.key === "preview" && item.preview) {
      value = item.preview;
    }
    return { label: field.label, value };
  }).filter(sv => sv.value !== "—");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-md border transition-colors",
        isSelected
          ? "bg-accent border-accent-foreground/20"
          : "bg-card hover:bg-muted border-transparent"
      )}
    >
      {/* Row 1: Icon + Title + Priority Badge */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={categoryConfig.color}>
            <IconComponent className="h-4 w-4" />
          </span>
          <span className="font-medium text-sm truncate">{item.title}</span>
        </div>
        {item.priority === "urgent" && (
          <Badge variant="destructive" className="text-[10px] shrink-0">
            Urgent
          </Badge>
        )}
      </div>
      
      {/* Row 2: Summary fields (key metadata, 1-2 lines) */}
      {summaryValues.length > 0 && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-6">
          {summaryValues.map((sv, i) => (
            <span key={sv.label}>
              {sv.label}: {sv.value}
              {i < summaryValues.length - 1 && " · "}
            </span>
          ))}
        </p>
      )}
      
      {/* Row 3: Status pill + timestamp + assignee */}
      <div className="flex items-center gap-2 ml-6 flex-wrap">
        <Badge variant={statusVariant} className="text-[10px]">
          {statusLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(item.created_at), "MMM d, h:mm a")}
        </span>
        {item.assignee && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            {item.assignee.full_name || "Assigned"}
          </span>
        )}
      </div>
    </button>
  );
}
