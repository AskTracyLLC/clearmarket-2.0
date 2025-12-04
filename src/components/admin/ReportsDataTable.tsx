import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Flag, MessageSquare, User, FileText, Eye, Star, Users } from "lucide-react";
import { ReportWithDetails } from "@/lib/adminReports";

interface ReportsDataTableProps {
  reports: ReportWithDetails[];
  onReportClick: (report: ReportWithDetails) => void;
  onViewProfile?: (userId: string) => void;
  onViewInUsers?: (userId: string) => void;
}

export function ReportsDataTable({ reports, onReportClick, onViewProfile, onViewInUsers }: ReportsDataTableProps) {
  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case "review":
        return <Star className="h-4 w-4" />;
      case "message":
        return <MessageSquare className="h-4 w-4" />;
      case "profile":
        return <User className="h-4 w-4" />;
      case "post":
        return <FileText className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      open: "destructive",
      in_review: "default",
      resolved: "secondary",
      dismissed: "outline",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 border border-border rounded-lg">
        <p className="text-muted-foreground">No reports found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[150px]">Reported On</TableHead>
            <TableHead className="w-[150px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTypeIcon(report.target_type)}
                  <span className="text-sm capitalize">
                    {report.target_type || "User"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <button
                    onClick={() => onViewProfile?.(report.reported_user_id)}
                    className="text-sm font-medium hover:underline text-left"
                  >
                    {report.reported.full_name || report.reported.email}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Reported by: {report.reporter.full_name || report.reporter.email}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-xs">
                  <p className="text-sm font-medium">{report.reason_category}</p>
                  {report.reason_details && (
                    <p className="text-xs text-muted-foreground truncate">
                      {report.reason_details}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(report.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(report.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewProfile?.(report.reported_user_id)}
                    title="View Public Profile"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewInUsers?.(report.reported_user_id)}
                    title="View in Users Admin"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReportClick(report)}
                  >
                    Review
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
