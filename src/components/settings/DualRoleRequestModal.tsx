import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Shield, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DualRoleRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Entity type values must match DB constraint exactly: 'LLC', 'Corporation', 'Sole Proprietor', 'Partnership', 'Other'
const ENTITY_TYPES = [
  { value: "LLC", label: "LLC" },
  { value: "Corporation", label: "Corporation" },
  { value: "Sole Proprietor", label: "Sole Proprietor" },
  { value: "Partnership", label: "Partnership" },
  { value: "Other", label: "Other" },
];

export function DualRoleRequestModal({ open, onOpenChange, onSuccess }: DualRoleRequestModalProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Required fields
  const [businessName, setBusinessName] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [officeEmail, setOfficeEmail] = useState("");

  // Optional fields
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [entityType, setEntityType] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [einLast4, setEinLast4] = useState("");
  const [bbbUrl, setBbbUrl] = useState("");
  const [message, setMessage] = useState("");
  const [requestedCode, setRequestedCode] = useState("");

  // GL Insurance
  const [submitGl, setSubmitGl] = useState(false);
  const [glExpiresOn, setGlExpiresOn] = useState<Date | undefined>(undefined);

  function resetForm() {
    setBusinessName("");
    setOfficePhone("");
    setOfficeEmail("");
    setBusinessCity("");
    setBusinessState("");
    setWebsiteUrl("");
    setLinkedinUrl("");
    setEntityType("");
    setYearEstablished("");
    setEinLast4("");
    setBbbUrl("");
    setMessage("");
    setRequestedCode("");
    setSubmitGl(false);
    setGlExpiresOn(undefined);
  }

  function validateUrl(url: string): boolean {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit() {
    if (!user) return;

    // Validate required fields
    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!officePhone.trim()) {
      toast.error("Office phone is required");
      return;
    }
    if (!officeEmail.trim()) {
      toast.error("Office email is required");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(officeEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate URLs
    if (websiteUrl && !validateUrl(websiteUrl)) {
      toast.error("Please enter a valid website URL");
      return;
    }
    if (linkedinUrl && !validateUrl(linkedinUrl)) {
      toast.error("Please enter a valid LinkedIn URL");
      return;
    }
    if (bbbUrl && !validateUrl(bbbUrl)) {
      toast.error("Please enter a valid BBB URL");
      return;
    }

    // Validate GL expiration if GL is checked
    if (submitGl && !glExpiresOn) {
      toast.error("GL expiration date is required when submitting for verification");
      return;
    }

    // Validate EIN last 4
    if (einLast4 && !/^\d{0,4}$/.test(einLast4)) {
      toast.error("EIN last 4 must be 4 digits or less");
      return;
    }

    // Validate requested code (optional, 3-5 uppercase letters only)
    const trimmedCode = requestedCode.trim().toUpperCase();
    if (trimmedCode && !/^[A-Z]{3,5}$/.test(trimmedCode)) {
      toast.error("Requested code must be 3-5 letters only");
      return;
    }

    // Compose finalMessage with BBB URL appended
    let finalMessage = message.trim();
    if (bbbUrl.trim()) {
      if (finalMessage) {
        finalMessage = `${finalMessage}\nBBB: ${bbbUrl.trim()}`;
      } else {
        finalMessage = `BBB: ${bbbUrl.trim()}`;
      }
    }

    setSubmitting(true);
    try {
      const insertData: {
        user_id: string;
        business_name: string;
        office_phone: string;
        office_email: string;
        request_vendor: boolean;
        business_city?: string;
        business_state?: string;
        website_url?: string;
        linkedin_url?: string;
        entity_type?: string;
        year_established?: number;
        ein_last4?: string;
        message?: string;
        requested_code?: string;
        gl_expires_on?: string;
        gl_status?: "none" | "submitted" | "verified" | "rejected";
      } = {
        user_id: user.id,
        business_name: businessName.trim(),
        office_phone: officePhone.trim(),
        office_email: officeEmail.trim(),
        request_vendor: true,
      };

      // Add optional fields if provided
      if (businessCity.trim()) insertData.business_city = businessCity.trim();
      if (businessState.trim()) insertData.business_state = businessState.trim();
      if (websiteUrl.trim()) insertData.website_url = websiteUrl.trim();
      if (linkedinUrl.trim()) insertData.linkedin_url = linkedinUrl.trim();
      if (entityType) insertData.entity_type = entityType;
      if (yearEstablished) {
        const year = parseInt(yearEstablished, 10);
        if (!isNaN(year) && year >= 1900 && year <= new Date().getFullYear()) {
          insertData.year_established = year;
        }
      }
      if (einLast4.trim()) insertData.ein_last4 = einLast4.trim();
      if (finalMessage) insertData.message = finalMessage;
      if (trimmedCode) insertData.requested_code = trimmedCode;

      // GL Insurance
      if (submitGl && glExpiresOn) {
        insertData.gl_expires_on = format(glExpiresOn, "yyyy-MM-dd");
        insertData.gl_status = "submitted";
      }

      // 1. Insert the dual role request first
      const { data: requestData, error } = await supabase
        .from("dual_role_access_requests")
        .insert([insertData])
        .select("id")
        .single();

      if (error) {
        // Handle unique constraint error for pending requests
        if (error.code === "23505" || error.message.includes("unique") || error.message.includes("pending")) {
          toast.error("You already have a pending Dual Role request.");
        } else {
          toast.error("Failed to submit request", { description: error.message });
        }
        return;
      }

      // 2. Create a support conversation thread for admin follow-up
      const requestId = requestData.id;
      
      // Build a detailed support message with all request info
      const supportMessageParts = [
        `**Dual Role Access Request**`,
        ``,
        `**Business Information:**`,
        `• Business Name: ${businessName.trim()}`,
        `• Office Phone: ${officePhone.trim()}`,
        `• Office Email: ${officeEmail.trim()}`,
      ];
      
      if (businessCity.trim() || businessState.trim()) {
        supportMessageParts.push(`• Location: ${[businessCity.trim(), businessState.trim()].filter(Boolean).join(", ")}`);
      }
      if (entityType) {
        supportMessageParts.push(`• Entity Type: ${entityType}`);
      }
      if (yearEstablished) {
        supportMessageParts.push(`• Year Established: ${yearEstablished}`);
      }
      if (trimmedCode) {
        supportMessageParts.push(`• Requested Vendor Code: ${trimmedCode}`);
      }
      if (submitGl && glExpiresOn) {
        supportMessageParts.push(`• GL Insurance: Submitted (expires ${format(glExpiresOn, "yyyy-MM-dd")})`);
      }
      if (message.trim()) {
        supportMessageParts.push(``, `**Additional Notes:**`, message.trim());
      }
      
      const supportMessage = supportMessageParts.join("\n");

      try {
        const response = await supabase.functions.invoke("create-support-case", {
          body: {
            topic: "dual_role_access",
            subject: `Dual Role Request: ${businessName.trim()}`,
            message: supportMessage,
            priority: "normal",
            dualRoleRequestId: requestId, // Edge function will link conversation_id using service role
          },
        });

        console.log("create-support-case response:", response);

        if (response.error) {
          console.error("Edge function error:", response.error);
          toast.warning("Request submitted, but support thread could not be created.", {
            description: "Admin will still see your request.",
          });
        } else if (response.data?.conversationId) {
          console.log("Linked conversation_id:", response.data.conversationId);
        } else {
          console.warn("No conversationId in response:", response.data);
        }
      } catch (threadErr) {
        console.error("Failed to create support thread (non-blocking):", threadErr);
        toast.warning("Request submitted, but support thread could not be created.");
      }

      toast.success("Request submitted", {
        description: "We'll review your request and notify you of the decision. Check Messages for updates.",
      });
      resetForm();
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Request Dual Role Access
          </DialogTitle>
          <DialogDescription>
            Submit your business information to request Vendor access. This allows you to switch between Field Rep and Vendor dashboards.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-2">
            {/* Required Fields */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Business Information</h4>
              
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestedCode">Requested Vendor Code (Optional)</Label>
                <Input
                  id="requestedCode"
                  value={requestedCode}
                  onChange={(e) => setRequestedCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
                  placeholder="ABC"
                  maxLength={5}
                />
                <p className="text-xs text-muted-foreground">
                  If you already use a vendor code with other reps, enter it here. Support will confirm or assign one.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="officePhone">Office Phone *</Label>
                <Input
                  id="officePhone"
                  type="tel"
                  value={officePhone}
                  onChange={(e) => setOfficePhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="officeEmail">Office Email *</Label>
                <Input
                  id="officeEmail"
                  type="email"
                  value={officeEmail}
                  onChange={(e) => setOfficeEmail(e.target.value)}
                  placeholder="office@yourcompany.com"
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Additional Details (Optional)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessCity">City</Label>
                  <Input
                    id="businessCity"
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    placeholder="Chicago"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessState">State</Label>
                  <Input
                    id="businessState"
                    value={businessState}
                    onChange={(e) => setBusinessState(e.target.value)}
                    placeholder="IL"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/yourcompany"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entityType">Entity Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearEstablished">Year Established</Label>
                <Input
                  id="yearEstablished"
                  type="number"
                  value={yearEstablished}
                  onChange={(e) => setYearEstablished(e.target.value)}
                  placeholder="2015"
                  min={1900}
                  max={new Date().getFullYear()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="einLast4">EIN Last 4 Digits</Label>
                <Input
                  id="einLast4"
                  value={einLast4}
                  onChange={(e) => setEinLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  Optional — helps validate legitimacy. Admin only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bbbUrl">BBB.org Business Profile URL</Label>
                <Input
                  id="bbbUrl"
                  type="url"
                  value={bbbUrl}
                  onChange={(e) => setBbbUrl(e.target.value)}
                  placeholder="https://www.bbb.org/us/il/west-chicago/profile/..."
                />
                <p className="text-xs text-muted-foreground">
                  Optional. This link helps Support validate your business. We don't automatically pull or display BBB ratings.
                </p>
              </div>
            </div>

            {/* GL Insurance */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                GL Insurance (Optional Trust Badge)
              </h4>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="submitGl"
                  checked={submitGl}
                  onCheckedChange={(checked) => setSubmitGl(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="submitGl" className="cursor-pointer">
                    Submit General Liability (GL) expiration for verification
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Badge is shown only after admin verification and while active (not expired).
                  </p>
                </div>
              </div>

              {submitGl && (
                <div className="space-y-2 pl-6">
                  <Label>GL Expiration Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !glExpiresOn && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {glExpiresOn ? format(glExpiresOn, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={glExpiresOn}
                        onSelect={setGlExpiresOn}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Anything you'd like Support to know?</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Additional context or information..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
