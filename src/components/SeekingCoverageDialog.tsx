import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ChevronDown, ChevronRight, X, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { US_STATES, SYSTEMS_LIST } from "@/lib/constants";
import { evaluateMatchAlertsForNewPost } from "@/lib/matchAlerts";
import { useCreditConfirm } from "@/hooks/useCreditConfirm";
import { fetchInspectionTypesForRole, InspectionTypeOption } from "@/lib/inspectionTypes";
import { checklist } from "@/lib/checklistTracking";
import { seekingCoverageCopy } from "@/copy/seekingCoverageCopy";
import { resolveCurrentVendorId, spendVendorCredits } from "@/lib/vendorWallet";

const seekingCoverageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  state_code: z.string().min(1, "State is required"),
  covers_entire_state: z.boolean(),
  // Legacy inspection types (broad categories) - still required for backward compatibility
  inspection_types: z.array(z.string()).min(1, "At least one inspection type is required"),
  inspection_types_other: z.string().optional(),
  // New: detailed inspection type labels for matching (optional)
  inspection_type_ids: z.array(z.string()).optional(),
  systems_required_array: z.array(z.string()).min(1, "At least one system is required"),
  systems_required_other: z.string().optional(),
  is_accepting_responses: z.boolean(),
  pay_type: z.enum(["fixed", "range"]),
  pay_min: z.string().min(1, "Minimum pay is required"),
  pay_max: z.string().optional(),
  pay_notes: z.string().optional(),
  requires_background_check: z.boolean(),
  requires_aspen_grove: z.boolean(),
  allow_willing_to_obtain_background_check: z.boolean().optional(),
}).refine(
  (data) => {
    const min = parseFloat(data.pay_min);
    return !isNaN(min) && min > 0;
  },
  {
    message: "Minimum pay must be a valid number greater than 0",
    path: ["pay_min"],
  }
).refine(
  (data) => {
    if (data.pay_type === "range" && data.pay_max) {
      const min = parseFloat(data.pay_min);
      const max = parseFloat(data.pay_max);
      return !isNaN(max) && max >= min;
    }
    return true;
  },
  {
    message: "Maximum pay must be greater than or equal to minimum pay",
    path: ["pay_max"],
  }
);

type SeekingCoverageForm = z.infer<typeof seekingCoverageSchema>;

interface County {
  id: string;
  county_name: string;
}

interface SeekingCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPost?: any;
  onSave: () => void;
}

export const SeekingCoverageDialog = ({
  open,
  onOpenChange,
  editingPost,
  onSave,
}: SeekingCoverageDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [counties, setCounties] = useState<County[]>([]);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [saving, setSaving] = useState(false);
  const { confirmCreditSpend, CreditConfirmDialog } = useCreditConfirm();
  
  // Multi-county selection state
  const [selectedCountyIds, setSelectedCountyIds] = useState<string[]>([]);
  const [countySearchQuery, setCountySearchQuery] = useState("");
  
  // Detailed inspection types from database
  const [allInspectionTypesByCategory, setAllInspectionTypesByCategory] = useState<Record<string, InspectionTypeOption[]>>({});
  const [selectedDetailedTypes, setSelectedDetailedTypes] = useState<string[]>([]);
  const [detailedTypesOpen, setDetailedTypesOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SeekingCoverageForm>({
    resolver: zodResolver(seekingCoverageSchema),
    defaultValues: {
      title: "",
      description: "",
      state_code: "",
      covers_entire_state: false,
      inspection_types: [],
      inspection_types_other: "",
      inspection_type_ids: [],
      systems_required_array: [],
      systems_required_other: "",
      is_accepting_responses: true,
      pay_type: "fixed" as const,
      pay_min: "",
      pay_max: "",
      pay_notes: "",
      requires_background_check: false,
      requires_aspen_grove: false,
    },
  });

  const stateCode = watch("state_code");
  const coversEntireState = watch("covers_entire_state");
  const inspectionTypes = watch("inspection_types") || [];
  const systemsRequired = watch("systems_required_array") || [];
  const payType = watch("pay_type");
  const requiresBackgroundCheck = watch("requires_background_check");

  // Load detailed inspection types from database
  useEffect(() => {
    const loadInspectionTypes = async () => {
      const grouped = await fetchInspectionTypesForRole('vendor');
      setAllInspectionTypesByCategory(grouped);
    };
    loadInspectionTypes();
  }, []);

  // Load counties when state changes
  useEffect(() => {
    const loadCounties = async () => {
      if (!stateCode) {
        setCounties([]);
        return;
      }

      setLoadingCounties(true);
      const { data, error } = await supabase
        .from("us_counties")
        .select("id, county_name")
        .eq("state_code", stateCode)
        .order("county_name");

      if (error) {
        console.error("Error loading counties:", error);
      } else {
        setCounties(data || []);
      }
      setLoadingCounties(false);
    };

    loadCounties();
  }, [stateCode]);

  // Populate form when editing
  useEffect(() => {
    if (editingPost && open) {
      // Parse "Other" values
      const inspectionTypesOther = editingPost.inspection_types
        ?.find((t: string) => t.startsWith("Other:"))
        ?.replace("Other:", "")
        .trim();
      const systemsOther = editingPost.systems_required_array
        ?.find((s: string) => s.startsWith("Other:"))
        ?.replace("Other:", "")
        .trim();

      // For fixed rate: pay_max holds the value, pay_min is null
      // For range: both pay_min and pay_max are set
      const isFixedRate = editingPost.pay_type === "fixed" || (!editingPost.pay_min && editingPost.pay_max);
      
      reset({
        title: editingPost.title,
        description: editingPost.description || "",
        state_code: editingPost.state_code,
        covers_entire_state: editingPost.covers_entire_state,
        inspection_types: editingPost.inspection_types.filter((t: string) => !t.startsWith("Other:")),
        inspection_types_other: inspectionTypesOther || "",
        inspection_type_ids: editingPost.inspection_type_ids || [],
        systems_required_array: editingPost.systems_required_array.filter((s: string) => !s.startsWith("Other:")),
        systems_required_other: systemsOther || "",
        is_accepting_responses: editingPost.is_accepting_responses,
        pay_type: isFixedRate ? "fixed" : "range",
        pay_min: isFixedRate 
          ? (editingPost.pay_max ? String(editingPost.pay_max) : "")
          : (editingPost.pay_min ? String(editingPost.pay_min) : ""),
        pay_max: isFixedRate ? "" : (editingPost.pay_max ? String(editingPost.pay_max) : ""),
        pay_notes: editingPost.pay_notes || "",
        requires_background_check: editingPost.requires_background_check || false,
        requires_aspen_grove: editingPost.requires_aspen_grove || false,
      });
      
      // Set detailed types for local state
      setSelectedDetailedTypes(editingPost.inspection_type_ids || []);
      
      // Load selected counties from junction table
      loadSelectedCounties(editingPost.id);
    } else if (!editingPost && open) {
      reset({
        title: "",
        description: "",
        state_code: "",
        covers_entire_state: false,
        inspection_types: [],
        inspection_types_other: "",
        inspection_type_ids: [],
        systems_required_array: [],
        systems_required_other: "",
        is_accepting_responses: true,
        pay_type: "fixed",
        pay_min: "",
        pay_max: "",
        pay_notes: "",
        requires_background_check: false,
        requires_aspen_grove: false,
      });
      setSelectedDetailedTypes([]);
      setSelectedCountyIds([]);
      setCountySearchQuery("");
    }
  }, [editingPost, open, reset]);

  const loadSelectedCounties = async (postId: string) => {
    const { data, error } = await supabase
      .from("seeking_coverage_post_counties")
      .select("county_id")
      .eq("post_id", postId);
    
    if (error) {
      console.error("Error loading post counties:", error);
      return;
    }
    
    setSelectedCountyIds((data || []).map((r: any) => r.county_id));
  };

  // Filter counties by search query
  const filteredCounties = useMemo(() => {
    if (!countySearchQuery.trim()) return counties;
    const q = countySearchQuery.toLowerCase();
    return counties.filter(c => c.county_name.toLowerCase().includes(q));
  }, [counties, countySearchQuery]);

  // Get county names for selected IDs (for chip display)
  const selectedCountyNames = useMemo(() => {
    return selectedCountyIds.map(id => {
      const c = counties.find(county => county.id === id);
      return c ? { id, name: c.county_name } : { id, name: "Unknown" };
    });
  }, [selectedCountyIds, counties]);

  const toggleCounty = (countyId: string) => {
    setSelectedCountyIds(prev =>
      prev.includes(countyId)
        ? prev.filter(id => id !== countyId)
        : [...prev, countyId]
    );
  };

  const removeCounty = (countyId: string) => {
    setSelectedCountyIds(prev => prev.filter(id => id !== countyId));
  };

  /** Sync junction table rows for a post (delete-all then insert-all) */
  const syncPostCounties = async (postId: string, countyIds: string[], coversState: boolean) => {
    // Always delete existing rows first
    const { error: delErr } = await supabase
      .from("seeking_coverage_post_counties")
      .delete()
      .eq("post_id", postId);

    if (delErr) {
      console.error("[syncPostCounties] delete failed:", delErr);
    }

    if (coversState || countyIds.length === 0) {
      return;
    }

    // Build full insert payload
    const rows = countyIds.map(county_id => ({ post_id: postId, county_id }));
    console.log(`[syncPostCounties] inserting ${rows.length} county rows for post ${postId}`, rows);

    if (rows.length !== countyIds.length) {
      console.error("[syncPostCounties] BUG: insert payload length !== selectedCountyIds length", { rows, countyIds });
    }

    const { error: insErr } = await supabase
      .from("seeking_coverage_post_counties")
      .insert(rows);

    if (insErr) {
      console.error("[syncPostCounties] insert failed:", insErr);
    }
  };

  const onSubmit = async (data: SeekingCoverageForm) => {
    if (!user) return;

    setSaving(true);

    // Handle "Other" options
    const finalInspectionTypes = [...data.inspection_types];
    if (data.inspection_types.includes("Other") && data.inspection_types_other) {
      finalInspectionTypes.push(`Other: ${data.inspection_types_other}`);
    }
    const filteredInspectionTypes = finalInspectionTypes.filter((t) => t !== "Other");

    const finalSystemsRequired = [...data.systems_required_array];
    if (data.systems_required_array.includes("Other") && data.systems_required_other) {
      finalSystemsRequired.push(`Other: ${data.systems_required_other}`);
    }
    const filteredSystemsRequired = finalSystemsRequired.filter((s) => s !== "Other");

    // Validation: require at least 1 county when not covering entire state
    if (!data.covers_entire_state && selectedCountyIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one county or turn on 'Covers entire state'.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // For new posts, show credit confirmation before proceeding
    let saveAsDraft = false;
    if (!editingPost) {
      const confirmed = await confirmCreditSpend({
        cost: 1,
        actionLabel: "publish this Seeking Coverage post",
        cancelLabel: "Save as Draft",
      });
      if (!confirmed) {
        saveAsDraft = true;
      }
    }

    // Keep county_id as the first selected county for backward compat
    const legacyCountyId = data.covers_entire_state ? null : (selectedCountyIds[0] || null);

    const payload = {
      title: data.title,
      description: data.description || null,
      state_code: data.state_code,
      county_id: legacyCountyId,
      covers_entire_state: data.covers_entire_state,
      inspection_types: filteredInspectionTypes,
      inspection_type_ids: selectedDetailedTypes.length > 0 ? selectedDetailedTypes : null,
      systems_required_array: filteredSystemsRequired,
      is_accepting_responses: saveAsDraft ? false : data.is_accepting_responses,
      status: saveAsDraft ? "draft" : "active",
      auto_expires_at: editingPost
        ? editingPost.auto_expires_at
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      vendor_id: user.id,
      pay_type: data.pay_type,
      pay_min: data.pay_type === "range" ? parseFloat(data.pay_min) : null,
      pay_max: data.pay_type === "range" 
        ? (data.pay_max ? parseFloat(data.pay_max) : null)
        : parseFloat(data.pay_min),
      pay_notes: data.pay_notes || null,
      requires_background_check: data.requires_background_check,
      requires_aspen_grove: data.requires_background_check ? data.requires_aspen_grove : false,
    };

    if (editingPost) {
      const { error } = await supabase
        .from("seeking_coverage_posts")
        .update(payload)
        .eq("id", editingPost.id);

      if (error) {
        console.error("Error updating post:", error);
        toast({
          title: "Error",
          description: seekingCoverageCopy.toasts.saveError,
          variant: "destructive",
        });
      } else {
        // Sync junction table
        await syncPostCounties(editingPost.id, selectedCountyIds, data.covers_entire_state);
        toast({
          title: "Post Updated",
          description: seekingCoverageCopy.toasts.saveSuccess,
        });
        onSave();
        navigate("/vendor/seeking-coverage");
      }
    } else if (saveAsDraft) {
      const { data: newPost, error } = await supabase
        .from("seeking_coverage_posts")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Error saving draft:", error);
        toast({
          title: "Error",
          description: seekingCoverageCopy.toasts.saveError,
          variant: "destructive",
        });
      } else {
        await syncPostCounties(newPost.id, selectedCountyIds, data.covers_entire_state);
        toast({
          title: "Draft Saved",
          description: "Your post has been saved as a draft. You can publish it later from the Seeking Coverage page.",
        });
        onSave();
        navigate("/vendor/seeking-coverage");
      }
    } else {
      const vendorId = await resolveCurrentVendorId(user.id);
      if (!vendorId) {
        toast({
          title: "Error",
          description: "Could not resolve vendor account. Please try again.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const spendResult = await spendVendorCredits(vendorId, 1, "seeking_coverage_post", {
        post_title: data.title,
        state_code: data.state_code,
      });

      if (!spendResult.success) {
        toast({
          title: spendResult.error?.includes("Insufficient") ? "Insufficient Credits" : "Error",
          description: spendResult.error || "Failed to deduct credits. Please try again.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const { data: newPost, error } = await supabase
        .from("seeking_coverage_posts")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Error creating post:", error);
        toast({
          title: "Error",
          description: seekingCoverageCopy.toasts.saveError + " Credit was deducted - please contact support for a refund.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Sync junction table
      await syncPostCounties(newPost.id, selectedCountyIds, data.covers_entire_state);

      evaluateMatchAlertsForNewPost(newPost.id).catch((err) => {
        console.error("Error evaluating match alerts:", err);
      });

      toast({
        title: "Post Created",
        description: seekingCoverageCopy.toasts.saveSuccess + " 1 credit deducted.",
      });
      onSave();
      navigate("/vendor/seeking-coverage");
      
      checklist.firstSeekingCoveragePost(user.id);
    }

    setSaving(false);
  };

  const handleCheckboxChange = (field: "inspection_types" | "systems_required_array", value: string) => {
    const current = watch(field);
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setValue(field, updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPost ? seekingCoverageCopy.vendor.form.headerEdit : seekingCoverageCopy.vendor.form.headerNew}</DialogTitle>
          <DialogDescription>
            Post where you need Field Reps. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">
              Short Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., WI – Milwaukee County – Loss Drafts"
              {...register("title")}
            />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* State */}
          <div>
            <Label htmlFor="state_code">
              State <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={watch("state_code")} 
              onValueChange={(value) => {
                const currentState = watch("state_code");
                setValue("state_code", value);
                if (value !== currentState) {
                  setSelectedCountyIds([]);
                  setCountySearchQuery("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.value} - {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state_code && <p className="text-sm text-destructive mt-1">{errors.state_code.message}</p>}
          </div>

          {/* Covers Entire State Toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="covers_entire_state"
              checked={coversEntireState}
              onCheckedChange={(checked) => {
                setValue("covers_entire_state", checked);
                if (checked) {
                  setSelectedCountyIds([]);
                  setCountySearchQuery("");
                }
              }}
            />
            <Label htmlFor="covers_entire_state" className="cursor-pointer">
              Covers entire state
            </Label>
          </div>

          {/* Multi-County Selector */}
          {!coversEntireState && (
            <div>
              <Label>
                Counties <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select one or more counties. Reps covering any of these counties will see this post.
              </p>
              
              {/* Selected counties as chips */}
              {selectedCountyNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedCountyNames.map(({ id, name }) => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      {name}
                      <button
                        type="button"
                        onClick={() => removeCounty(id)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {!stateCode ? (
                <p className="text-sm text-muted-foreground mt-1">Select a state first</p>
              ) : loadingCounties ? (
                <p className="text-sm text-muted-foreground mt-1">Loading counties...</p>
              ) : (
                <div className="border border-border rounded-md">
                  {/* Search input */}
                  <div className="relative border-b border-border">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search counties..."
                      value={countySearchQuery}
                      onChange={(e) => setCountySearchQuery(e.target.value)}
                      className="border-0 pl-8 h-9 rounded-b-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  {/* County list with checkboxes */}
                  <ScrollArea className="h-[180px]">
                    <div className="p-2 space-y-0.5">
                      {filteredCounties.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">No counties found</p>
                      ) : (
                        filteredCounties.map((county) => (
                          <div
                            key={county.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleCounty(county.id)}
                          >
                            <Checkbox
                              checked={selectedCountyIds.includes(county.id)}
                              onCheckedChange={() => toggleCounty(county.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm">{county.county_name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {selectedCountyIds.length === 0 && stateCode && !loadingCounties && (
                <p className="text-sm text-destructive mt-1">Please select at least one county</p>
              )}
            </div>
          )}

          {/* Inspection Category (broad categories) - required */}
          <div>
            <Label>
              Inspection Category <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select the general category of work. Use the detailed types section below if you want more precise matching.
            </p>
            <div className="space-y-2 mt-2">
              {["Property Inspections", "Loss / Insurance Claims (Appointment-based)", "Commercial", "Other"].map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox
                    id={`legacy-inspection-${type}`}
                    checked={inspectionTypes.includes(type)}
                    onCheckedChange={() => handleCheckboxChange("inspection_types", type)}
                  />
                  <Label htmlFor={`legacy-inspection-${type}`} className="cursor-pointer font-normal">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
            {inspectionTypes.includes("Other") && (
              <Input
                placeholder="Specify other inspection type"
                className="mt-2"
                {...register("inspection_types_other")}
              />
            )}
            {errors.inspection_types && (
              <p className="text-sm text-destructive mt-1">{errors.inspection_types.message}</p>
            )}
          </div>

          {/* Inspection Types Needed (detailed, optional for matching) - Collapsible */}
          <Collapsible open={detailedTypesOpen} onOpenChange={setDetailedTypesOpen}>
            <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border">
              <div>
                <Label className="text-base font-semibold">Inspection Types Needed (optional)</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose specific inspection types for this request if you want more precise matches. Leave this blank if any type within your selected category is okay.
                </p>
              </div>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 px-0 hover:bg-transparent">
                  {detailedTypesOpen ? (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span className="text-sm">Hide detailed inspection types</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-sm">Show detailed inspection types</span>
                    </>
                  )}
                  {selectedDetailedTypes.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({selectedDetailedTypes.length} selected)
                    </span>
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-2">
                {Object.keys(allInspectionTypesByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(allInspectionTypesByCategory).map(([category, types]) => (
                      <div key={category} className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">{category}</Label>
                        <div className="ml-1 space-y-1.5">
                          {types.map((type) => (
                            <div key={type.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`detailed-inspection-${type.id}`}
                                checked={selectedDetailedTypes.includes(type.label)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDetailedTypes(prev => [...prev, type.label]);
                                  } else {
                                    setSelectedDetailedTypes(prev => prev.filter(t => t !== type.label));
                                  }
                                }}
                              />
                              <Label 
                                htmlFor={`detailed-inspection-${type.id}`} 
                                className="cursor-pointer font-normal text-sm"
                              >
                                {type.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Loading inspection types...</p>
                )}

                {selectedDetailedTypes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedDetailedTypes.length} type{selectedDetailedTypes.length !== 1 ? 's' : ''} selected. 
                    Only reps who perform these specific types in this region will see this post.
                  </p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
          <div>
            <Label>
              Systems Required <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2 mt-2">
              {SYSTEMS_LIST.map((system) => (
                <div key={system} className="flex items-center gap-2">
                  <Checkbox
                    id={`system-${system}`}
                    checked={systemsRequired.includes(system)}
                    onCheckedChange={() => handleCheckboxChange("systems_required_array", system)}
                  />
                  <Label htmlFor={`system-${system}`} className="cursor-pointer font-normal">
                    {system}
                  </Label>
                </div>
              ))}
            </div>
            {systemsRequired.includes("Other") && (
              <Input
                placeholder="Specify other system"
                className="mt-2"
                {...register("systems_required_other")}
              />
            )}
            {errors.systems_required_array && (
              <p className="text-sm text-destructive mt-1">{errors.systems_required_array.message}</p>
            )}
          </div>

          {/* Details / Requirements */}
          <div>
            <Label htmlFor="description">Details / Requirements (optional but encouraged)</Label>
            <Textarea
              id="description"
              placeholder="Describe any additional requirements, expectations, or details..."
              rows={4}
              {...register("description")}
            />
          </div>

          {/* Pricing Section */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <Label className="text-base font-semibold">Offered Rate (recommended: range)</Label>
              <p className="text-sm text-muted-foreground mt-1">
                We recommend entering a minimum and maximum rate for this work. Field Reps will not see this range – they'll only see whether the pay matches their base rate in that county. This helps you attract more interest and still control final pricing.
              </p>
            </div>

            {/* Pay Type Selection */}
            <div>
              <Label>Payment Structure <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={payType}
                onValueChange={(value) => setValue("pay_type", value as "fixed" | "range")}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="pay-fixed" />
                  <Label htmlFor="pay-fixed" className="cursor-pointer font-normal">
                    Fixed price per completed inspection
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="range" id="pay-range" />
                  <Label htmlFor="pay-range" className="cursor-pointer font-normal">
                    Price range (min-max)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Pay Inputs */}
            {payType === "fixed" ? (
              <div>
                <Label htmlFor="pay_min">
                  Offered Rate Per Inspection (USD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pay_min"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 35.00"
                  {...register("pay_min")}
                  className="mt-2"
                />
                {errors.pay_min && (
                  <p className="text-sm text-destructive mt-1">{errors.pay_min.message}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pay_min">
                    Minimum Rate (USD) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pay_min"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 30.00"
                    {...register("pay_min")}
                    className="mt-2"
                  />
                  {errors.pay_min && (
                    <p className="text-sm text-destructive mt-1">{errors.pay_min.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="pay_max">
                    Maximum Rate (USD) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pay_max"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 45.00"
                    {...register("pay_max")}
                    className="mt-2"
                  />
                  {errors.pay_max && (
                    <p className="text-sm text-destructive mt-1">{errors.pay_max.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Notes */}
            <div>
              <Label htmlFor="pay_notes">Pricing Notes (optional)</Label>
              <Textarea
                id="pay_notes"
                placeholder="e.g., higher for remote/rural, bonus for rush..."
                rows={2}
                {...register("pay_notes")}
                className="mt-2"
              />
            </div>
          </div>

          {/* Background Check Requirements */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <Label className="text-base font-semibold">Background Check Requirements (Optional)</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Only reps with a valid, active background check will see this post if you require it.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="requires_background_check"
                checked={requiresBackgroundCheck}
                onCheckedChange={(checked) => {
                  setValue("requires_background_check", checked as boolean);
                  if (!checked) {
                    setValue("requires_aspen_grove", false);
                  }
                }}
              />
              <Label htmlFor="requires_background_check" className="cursor-pointer font-normal">
                Require active background check for this coverage
              </Label>
            </div>

            {requiresBackgroundCheck && (
              <div className="ml-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="requires_aspen_grove"
                    checked={watch("requires_aspen_grove")}
                    onCheckedChange={(checked) => setValue("requires_aspen_grove", checked as boolean)}
                  />
                  <Label htmlFor="requires_aspen_grove" className="cursor-pointer font-normal">
                    Require AspenGrove / Shield ID specifically
                  </Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="allow_willing_to_obtain"
                    checked={watch("allow_willing_to_obtain_background_check") ?? true}
                    onCheckedChange={(checked) => setValue("allow_willing_to_obtain_background_check", checked as boolean)}
                  />
                  <Label htmlFor="allow_willing_to_obtain" className="cursor-pointer font-normal">
                    Allow reps who don't have one yet but are willing to obtain a background check
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  If checked, you may see reps who don't have a current background check yet but have indicated they're willing to obtain one. You should confirm they complete this before assigning live work.
                </p>
              </div>
            )}

            {requiresBackgroundCheck && (
              <p className="text-xs text-muted-foreground">
                Only reps with an active background check that meets this requirement will be able to see or respond to this post.
              </p>
            )}
          </div>

          {/* Accepting Responses */}
          <div className="flex items-center gap-3">
            <Switch
              id="is_accepting_responses"
              checked={watch("is_accepting_responses")}
              onCheckedChange={(checked) => setValue("is_accepting_responses", checked)}
            />
            <Label htmlFor="is_accepting_responses" className="cursor-pointer">
              Accepting Responses
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingPost ? "Update Post" : "Create Post"}
            </Button>
          </div>
        </form>
      </DialogContent>
      {CreditConfirmDialog}
    </Dialog>
  );
};
