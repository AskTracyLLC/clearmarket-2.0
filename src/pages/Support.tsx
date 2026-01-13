import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, TicketPlus, MessageSquare, Paperclip, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
  createSupportCase,
  fetchUserSupportCases,
  getSupportCaseStatusInfo,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type UserSupportCase,
} from "@/lib/support";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { CountBadge } from "@/components/CountBadge";
import { SupportImageUpload } from "@/components/SupportImageUpload";

export default function Support() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const sectionCounts = useSectionCounts();

  const [cases, setCases] = useState<UserSupportCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  // New request form - prefill category from query param if valid
  const categoryParam = searchParams.get("category") as SupportTicketCategory | null;
  const validCategories: SupportTicketCategory[] = ["bug", "account", "billing", "feature", "other"];
  const initialCategory = categoryParam && validCategories.includes(categoryParam) ? categoryParam : "other";

  // Check for prefilled screenshot data from GlobalScreenshotButton
  const prefillData = (() => {
    try {
      const data = sessionStorage.getItem("prefill-support-screenshot");
      if (data) {
        sessionStorage.removeItem("prefill-support-screenshot");
        return JSON.parse(data) as { imageUrl: string; prefillMessage: string };
      }
    } catch {
      // ignore
    }
    return null;
  })();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>(initialCategory);
  const [message, setMessage] = useState(prefillData?.prefillMessage || "");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [attachedImages, setAttachedImages] = useState<string[]>(
    prefillData?.imageUrl ? [prefillData.imageUrl] : []
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user]);

  async function loadCases() {
    if (!user) return;
    setLoadingCases(true);
    const data = await fetchUserSupportCases(user.id);
    setCases(data);
    setLoadingCases(false);
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    
    // Use the case-based edge function
    const { data, error } = await createSupportCase(
      subject,
      message,
      category,
      priority,
      attachedImages
    );
    
    setSubmitting(false);

    if (error) {
      // Handle rate limiting with a friendly message
      if (error.error === 'rate_limited') {
        toast({ 
          title: "Please slow down", 
          description: error.message || "Too many support cases created. Please wait and try again.",
        });
        return;
      }
      
      toast({ title: "Failed to submit request", description: error.message || error.error, variant: "destructive" });
      return;
    }

    if (data) {
      // Show success toast with case ID
      const shortCaseId = data.caseId.slice(0, 8).toUpperCase();
      toast({ 
        title: "Request submitted", 
        description: `Case #${shortCaseId}`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/messages/${data.conversationId}`)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
        ),
      });
      
      // Reset form
      setSubject("");
      setCategory("other");
      setMessage("");
      setPriority("normal");
      setAttachedImages([]);
      
      // Refresh the cases list
      loadCases();
    }
  }

  function handleOpenCase(caseItem: UserSupportCase) {
    // Navigate directly to the message thread
    navigate(`/messages/${caseItem.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const openCasesCount = cases.filter(c => c.status === 'open' || c.status === 'in_progress').length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">Submit requests and view your support history</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/help")}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Help Center
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Submit New Request */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketPlus className="h-5 w-5" />
              Submit a Support Request
            </CardTitle>
            <CardDescription>
              Describe your issue and we'll get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as SupportTicketCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as SupportTicketPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  maxLength={4000}
                />
              </div>
              {/* Image upload */}
              {user && (
                <SupportImageUpload
                  userId={user.id}
                  images={attachedImages}
                  onImagesChange={setAttachedImages}
                />
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Your Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Your Requests
              <CountBadge count={sectionCounts.openSupportTickets || openCasesCount} className="ml-2" />
            </CardTitle>
            <CardDescription>
              {cases.length} total request{cases.length !== 1 ? "s" : ""}
              {openCasesCount > 0 && ` · ${openCasesCount} open`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCases ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : cases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No support requests yet</p>
                <p className="text-sm">Submit your first request using the form.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-2">
                  {cases.map((caseItem) => {
                    const statusInfo = getSupportCaseStatusInfo(caseItem.status);
                    return (
                      <div
                        key={caseItem.id}
                        onClick={() => handleOpenCase(caseItem)}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate">{caseItem.subject}</p>
                              {caseItem.hasAttachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {caseItem.topicLabel} ·{" "}
                              {format(new Date(caseItem.createdAt), "MMM d, yyyy")}
                            </p>
                            {caseItem.caseId && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Case #{caseItem.caseId.slice(0, 8).toUpperCase()}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge variant="outline" className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
                            {caseItem.priority === "high" && (
                              <Badge variant="outline" className="bg-red-500/20 text-red-400">
                                High
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}