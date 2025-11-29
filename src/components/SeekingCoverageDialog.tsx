import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { US_STATES, INSPECTION_TYPES_LIST, SYSTEMS_LIST } from "@/lib/constants";

const seekingCoverageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  state_code: z.string().min(1, "State is required"),
  county_id: z.string().nullable(),
  covers_entire_state: z.boolean(),
  inspection_types: z.array(z.string()).min(1, "At least one inspection type is required"),
  inspection_types_other: z.string().optional(),
  systems_required_array: z.array(z.string()).min(1, "At least one system is required"),
  systems_required_other: z.string().optional(),
  is_accepting_responses: z.boolean(),
  county_name: z.string().optional(),
  pay_type: z.enum(["fixed", "range"]),
  pay_min: z.string().min(1, "Minimum pay is required"),
  pay_max: z.string().optional(),
  pay_notes: z.string().optional(),
  requires_background_check: z.boolean(),
  requires_aspen_grove: z.boolean(),
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
      county_id: null,
      county_name: "",
      covers_entire_state: false,
      inspection_types: [],
      inspection_types_other: "",
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

      reset({
        title: editingPost.title,
        description: editingPost.description || "",
        state_code: editingPost.state_code,
        county_id: editingPost.county_id,
        county_name: "", // Will be populated from lookup if needed
        covers_entire_state: editingPost.covers_entire_state,
        inspection_types: editingPost.inspection_types.filter((t: string) => !t.startsWith("Other:")),
        inspection_types_other: inspectionTypesOther || "",
        systems_required_array: editingPost.systems_required_array.filter((s: string) => !s.startsWith("Other:")),
        systems_required_other: systemsOther || "",
        is_accepting_responses: editingPost.is_accepting_responses,
        pay_type: editingPost.pay_type || "fixed",
        pay_min: editingPost.pay_min ? String(editingPost.pay_min) : "",
        pay_max: editingPost.pay_max ? String(editingPost.pay_max) : "",
        pay_notes: editingPost.pay_notes || "",
        requires_background_check: editingPost.requires_background_check || false,
        requires_aspen_grove: editingPost.requires_aspen_grove || false,
      });
    } else if (!editingPost && open) {
      reset({
        title: "",
        description: "",
        state_code: "",
        county_id: null,
        county_name: "",
        covers_entire_state: false,
        inspection_types: [],
        inspection_types_other: "",
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
    }
  }, [editingPost, open, reset]);

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

    // Validation
    if (!data.covers_entire_state && !data.county_id) {
      toast({
        title: "Validation Error",
        description: "Please select a county or turn on 'Covers entire state'.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Look up county name if county_id is set
    let countyName = null;
    if (data.county_id && !data.covers_entire_state) {
      const selectedCounty = counties.find(c => c.id === data.county_id);
      countyName = selectedCounty?.county_name || null;
    }

    const payload = {
      title: data.title,
      description: data.description || null,
      state_code: data.state_code,
      county_id: data.covers_entire_state ? null : data.county_id,
      covers_entire_state: data.covers_entire_state,
      inspection_types: filteredInspectionTypes,
      systems_required_array: filteredSystemsRequired,
      is_accepting_responses: data.is_accepting_responses,
      status: "active",
      auto_expires_at: editingPost
        ? editingPost.auto_expires_at
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      vendor_id: user.id,
      pay_type: data.pay_type,
      pay_min: parseFloat(data.pay_min),
      pay_max: data.pay_type === "range" && data.pay_max ? parseFloat(data.pay_max) : null,
      pay_notes: data.pay_notes || null,
      requires_background_check: data.requires_background_check,
      requires_aspen_grove: data.requires_background_check ? data.requires_aspen_grove : false,
    };

    if (editingPost) {
      // Update existing
      const { error } = await supabase
        .from("seeking_coverage_posts")
        .update(payload)
        .eq("id", editingPost.id);

      if (error) {
        console.error("Error updating post:", error);
        toast({
          title: "Error",
          description: "Failed to update seeking coverage post.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Post Updated",
          description: "Your seeking coverage post has been updated successfully.",
        });
        onSave();
        navigate("/vendor/seeking-coverage");
      }
    } else {
      // Create new
      const { error } = await supabase.from("seeking_coverage_posts").insert([payload]);

      if (error) {
        console.error("Error creating post:", error);
        toast({
          title: "Error",
          description: "Failed to create seeking coverage post.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Post Created",
          description: "Your seeking coverage post has been created successfully.",
        });
        onSave();
        navigate("/vendor/seeking-coverage");
      }
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
          <DialogTitle>{editingPost ? "Edit Seeking Coverage Request" : "New Seeking Coverage Request"}</DialogTitle>
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
                setValue("state_code", value);
                setValue("county_id", null);
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
                  setValue("county_id", null);
                }
              }}
            />
            <Label htmlFor="covers_entire_state" className="cursor-pointer">
              Covers entire state
            </Label>
          </div>

          {/* County */}
          {!coversEntireState && (
            <div>
              <Label htmlFor="county_id">
                County <span className="text-destructive">*</span>
              </Label>
              {!stateCode ? (
                <p className="text-sm text-muted-foreground mt-1">Select a state first</p>
              ) : loadingCounties ? (
                <p className="text-sm text-muted-foreground mt-1">Loading counties...</p>
              ) : (
                <Select
                  value={watch("county_id") || ""}
                  onValueChange={(value) => {
                    setValue("county_id", value);
                    const selectedCounty = counties.find(c => c.id === value);
                    setValue("county_name", selectedCounty?.county_name || "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select county" />
                  </SelectTrigger>
                  <SelectContent>
                    {counties.map((county) => (
                      <SelectItem key={county.id} value={county.id}>
                        {county.county_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.county_id && <p className="text-sm text-destructive mt-1">{String(errors.county_id.message)}</p>}
            </div>
          )}

          {/* Inspection Types */}
          <div>
            <Label>
              Inspection Types Needed <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2 mt-2">
              {INSPECTION_TYPES_LIST.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox
                    id={`inspection-${type}`}
                    checked={inspectionTypes.includes(type)}
                    onCheckedChange={() => handleCheckboxChange("inspection_types", type)}
                  />
                  <Label htmlFor={`inspection-${type}`} className="cursor-pointer font-normal">
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

          {/* Systems Required */}
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
              <Label className="text-base font-semibold">What are you paying?</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Reps will only see this post if your offered rate meets their minimum for this county.
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
              <div className="ml-6 flex items-center gap-3">
                <Checkbox
                  id="requires_aspen_grove"
                  checked={watch("requires_aspen_grove")}
                  onCheckedChange={(checked) => setValue("requires_aspen_grove", checked as boolean)}
                />
                <Label htmlFor="requires_aspen_grove" className="cursor-pointer font-normal">
                  Require AspenGrove / Shield ID specifically
                </Label>
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
    </Dialog>
  );
};
