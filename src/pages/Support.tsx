import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Send, HelpCircle, TicketPlus, RefreshCw, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import {
  createSupportTicket,
  fetchUserTickets,
  fetchTicketMessages,
  addTicketMessage,
  updateTicketStatus,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  getStatusInfo,
  getPriorityInfo,
  getCategoryLabelForTicket,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketCategory,
  type SupportTicketPriority,
} from "@/lib/support";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { CountBadge } from "@/components/CountBadge";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";

export default function Support() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sectionCounts = useSectionCounts();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("other");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  // Reply
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  async function loadTickets() {
    if (!user) return;
    setLoadingTickets(true);
    const data = await fetchUserTickets(user.id);
    setTickets(data);
    setLoadingTickets(false);
  }

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { ticket, error } = await createSupportTicket(user.id, subject, category, message, priority);
    setSubmitting(false);

    if (error) {
      toast({ title: "Failed to submit ticket", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Support request submitted", description: "We'll get back to you soon." });
    setSubject("");
    setCategory("other");
    setMessage("");
    setPriority("normal");
    loadTickets();
  }

  async function handleSelectTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    const msgs = await fetchTicketMessages(ticket.id);
    setTicketMessages(msgs);
    setLoadingMessages(false);
  }

  async function handleSendReply() {
    if (!user || !selectedTicket || !replyText.trim()) return;

    setSendingReply(true);
    const { error } = await addTicketMessage(selectedTicket.id, user.id, replyText, false);
    setSendingReply(false);

    if (error) {
      toast({ title: "Failed to send reply", description: error, variant: "destructive" });
      return;
    }

    setReplyText("");
    // Refresh messages
    const msgs = await fetchTicketMessages(selectedTicket.id);
    setTicketMessages(msgs);
    loadTickets();
  }

  async function handleReopenTicket() {
    if (!selectedTicket) return;
    const { error } = await updateTicketStatus(selectedTicket.id, "open");
    if (error) {
      toast({ title: "Failed to reopen ticket", variant: "destructive" });
      return;
    }
    toast({ title: "Ticket reopened" });
    loadTickets();
    setSelectedTicket({ ...selectedTicket, status: "open" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
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
          {/* Submit New Ticket */}
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
              <form onSubmit={handleSubmitTicket} className="space-y-4">
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
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={5}
                    maxLength={2000}
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Your Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Your Requests
                <CountBadge count={sectionCounts.openSupportTickets} className="ml-2" />
              </CardTitle>
              <CardDescription>
                {tickets.length} total request{tickets.length !== 1 ? "s" : ""}
                {sectionCounts.openSupportTickets > 0 && ` · ${sectionCounts.openSupportTickets} open`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTickets ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No support requests yet</p>
                  <p className="text-sm">Submit your first request using the form.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {tickets.map((ticket) => {
                      const statusInfo = getStatusInfo(ticket.status);
                      const priorityInfo = getPriorityInfo(ticket.priority);
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => handleSelectTicket(ticket)}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{ticket.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {getCategoryLabelForTicket(ticket.category)} ·{" "}
                                {format(new Date(ticket.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                              {ticket.priority === "high" && (
                                <Badge variant="outline" className={priorityInfo.color}>
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

        {/* Ticket Detail Sheet */}
        <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <SheetContent className="w-full sm:max-w-lg">
            {selectedTicket && (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedTicket.subject}</SheetTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className={getStatusInfo(selectedTicket.status).color}>
                      {getStatusInfo(selectedTicket.status).label}
                    </Badge>
                    <span>·</span>
                    <span>{getCategoryLabelForTicket(selectedTicket.category)}</span>
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}</span>
                  </div>
                </SheetHeader>

                <div className="mt-6 flex flex-col h-[calc(100vh-200px)]">
                  {/* Messages */}
                  <ScrollArea className="flex-1 pr-2">
                    {loadingMessages ? (
                      <p className="text-muted-foreground text-sm">Loading messages...</p>
                    ) : (
                      <div className="space-y-4">
                        {ticketMessages.map((msg) => {
                          const isYou = msg.sender_id === user?.id;
                          return (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                isYou
                                  ? "bg-primary/10 border border-primary/20 ml-4"
                                  : "bg-muted border border-border mr-4"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {isYou ? "You" : "Support"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(msg.created_at), "MMM d, h:mm a")}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Reply Section */}
                  {selectedTicket.status !== "closed" ? (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                        maxLength={2000}
                      />
                      <Button
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sendingReply ? "Sending..." : "Send Reply"}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-3">
                        This ticket is closed. Need more help?
                      </p>
                      <Button variant="outline" onClick={handleReopenTicket}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reopen Ticket
                      </Button>
                    </div>
                  )}

                  {selectedTicket.status === "resolved" && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={handleReopenTicket}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reopen Ticket
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AuthenticatedLayout>
  );
}
