import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Archive, Star, Users, MessageSquare, Mail, Copy, Edit } from "lucide-react";
import {
  fetchBroadcast,
  fetchBroadcastFeedback,
  sendBroadcast,
  updateBroadcast,
  AdminBroadcast,
  FeedbackWithUser,
} from "@/lib/adminBroadcasts";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminBroadcastDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [broadcast, setBroadcast] = useState<AdminBroadcast | null>(null);
  const [feedback, setFeedback] = useState<FeedbackWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!authLoading && !permLoading && user && id) {
      loadData();
      
      // Check if we should auto-open send dialog
      if (searchParams.get("send") === "true") {
        setShowSendConfirm(true);
      }
    }
  }, [authLoading, permLoading, user, id, searchParams]);

  async function loadData() {
    setLoading(true);
    try {
      const [broadcastData, feedbackData] = await Promise.all([
        fetchBroadcast(id!),
        fetchBroadcastFeedback(id!),
      ]);
      setBroadcast(broadcastData);
      setFeedback(feedbackData);
    } catch (error) {
      console.error("Error loading broadcast:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSend = async () => {
    if (!broadcast) return;
    
    setSending(true);
    setShowSendConfirm(false);
    
    try {
      const result = await sendBroadcast(broadcast.id);
      
      if (result.success) {
        toast({
          title: "Broadcast sent!",
          description: `${result.recipients_created} recipients, ${result.notifications_created} notifications, ${result.emails_sent} emails sent.`,
        });
        loadData();
      } else {
        toast({
          title: "Error sending broadcast",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast({
        title: "Error sending broadcast",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleArchive = async () => {
    if (!broadcast) return;
    
    setArchiving(true);
    try {
      await updateBroadcast(broadcast.id, { status: "archived" });
      toast({ title: "Broadcast archived" });
      loadData();
    } catch (error) {
      console.error("Error archiving:", error);
      toast({
        title: "Error archiving broadcast",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const copyQuote = (text: string, name: string) => {
    navigator.clipboard.writeText(`"${text}" — ${name}`);
    toast({ title: "Quote copied to clipboard" });
  };

  const getDisplayName = (f: FeedbackWithUser): string => {
    if (f.allow_name && f.profiles?.full_name) {
      return f.profiles.full_name;
    }
    if (f.profiles?.is_fieldrep) return "Anonymous Field Rep";
    if (f.profiles?.is_vendor_admin) return "Anonymous Vendor";
    return "Anonymous User";
  };

  const getUserRole = (f: FeedbackWithUser): string => {
    if (f.profiles?.is_fieldrep) return "Field Rep";
    if (f.profiles?.is_vendor_admin) return "Vendor";
    return "User";
  };

  if (authLoading || permLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
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

  if (!broadcast) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Broadcast not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/broadcasts")}>
              Back to Broadcasts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spotlightFeedback = feedback.filter((f) => f.allow_spotlight && (f.like_text || f.suggestion_text));
  const responseRate = broadcast.stats.sent > 0 
    ? ((broadcast.stats.responses / broadcast.stats.sent) * 100).toFixed(1) 
    : "0";

  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: feedback.filter((f) => f.rating === rating).length,
  }));

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/admin/broadcasts")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Broadcasts
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {broadcast.title}
            <Badge
              variant={broadcast.status === "sent" ? "default" : "outline"}
              className={broadcast.status === "sent" ? "bg-green-500/20 text-green-400" : ""}
            >
              {broadcast.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Created {format(new Date(broadcast.created_at), "MMM d, yyyy")}
            {broadcast.sent_at && (
              <> · Sent {format(new Date(broadcast.sent_at), "MMM d, yyyy h:mm a")}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {broadcast.status === "draft" && (
            <>
              <Button variant="outline" onClick={() => navigate(`/admin/broadcasts/${broadcast.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={() => setShowSendConfirm(true)} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : "Send Now"}
              </Button>
            </>
          )}
          {broadcast.status === "sent" && (
            <Button variant="outline" onClick={handleArchive} disabled={archiving}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Recipients
            </div>
            <p className="text-2xl font-bold mt-1">{broadcast.stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageSquare className="h-4 w-4" />
              Responses
            </div>
            <p className="text-2xl font-bold mt-1">{broadcast.stats.responses}</p>
            <p className="text-xs text-muted-foreground">{responseRate}% rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Star className="h-4 w-4 text-amber-400" />
              Avg Rating
            </div>
            <p className="text-2xl font-bold mt-1">
              {broadcast.stats.avg_rating !== null ? broadcast.stats.avg_rating.toFixed(1) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Mail className="h-4 w-4" />
              Spotlight Ready
            </div>
            <p className="text-2xl font-bold mt-1">{spotlightFeedback.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="responses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="responses">Responses ({feedback.length})</TabsTrigger>
          <TabsTrigger value="spotlight">Spotlight ({spotlightFeedback.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Responses Tab */}
        <TabsContent value="responses">
          {feedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No responses yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Rating distribution */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex gap-4 items-end">
                    {ratingDistribution.map(({ rating, count }) => (
                      <div key={rating} className="flex flex-col items-center gap-1">
                        <div className="text-sm text-muted-foreground">{count}</div>
                        <div
                          className="w-8 bg-primary/20 rounded-t"
                          style={{
                            height: `${Math.max(4, (count / Math.max(...ratingDistribution.map((r) => r.count))) * 60)}px`,
                          }}
                        />
                        <div className="flex items-center gap-0.5">
                          <span className="text-sm">{rating}</span>
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Responses table */}
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Likes</TableHead>
                      <TableHead>Dislikes</TableHead>
                      <TableHead>Suggestions</TableHead>
                      <TableHead>Spotlight</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{getDisplayName(f)}</div>
                            <div className="text-xs text-muted-foreground">{getUserRole(f)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {f.rating}
                            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 truncate" title={f.like_text || undefined}>
                          {f.like_text || "—"}
                        </TableCell>
                        <TableCell className="max-w-48 truncate" title={f.dislike_text || undefined}>
                          {f.dislike_text || "—"}
                        </TableCell>
                        <TableCell className="max-w-48 truncate" title={f.suggestion_text || undefined}>
                          {f.suggestion_text || "—"}
                        </TableCell>
                        <TableCell>
                          {f.allow_spotlight ? (
                            <Badge variant="secondary" className="text-xs">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(f.created_at), "MMM d")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Spotlight Tab */}
        <TabsContent value="spotlight">
          {spotlightFeedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No spotlight-ready quotes yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Users must opt-in to allow their feedback to be spotlighted.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {spotlightFeedback.map((f) => (
                <Card key={f.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= f.rating ? "text-amber-400 fill-amber-400" : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                        {f.like_text && (
                          <blockquote className="border-l-2 border-primary pl-4 italic text-foreground mb-3">
                            "{f.like_text}"
                          </blockquote>
                        )}
                        {f.suggestion_text && (
                          <p className="text-sm text-muted-foreground mb-3">
                            <strong>Suggestion:</strong> {f.suggestion_text}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          — {getDisplayName(f)} ({getUserRole(f)})
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyQuote(f.like_text || f.suggestion_text || "", getDisplayName(f))}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Broadcast Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p>{broadcast.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email Subject</Label>
                <p>{broadcast.email_subject || broadcast.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Message</Label>
                <p className="whitespace-pre-wrap">{broadcast.message_md}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">CTA Label</Label>
                <p>{broadcast.cta_label}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Audience</Label>
                <p>
                  Roles: {broadcast.audience.roles?.join(", ") || "All"}
                  {broadcast.audience.active_days && (
                    <> · Active in last {broadcast.audience.active_days} days</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send in-app notifications and emails to all matching users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Send Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`text-sm font-medium mb-1 ${className || ""}`}>{children}</div>;
}
