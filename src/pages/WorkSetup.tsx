import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SYSTEMS_LIST } from "@/lib/constants";
import { InspectionTypeMultiSelect } from "@/components/InspectionTypeMultiSelect";
import { ArrowLeft, Save, AlertCircle, MapPin, Edit, Trash2, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { CoverageAreaDialog, CoverageArea, CoverageMode } from "@/components/CoverageAreaDialog";
import { RepCoverageTable } from "@/components/RepCoverageTable";
import { VendorCoverageDialog } from "@/components/VendorCoverageDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Validation schema for rep work setup
// NOTE: Legacy inspection type fields (inspection_types_other) have been deprecated.
// Only the new categorized inspection types from inspection_type_options are used.
const repWorkSetupSchema = z.object({
  systems_used: z.array(z.string()).min(1, "Please select at least one system"),
  systems_used_other: z.string().trim().max(100).optional().nullable(),
  open_to_new_systems: z.boolean(),
  inspection_types: z.array(z.string()).min(1, "Please select at least one inspection type"),
});

// Validation schema for vendor work setup
const vendorWorkSetupSchema = z.object({
  systems_used: z.array(z.string()).min(1, "Please select at least one system"),
  systems_used_other: z.string().trim().max(100).optional().nullable(),
  primary_inspection_types: z.array(z.string()).min(1, "Please select at least one inspection type"),
});

type RepWorkSetupForm = z.infer<typeof repWorkSetupSchema>;
type VendorWorkSetupForm = z.infer<typeof vendorWorkSetupSchema>;

const WorkSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole, loading: roleLoading } = useActiveRole();
  const { toast } = useToast();
  
  const isRep = effectiveRole === "rep";
  const isVendor = effectiveRole === "vendor";
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [repProfile, setRepProfile] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [coverageAreas, setCoverageAreas] = useState<any[]>([]);
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<any>(null);
  const [countyNameMap, setCountyNameMap] = useState<Map<string, string>>(new Map());

  // Rep form
  const repForm = useForm<RepWorkSetupForm>({
    resolver: zodResolver(repWorkSetupSchema),
    defaultValues: {
      systems_used: [],
      open_to_new_systems: false,
      inspection_types: [],
    },
  });

  // Vendor form
  const vendorForm = useForm<VendorWorkSetupForm>({
    resolver: zodResolver(vendorWorkSetupSchema),
    defaultValues: {
      systems_used: [],
      primary_inspection_types: [],
    },
  });

  const systemsUsed = isRep ? repForm.watch("systems_used") || [] : vendorForm.watch("systems_used") || [];
  const inspectionTypes = isRep 
    ? repForm.watch("inspection_types") || [] 
    : vendorForm.watch("primary_inspection_types") || [];

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user && !roleLoading) {
      loadData();
    }
  }, [user, authLoading, roleLoading, effectiveRole, navigate]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isRep) {
        await loadRepData();
      } else if (isVendor) {
        await loadVendorData();
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load work setup information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRepData = async () => {
    if (!user) return;

    // Load rep profile
    const { data: repData, error: repError } = await supabase
      .from("rep_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (repError && repError.code !== "PGRST116") throw repError;

    if (repData) {
      setRepProfile(repData);
      
      // Parse systems
      const systemsArray = repData.systems_used || [];
      const systemsForCheckboxes: string[] = [];
      let systemsOtherText = "";
      
      systemsArray.forEach((system: string) => {
        if (system.startsWith("Other: ")) {
          systemsForCheckboxes.push("Other");
          systemsOtherText = system.substring(7);
        } else {
          systemsForCheckboxes.push(system);
        }
      });
      
      // Load inspection types - only use the new system values
      // NOTE: Legacy inspection type values are intentionally ignored
      const inspectionTypesArray = repData.inspection_types || [];
      
      repForm.setValue("systems_used", systemsForCheckboxes);
      repForm.setValue("systems_used_other", systemsOtherText);
      repForm.setValue("open_to_new_systems", repData.open_to_new_systems ?? false);
      repForm.setValue("inspection_types", inspectionTypesArray);
    }

    // Load coverage areas
    await loadRepCoverageAreas();
  };

  const loadRepCoverageAreas = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("rep_coverage_areas")
      .select("*")
      .eq("user_id", user.id)
      .order("state_code", { ascending: true });

    if (error) {
      console.error("Error loading coverage areas:", error);
    } else {
      setCoverageAreas(data || []);
    }
  };

  const loadVendorData = async () => {
    if (!user) return;

    // Load vendor profile
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendor_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vendorError && vendorError.code !== "PGRST116") throw vendorError;

    if (vendorData) {
      setVendorProfile(vendorData);
      
      // Parse systems
      const systemsArray = vendorData.systems_used || [];
      const systemsForCheckboxes: string[] = [];
      let systemsOtherText = "";
      
      systemsArray.forEach((system: string) => {
        if (system.startsWith("Other: ")) {
          systemsForCheckboxes.push("Other");
          systemsOtherText = system.substring(7);
        } else {
          systemsForCheckboxes.push(system);
        }
      });
      
      // Load inspection types - only use the new system values
      // NOTE: Legacy inspection type values are intentionally ignored
      const inspectionTypesArray = vendorData.primary_inspection_types || [];
      
      vendorForm.setValue("systems_used", systemsForCheckboxes);
      vendorForm.setValue("systems_used_other", systemsOtherText);
      vendorForm.setValue("primary_inspection_types", inspectionTypesArray);
    }

    // Load vendor coverage areas
    await loadVendorCoverageAreas();
  };

  const loadVendorCoverageAreas = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("vendor_coverage_areas")
      .select("*")
      .eq("user_id", user.id)
      .order("state_code", { ascending: true })
      .order("county_name", { ascending: true });

    if (error) {
      console.error("Error loading coverage areas:", error);
      return;
    }
    
    setCoverageAreas(data || []);

    // Fetch county names
    const allCountyIds = new Set<string>();
    (data || []).forEach((coverage: any) => {
      (coverage.excluded_county_ids || []).forEach((id: string) => allCountyIds.add(id));
      (coverage.included_county_ids || []).forEach((id: string) => allCountyIds.add(id));
    });

    if (allCountyIds.size > 0) {
      const { data: countyRows } = await supabase
        .from("us_counties")
        .select("id, county_name")
        .in("id", Array.from(allCountyIds));

      const map = new Map<string, string>();
      (countyRows || []).forEach((row: any) => {
        map.set(row.id, row.county_name);
      });
      setCountyNameMap(map);
    }
  };

  const onRepSubmit = async (data: RepWorkSetupForm) => {
    if (!user || !repProfile) return;
    setSaving(true);

    try {
      // Prepare systems_used array
      let finalSystems = data.systems_used.filter(s => s !== "Other");
      if (data.systems_used.includes("Other") && data.systems_used_other) {
        finalSystems.push(`Other: ${data.systems_used_other}`);
      }

      // NOTE: Inspection types now use the new categorized system only
      // Legacy "Other: " prefix handling is deprecated
      const { error } = await supabase
        .from("rep_profile")
        .update({
          systems_used: finalSystems,
          open_to_new_systems: data.open_to_new_systems,
          inspection_types: data.inspection_types,
        })
        .eq("id", repProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your work setup has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error saving:", error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onVendorSubmit = async (data: VendorWorkSetupForm) => {
    if (!user || !vendorProfile) return;
    setSaving(true);

    try {
      // Prepare systems_used array
      let finalSystems = [...data.systems_used];
      if (data.systems_used.includes("Other") && data.systems_used_other) {
        finalSystems = finalSystems.filter(s => s !== "Other");
        finalSystems.push(`Other: ${data.systems_used_other}`);
      }

      // NOTE: Inspection types now use the new categorized system only
      // Legacy "Other: " prefix handling is deprecated
      const { error } = await supabase
        .from("vendor_profile")
        .update({
          systems_used: finalSystems,
          primary_inspection_types: data.primary_inspection_types,
        })
        .eq("id", vendorProfile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your work setup has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error saving:", error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Work Setup + Coverage & Rates</h1>
          <p className="text-muted-foreground">
            Manage the systems you use, the inspection types you {isRep ? "perform" : "assign"}, and your coverage areas and pricing in one place.
          </p>
        </div>

        {/* Completion warning */}
        {(systemsUsed.length === 0 || inspectionTypes.length === 0) && (
          <Alert className="mb-6 border-secondary/50 bg-secondary/10">
            <AlertCircle className="h-4 w-4 text-secondary" />
            <AlertDescription className="text-foreground">
              {isRep 
                ? "To be matched with work opportunities, please complete your systems and inspection types."
                : "To connect with field reps, please complete your systems and inspection types."
              }
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={isRep ? repForm.handleSubmit(onRepSubmit) : vendorForm.handleSubmit(onVendorSubmit)}>
          <div className="space-y-4">
            {/* Section 1: Systems */}
            <Collapsible defaultOpen className="group">
              <Card className="bg-card-elevated border border-border overflow-hidden">
                <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="text-left">
                    <h3 className="text-xl font-semibold text-foreground">
                      {isRep ? "Systems I Use" : "Systems We Use"}
                    </h3>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      Let vendors and reps know which systems you actively use to complete inspection work.
                    </p>
                    
                    <div className="space-y-3">
                      {SYSTEMS_LIST.map((system) => (
                        <div key={system} className="flex items-center space-x-3">
                          <Checkbox
                            id={`system-${system}`}
                            checked={systemsUsed.includes(system)}
                            onCheckedChange={(checked) => {
                              const current = systemsUsed;
                              if (isRep) {
                                if (checked) {
                                  repForm.setValue("systems_used", [...current, system]);
                                } else {
                                  repForm.setValue("systems_used", current.filter((s) => s !== system));
                                }
                              } else {
                                if (checked) {
                                  vendorForm.setValue("systems_used", [...current, system]);
                                } else {
                                  vendorForm.setValue("systems_used", current.filter((s) => s !== system));
                                }
                              }
                            }}
                          />
                          <Label htmlFor={`system-${system}`} className="text-foreground font-normal cursor-pointer">
                            {system}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {/* Other system free text */}
                    {systemsUsed.includes("Other") && (
                      <div className="ml-7">
                        <Label htmlFor="systems_used_other" className="text-sm">
                          Please specify other system
                        </Label>
                        <Input
                          id="systems_used_other"
                          {...(isRep ? repForm.register("systems_used_other") : vendorForm.register("systems_used_other"))}
                          placeholder="Enter system name"
                          className="mt-1"
                          maxLength={100}
                        />
                      </div>
                    )}

                    {/* Open to new systems (Rep only) */}
                    {isRep && (
                      <div className="border-t border-border pt-4 mt-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="open_to_new_systems"
                            checked={repForm.watch("open_to_new_systems")}
                            onCheckedChange={(checked) => repForm.setValue("open_to_new_systems", !!checked)}
                            className="mt-0.5"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="open_to_new_systems" className="text-foreground font-normal cursor-pointer">
                              Open to work in new systems
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Select this if you're comfortable using inspection systems you haven't worked in before. 
                              This lets vendors match you with jobs even when they use different software, as long as 
                              they provide the access and instructions needed for their process.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(isRep ? repForm.formState.errors.systems_used : vendorForm.formState.errors.systems_used) && (
                      <p className="text-sm text-destructive">
                        {isRep 
                          ? repForm.formState.errors.systems_used?.message 
                          : vendorForm.formState.errors.systems_used?.message}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Section 2: Inspection Types */}
            <Collapsible defaultOpen className="group">
              <Card className="bg-card-elevated border border-border overflow-hidden">
                <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="text-left">
                    <h3 className="text-xl font-semibold text-foreground">
                      {isRep ? "Inspection Types I Perform" : "Inspection Types We Handle"}
                    </h3>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      {isRep 
                        ? "Choose the types of inspections you're set up to perform so vendors can see where you're a fit."
                        : "Choose the types of inspections your company handles so reps know what kind of work you offer."
                      }
                    </p>

                    <InspectionTypeMultiSelect
                      role={isRep ? "rep" : "vendor"}
                      selectedLabels={inspectionTypes}
                      onChange={(labels) => {
                        if (isRep) {
                          repForm.setValue("inspection_types", labels);
                        } else {
                          vendorForm.setValue("primary_inspection_types", labels);
                        }
                      }}
                      error={isRep 
                        ? repForm.formState.errors.inspection_types?.message 
                        : vendorForm.formState.errors.primary_inspection_types?.message}
                    />
                    {/* NOTE: The separate "Other" checkbox/input has been removed.
                        "Other" is now a category in the InspectionTypeMultiSelect component. */}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Section 3: Coverage & Pricing */}
            <Collapsible defaultOpen className="group">
              <Card className="bg-card-elevated border border-border overflow-hidden">
                <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="text-left flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <h3 className="text-xl font-semibold text-foreground">
                      Coverage & Pricing
                    </h3>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      Add the states and counties you're willing to cover, and your typical pricing.
                    </p>

                    {/* Rep coverage warning */}
                    {isRep && coverageAreas.length > 0 && coverageAreas.some(c => c.base_price === null || c.base_price === undefined) && (
                      <Alert className="border-orange-500/50 bg-orange-500/10">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <AlertDescription className="text-foreground">
                          <strong>Set a Base Rate for each county</strong> if you want to be matched to Seeking Coverage posts there.
                        </AlertDescription>
                      </Alert>
                    )}

                    {coverageAreas.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
                        <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                          {isRep 
                            ? "You haven't added any coverage yet. Click \"Add Coverage Area\" to set your first state and county."
                            : "No coverage areas added yet. Reps won't see your footprint until you add at least one state."
                          }
                        </p>
                        <Button
                          type="button"
                          onClick={() => {
                            setEditingCoverage(null);
                            setCoverageDialogOpen(true);
                          }}
                        >
                          Add Coverage Area
                        </Button>
                      </div>
                    ) : (
                      <>
                        {isRep ? (
                          <RepCoverageTable
                            coverageAreas={coverageAreas}
                            onEdit={(row) => {
                              const editData: CoverageArea = {
                                id: row.id,
                                state_code: row.state_code,
                                state_name: row.state_name,
                                coverage_mode: (row.coverage_mode as CoverageMode) || "selected_counties",
                                county_name: row.county_name || undefined,
                                county_id: row.county_id,
                                base_price: row.base_price?.toString() || "",
                                rush_price: row.rush_price?.toString() || "",
                                region_note: row.region_note || "",
                                inspection_types: row.inspection_types || [],
                                covers_entire_state: row.covers_entire_state,
                              };
                              setEditingCoverage(editData);
                              setCoverageDialogOpen(true);
                            }}
                            onDelete={async (rowId) => {
                              const { error } = await supabase
                                .from("rep_coverage_areas")
                                .delete()
                                .eq("id", rowId);

                              if (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Error",
                                  description: "Failed to delete coverage area.",
                                });
                              } else {
                                toast({
                                  title: "Coverage Area Deleted",
                                  description: "Coverage area removed successfully.",
                                });
                                loadRepCoverageAreas();
                              }
                            }}
                          />
                        ) : (
                          <div className="space-y-3">
                            {coverageAreas.map((coverage) => (
                              <Card key={coverage.id} className="p-4 bg-muted/30 border-border">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold text-foreground">
                                        {coverage.state_code} - {coverage.state_name}
                                      </h4>
                                      {coverage.coverage_mode === "entire_state" && (
                                        <Badge variant="secondary">Entire State</Badge>
                                      )}
                                    </div>
                                    
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {coverage.coverage_mode === "entire_state" && "All counties"}
                                      {coverage.coverage_mode === "entire_state_except" && (() => {
                                        const countyIds = coverage.excluded_county_ids || [];
                                        const names = countyIds
                                          .map((id: string) => countyNameMap.get(id))
                                          .filter(Boolean);
                                        const countiesLabel = names.length > 0 ? `${names.join(", ")} Counties` : "selected counties";
                                        return countyIds.length > 0 ? `All counties except: ${countiesLabel}` : "All counties (no exclusions)";
                                      })()}
                                      {coverage.coverage_mode === "selected_counties" && (() => {
                                        const countyIds = coverage.included_county_ids || [];
                                        const names = countyIds
                                          .map((id: string) => countyNameMap.get(id))
                                          .filter(Boolean);
                                        const countiesLabel = names.length > 0 ? `${names.join(", ")} Counties` : "selected counties";
                                        return countyIds.length > 0 ? `Selected counties: ${countiesLabel}` : "No counties selected";
                                      })()}
                                    </p>

                                    {coverage.region_note && (
                                      <p className="text-xs text-muted-foreground italic mb-2">
                                        {coverage.region_note}
                                      </p>
                                    )}

                                    {coverage.inspection_types && coverage.inspection_types.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {coverage.inspection_types.map((type: string, idx: number) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {type}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingCoverage(coverage);
                                        setCoverageDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from("vendor_coverage_areas")
                                          .delete()
                                          .eq("id", coverage.id);

                                        if (error) {
                                          toast({
                                            variant: "destructive",
                                            title: "Error",
                                            description: "Failed to delete coverage area.",
                                          });
                                        } else {
                                          toast({
                                            title: "Coverage Area Deleted",
                                            description: "Coverage area removed successfully.",
                                          });
                                          loadVendorCoverageAreas();
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingCoverage(null);
                            setCoverageDialogOpen(true);
                          }}
                        >
                          Add Another Coverage Area
                        </Button>
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Save button */}
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>

        {/* Coverage Dialogs */}
{isRep && (
          <CoverageAreaDialog
            open={coverageDialogOpen}
            onOpenChange={setCoverageDialogOpen}
            editData={editingCoverage}
            profileInspectionTypes={repForm.watch("inspection_types") || []}
            onSave={async (data) => {
              if (!user) return;

              // If mode is entire_state or entire_state_except, we need to create rows for all counties
              if (data.coverage_mode === "entire_state" || data.coverage_mode === "entire_state_except") {
                // Get all counties for the state
                const { data: counties, error: countiesError } = await supabase
                  .from("us_counties")
                  .select("id, county_name")
                  .eq("state_code", data.state_code);

                if (countiesError) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load counties.",
                  });
                  return;
                }

                // Filter out excluded counties if mode is entire_state_except
                let countiesToInsert = counties || [];
                if (data.coverage_mode === "entire_state_except" && data.excluded_county_ids?.length) {
                  countiesToInsert = countiesToInsert.filter(c => !data.excluded_county_ids?.includes(c.id));
                }

                // Delete existing coverage for this state first
                await supabase
                  .from("rep_coverage_areas")
                  .delete()
                  .eq("user_id", user.id)
                  .eq("state_code", data.state_code);

                // Insert all counties
                const rowsToInsert = countiesToInsert.map(county => ({
                  user_id: user.id,
                  state_code: data.state_code,
                  state_name: data.state_name,
                  county_id: county.id,
                  county_name: county.county_name,
                  coverage_mode: data.coverage_mode,
                  covers_entire_state: data.coverage_mode === "entire_state",
                  covers_entire_county: true,
                  base_price: data.base_price ? parseFloat(data.base_price) : null,
                  rush_price: data.rush_price ? parseFloat(data.rush_price) : null,
                  region_note: data.region_note || null,
                  inspection_types: data.inspection_types?.length ? data.inspection_types : null,
                }));

                if (rowsToInsert.length > 0) {
                  const { error } = await supabase
                    .from("rep_coverage_areas")
                    .insert(rowsToInsert);

                  if (error) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Failed to save coverage areas.",
                    });
                    return;
                  }
                }

                toast({
                  title: "Coverage Areas Added",
                  description: `Added ${rowsToInsert.length} counties for ${data.state_name}.`,
                });
              } else {
                // Single county mode
                const payload: any = {
                  user_id: user.id,
                  state_code: data.state_code,
                  state_name: data.state_name,
                  county_id: data.county_id,
                  county_name: data.county_name,
                  coverage_mode: "selected_counties",
                  covers_entire_state: false,
                  covers_entire_county: true,
                  base_price: data.base_price ? parseFloat(data.base_price) : null,
                  rush_price: data.rush_price ? parseFloat(data.rush_price) : null,
                  region_note: data.region_note || null,
                  inspection_types: data.inspection_types?.length ? data.inspection_types : null,
                };

                if (data.id) {
                  const { error } = await supabase
                    .from("rep_coverage_areas")
                    .update(payload)
                    .eq("id", data.id);

                  if (error) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Failed to update coverage area.",
                    });
                  } else {
                    toast({
                      title: "Coverage Area Updated",
                      description: "Your coverage area has been updated.",
                    });
                  }
                } else {
                  const { error } = await supabase
                    .from("rep_coverage_areas")
                    .insert([payload]);

                  if (error) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Failed to add coverage area.",
                    });
                  } else {
                    toast({
                      title: "Coverage Area Added",
                      description: "Your coverage area has been added.",
                    });
                  }
                }
              }

              await loadRepCoverageAreas();
            }}
          />
        )}

        {isVendor && (
          <VendorCoverageDialog
            open={coverageDialogOpen}
            onOpenChange={setCoverageDialogOpen}
            editData={editingCoverage}
            onSave={async (data) => {
              if (!user) return;

              const payload: any = {
                user_id: user.id,
                state_code: data.state_code,
                state_name: data.state_name,
                coverage_mode: data.coverage_mode,
                excluded_county_ids: data.excluded_county_ids || null,
                included_county_ids: data.included_county_ids || null,
                region_note: data.region_note || null,
                inspection_types: data.inspection_types && data.inspection_types.length > 0 ? data.inspection_types : null,
              };

              if (data.id) {
                const { error } = await supabase
                  .from("vendor_coverage_areas")
                  .update(payload)
                  .eq("id", data.id);

                if (error) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to update coverage area.",
                  });
                } else {
                  toast({
                    title: "Coverage Area Updated",
                    description: "Your coverage area has been updated successfully.",
                  });
                  await loadVendorCoverageAreas();
                }
              } else {
                const { error } = await supabase
                  .from("vendor_coverage_areas")
                  .insert([payload]);

                if (error) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to add coverage area.",
                  });
                } else {
                  toast({
                    title: "Coverage Area Added",
                    description: "Your coverage area has been added successfully.",
                  });
                  await loadVendorCoverageAreas();
                }
              }
            }}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default WorkSetup;
