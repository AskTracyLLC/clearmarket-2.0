import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Send, Eye, Archive, Star, Users, MessageSquare } from "lucide-react";
import { fetchBroadcasts, AdminBroadcast } from "@/lib/adminBroadcasts";
import { format } from "date-fns";

export default function AdminBroadcasts() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !permLoading && user) {
      loadBroadcasts();
    }
  }, [authLoading, permLoading, user]);

  async function loadBroadcasts() {
    setLoading(true);
    try {
      const data = await fetchBroadcasts();
      setBroadcasts(data);
    } catch (error) {
      console.error("Error loading broadcasts:", error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || permLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!permissions.canManageBroadcasts) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredBroadcasts = broadcasts.filter((b) => {
    if (activeTab === "all") return true;
    if (activeTab === "draft") return b.status === "draft" || b.status === "scheduled";
    if (activeTab === "sent") return b.status === "sent" || b.status === "sending";
    if (activeTab === "archived") return b.status === "archived";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "sending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Sending</Badge>;
      case "sent":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Sent</Badge>;
      case "archived":
        return <Badge variant="outline" className="opacity-60">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback Broadcasts</h1>
          <p className="text-muted-foreground">Send feedback requests to users</p>
        </div>
        <Button onClick={() => navigate("/admin/broadcasts/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Broadcast
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No broadcasts found</p>
                {activeTab === "draft" && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/admin/broadcasts/new")}
                  >
                    Create your first broadcast
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredBroadcasts.map((broadcast) => (
              <Card
                key={broadcast.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/admin/broadcasts/${broadcast.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {broadcast.title}
                        {getStatusBadge(broadcast.status)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Created {format(new Date(broadcast.created_at), "MMM d, yyyy")}
                        {broadcast.sent_at && (
                          <> · Sent {format(new Date(broadcast.sent_at), "MMM d, yyyy h:mm a")}</>
                        )}
                      </p>
                    </div>
                    {broadcast.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/broadcasts/${broadcast.id}`);
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{broadcast.stats.sent} recipients</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>{broadcast.stats.responses} responses</span>
                    </div>
                    {broadcast.stats.avg_rating !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Star className="h-4 w-4 text-amber-400" />
                        <span>{broadcast.stats.avg_rating.toFixed(1)} avg</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                    {broadcast.message_md}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
