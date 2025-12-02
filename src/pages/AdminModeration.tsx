import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Flag, MessageSquare, User, FileText, AlertTriangle, BarChart3 } from "lucide-react";
import { fetchReportStats, fetchReportsByType, ReportWithDetails } from "@/lib/adminReports";
import { ReportDetailPanel } from "@/components/admin/ReportDetailPanel";
import { ReportsDataTable } from "@/components/admin/ReportsDataTable";
import { SafetyAnalyticsTab } from "@/components/admin/SafetyAnalyticsTab";
import { fetchSafetyAnalytics, SafetyAnalyticsData } from "@/lib/qualityAnalytics";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { toast } from "sonner";

export default function AdminModeration() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({ openReports: 0, flaggedReviews: 0, usersWithMultipleReports: 0 });
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [currentTab, setCurrentTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [safetyAnalytics, setSafetyAnalytics] = useState<SafetyAnalyticsData | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    checkAdminStatus();
  }, [user, authLoading, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      toast.error("Unauthorized", {
        description: "You don't have permission to access this page.",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await fetchReportStats();
      setStats(statsData);
      
      await loadReports();

      // Load safety analytics
      const analyticsData = await fetchSafetyAnalytics();
      setSafetyAnalytics(analyticsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    const targetType = currentTab === "all" ? undefined : currentTab;
    const status = statusFilter === "all" ? undefined : statusFilter;
    
    const data = await fetchReportsByType(targetType, status);
    setReports(data);
  };

  useEffect(() => {
    if (isAdmin) {
      loadReports();
    }
  }, [currentTab, statusFilter, isAdmin]);

  const handleReportClick = (report: ReportWithDetails) => {
    setSelectedReport(report);
  };

  const handleClosePanel = () => {
    setSelectedReport(null);
    loadData(); // Refresh data after panel closes
  };

  const filteredReports = reports.filter((report) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      report.reporter.email?.toLowerCase().includes(searchLower) ||
      report.reported.email?.toLowerCase().includes(searchLower) ||
      report.reason_category?.toLowerCase().includes(searchLower) ||
      report.reason_details?.toLowerCase().includes(searchLower)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Moderation Dashboard</h1>
            <p className="text-muted-foreground">Review and manage flagged content and user reports</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.openReports}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flagged Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.flaggedReviews}</div>
              <p className="text-xs text-muted-foreground mt-1">Reviews needing moderation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Multiple Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.usersWithMultipleReports}</div>
              <p className="text-xs text-muted-foreground mt-1">Users with 2+ reports</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Tabbed Content */}
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList>
            <TabsTrigger value="all">
              <Flag className="h-4 w-4 mr-2" />
              All Reports
            </TabsTrigger>
            <TabsTrigger value="review">
              <FileText className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="message">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profiles
            </TabsTrigger>
            <TabsTrigger value="post">
              <FileText className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Safety Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-6">
            {safetyAnalytics && (
              <SafetyAnalyticsTab 
                data={safetyAnalytics} 
                onViewProfile={(userId) => {
                  setProfileDialogUserId(userId);
                  setShowProfileDialog(true);
                }}
              />
            )}
          </TabsContent>

          <TabsContent value={currentTab} className="mt-6">
            {currentTab !== "analytics" && (
              <ReportsDataTable
                reports={filteredReports}
                onReportClick={handleReportClick}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Panel */}
      {selectedReport && (
        <ReportDetailPanel
          report={selectedReport}
          onClose={handleClosePanel}
        />
      )}

      {/* Profile Dialog */}
      {showProfileDialog && profileDialogUserId && (
        <PublicProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          targetUserId={profileDialogUserId}
        />
      )}
    </div>
  );
}
