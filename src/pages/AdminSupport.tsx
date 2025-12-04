import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Send,
  Search,
  User,
  Lock,
  Clock,
  AlertTriangle,
  MessageSquare,
  X,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import {
  fetchAllTickets,
  fetchTicketMessages,
  addTicketMessage,
  updateTicketStatus,
  updateTicketPriority,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  getStatusInfo,
  getPriorityInfo,
  getCategoryLabelForTicket,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketStatus,
  type SupportTicketPriority,
  type SupportTicketCategory,
} from "@/lib/support";

interface TicketWithUser extends SupportTicket {
  userProfile?: {
    email: string;
    full_name: string | null;
    is_fieldrep: boolean;
    is_vendor_admin: boolean;
  };
  repProfile?: { anonymous_id: string | null };
  vendorProfile?: { anonymous_id: string | null; company_name: string | null };
}

export default function AdminSupport() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithUser | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Reply
  const [replyTab, setReplyTab] = useState<"reply" | "internal">("reply");
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Profile dialog
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (data?.is_admin) {
        setIsAdmin(true);
      } else {
        navigate("/dashboard");
      }
    }
    if (!loading && user) {
      checkAdmin();
    } else if (!loading && !user) {
      navigate("/signin");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadTickets();
    }
  }, [isAdmin]);

  async function loadTickets() {
    setLoadingTickets(true);
    const rawTickets = await fetchAllTickets();

    // Fetch user profiles
    const userIds = [...new Set(rawTickets.map((t) => t.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_fieldrep, is_vendor_admin")
      .in("id", userIds);

    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id")
      .in("user_id", userIds);

    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id, company_name")
      .in("user_id", userIds);

    const profilesMap = new Map(profiles?.map((p) => [p.id, p]));
    const repMap = new Map(repProfiles?.map((r) => [r.user_id, r]));
    const vendorMap = new Map(vendorProfiles?.map((v) => [v.user_id, v]));

    const enriched: TicketWithUser[] = rawTickets.map((t) => ({
      ...t,
      userProfile: profilesMap.get(t.user_id),
      repProfile: repMap.get(t.user_id),
      vendorProfile: vendorMap.get(t.user_id),
    }));

    setTickets(enriched);
    setLoadingTickets(false);
  }

  async function handleSelectTicket(ticket: TicketWithUser) {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    const msgs = await fetchTicketMessages(ticket.id);
    setTicketMessages(msgs);
    setLoadingMessages(false);
  }

  async function handleSendReply() {
    if (!user || !selectedTicket || !replyText.trim()) return;

    const isInternal = replyTab === "internal";
    setSendingReply(true);
    const { error } = await addTicketMessage(selectedTicket.id, user.id, replyText, isInternal);
    setSendingReply(false);

    if (error) {
      toast({ title: "Failed to send", description: error, variant: "destructive" });
      return;
    }

    // Update last_admin_reply_at if not internal
    if (!isInternal) {
      await supabase
        .from("support_tickets")
        .update({ last_admin_reply_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);
    }

    toast({ title: isInternal ? "Internal note added" : "Reply sent" });
    setReplyText("");

    const msgs = await fetchTicketMessages(selectedTicket.id);
    setTicketMessages(msgs);
    loadTickets();
  }

  async function handleStatusChange(status: SupportTicketStatus) {
    if (!selectedTicket) return;
    const { error } = await updateTicketStatus(selectedTicket.id, status, true);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    toast({ title: `Status changed to ${status}` });
    setSelectedTicket({ ...selectedTicket, status });
    loadTickets();
  }

  async function handlePriorityChange(priority: SupportTicketPriority) {
    if (!selectedTicket) return;
    const { error } = await updateTicketPriority(selectedTicket.id, priority);
    if (error) {
      toast({ title: "Failed to update priority", variant: "destructive" });
      return;
    }
    toast({ title: `Priority changed to ${priority}` });
    setSelectedTicket({ ...selectedTicket, priority });
    loadTickets();
  }

  // Filter tickets
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchSubject = t.subject.toLowerCase().includes(search);
      const matchEmail = t.userProfile?.email?.toLowerCase().includes(search);
      const matchAnonRep = t.repProfile?.anonymous_id?.toLowerCase().includes(search);
      const matchAnonVendor = t.vendorProfile?.anonymous_id?.toLowerCase().includes(search);
      const matchCompany = t.vendorProfile?.company_name?.toLowerCase().includes(search);
      if (!matchSubject && !matchEmail && !matchAnonRep && !matchAnonVendor && !matchCompany) return false;
    }
    return true;
  });

  function getAnonId(ticket: TicketWithUser): string {
    return ticket.repProfile?.anonymous_id || ticket.vendorProfile?.anonymous_id || "User";
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Support Queue</h1>
            <p className="text-muted-foreground">Manage support tickets from users</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Filters + List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by subject, email, ID..."
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {TICKET_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {TICKET_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      {TICKET_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Ticket List */}
            <Card className="h-[calc(100vh-300px)]">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">
                  {filteredTickets.length} Ticket{filteredTickets.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTickets ? (
                  <p className="p-4 text-muted-foreground text-sm">Loading...</p>
                ) : filteredTickets.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No tickets found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="divide-y">
                      {filteredTickets.map((ticket) => {
                        const statusInfo = getStatusInfo(ticket.status);
                        const isSelected = selectedTicket?.id === ticket.id;
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => handleSelectTicket(ticket)}
                            className={`p-3 cursor-pointer transition-colors ${
                              isSelected ? "bg-accent" : "hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{ticket.subject}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getAnonId(ticket)} · {ticket.userProfile?.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(ticket.created_at), "MMM d, h:mm a")}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </Badge>
                                {ticket.priority === "high" && (
                                  <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400">
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

          {/* Right: Ticket Detail */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <Card className="h-[calc(100vh-180px)] flex flex-col">
                {/* Ticket Header */}
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className={getStatusInfo(selectedTicket.status).color}>
                          {getStatusInfo(selectedTicket.status).label}
                        </Badge>
                        <span>·</span>
                        <span>{getCategoryLabelForTicket(selectedTicket.category as SupportTicketCategory)}</span>
                        {selectedTicket.priority === "high" && (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="bg-red-500/20 text-red-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              High Priority
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Requester Info */}
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{getAnonId(selectedTicket)}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedTicket.userProfile?.email} ·{" "}
                          {selectedTicket.userProfile?.is_fieldrep
                            ? "Field Rep"
                            : selectedTicket.userProfile?.is_vendor_admin
                            ? "Vendor"
                            : "User"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProfileUserId(selectedTicket.user_id);
                        setProfileDialogOpen(true);
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Profile
                    </Button>
                  </div>

                  {/* Status/Priority controls */}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Status:</Label>
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(v) => handleStatusChange(v as SupportTicketStatus)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Priority:</Label>
                      <Select
                        value={selectedTicket.priority}
                        onValueChange={(v) => handlePriorityChange(v as SupportTicketPriority)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
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
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full p-4">
                    {loadingMessages ? (
                      <p className="text-muted-foreground text-sm">Loading messages...</p>
                    ) : (
                      <div className="space-y-4">
                        {ticketMessages.map((msg) => {
                          const isUser = msg.sender_id === selectedTicket.user_id;
                          const isInternal = msg.is_internal_note;
                          return (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                isInternal
                                  ? "bg-yellow-500/10 border border-yellow-500/20 ml-8"
                                  : isUser
                                  ? "bg-muted border border-border mr-8"
                                  : "bg-primary/10 border border-primary/20 ml-8"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {isInternal && <Lock className="h-3 w-3 text-yellow-500" />}
                                <span className="text-xs font-medium">
                                  {isInternal ? "Internal Note" : isUser ? getAnonId(selectedTicket) : "Support"}
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
                </CardContent>

                {/* Reply Section */}
                <div className="p-4 border-t">
                  <Tabs value={replyTab} onValueChange={(v) => setReplyTab(v as "reply" | "internal")}>
                    <TabsList className="mb-3">
                      <TabsTrigger value="reply">Reply to User</TabsTrigger>
                      <TabsTrigger value="internal">Internal Note</TabsTrigger>
                    </TabsList>
                    <TabsContent value="reply" className="mt-0">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply to the user..."
                        rows={3}
                        maxLength={2000}
                      />
                    </TabsContent>
                    <TabsContent value="internal" className="mt-0">
                      <div className="flex items-center gap-2 mb-2 text-xs text-yellow-500">
                        <Lock className="h-3 w-3" />
                        <span>This note is visible only to admins</span>
                      </div>
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Add an internal note..."
                        rows={3}
                        maxLength={2000}
                      />
                    </TabsContent>
                  </Tabs>
                  <Button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="mt-3 w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingReply ? "Sending..." : replyTab === "internal" ? "Add Note" : "Send Reply"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="h-[calc(100vh-180px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a ticket to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
      {profileUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={profileUserId}
        />
      )}
    </div>
  );
}
