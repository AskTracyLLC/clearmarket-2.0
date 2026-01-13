import { useState } from "react";
import { DemoAppShell } from "@/demo/DemoAppShell";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, MapPin, Wrench, FileText } from "lucide-react";

const STATES = [
  { code: "IL", name: "Illinois" },
  { code: "WI", name: "Wisconsin" },
  { code: "IN", name: "Indiana" },
  { code: "MI", name: "Michigan" },
];

const COUNTIES: Record<string, string[]> = {
  IL: ["Cook", "DuPage", "Lake", "Will", "Kane"],
  WI: ["Milwaukee", "Kenosha", "Waukesha", "Racine", "Dane"],
  IN: ["Lake", "Porter", "LaPorte", "St. Joseph"],
  MI: ["Wayne", "Oakland", "Macomb", "Washtenaw"],
};

const SYSTEMS = [
  "EZ Inspections",
  "IA Path",
  "WorldApp",
  "Inspect Pro",
  "ClaimRuler",
  "Other",
];

const CATEGORIES = [
  "Property Inspections",
  "Loss Insurance Claims",
  "Commercial Inspections",
  "Roof Inspections",
  "Interior Inspections",
  "Other",
];

export default function DemoRepProfile() {
  const { toast } = useToast();
  const { demoReps } = useDemoContext();
  
  const currentRep = demoReps[0];

  const [formData, setFormData] = useState({
    bio: currentRep.bio,
    selectedStates: currentRep.coverage_states,
    selectedCounties: currentRep.coverage_counties,
    selectedSystems: currentRep.systems,
    selectedCategories: currentRep.inspection_categories,
    otherCategory: "",
    lookingForWork: currentRep.looking_for_work,
  });

  const handleSave = () => {
    toast({
      title: "Profile Saved (Demo)",
      description: "Your changes have been saved. In production, this would update your profile.",
    });
  };

  const toggleSystem = (system: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedSystems: prev.selectedSystems.includes(system)
        ? prev.selectedSystems.filter((s) => s !== system)
        : [...prev.selectedSystems, system],
    }));
  };

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(category)
        ? prev.selectedCategories.filter((c) => c !== category)
        : [...prev.selectedCategories, category],
    }));
  };

  return (
    <DemoAppShell role="rep">
      <div className="container mx-auto py-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Manage your profile to get discovered by vendors
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              About You
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="Tell vendors about your experience and specialties..."
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="looking"
                checked={formData.lookingForWork}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    lookingForWork: checked === true,
                  }))
                }
              />
              <Label htmlFor="looking">I'm currently looking for work</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Coverage Areas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>States</Label>
              <div className="flex flex-wrap gap-2">
                {STATES.map((state) => (
                  <Badge
                    key={state.code}
                    variant={
                      formData.selectedStates.includes(state.code)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        selectedStates: prev.selectedStates.includes(state.code)
                          ? prev.selectedStates.filter((s) => s !== state.code)
                          : [...prev.selectedStates, state.code],
                      }));
                    }}
                  >
                    {state.name}
                  </Badge>
                ))}
              </div>
            </div>

            {formData.selectedStates.length > 0 && (
              <div className="space-y-2">
                <Label>Counties</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.selectedStates.flatMap((stateCode) =>
                    (COUNTIES[stateCode] || []).map((county) => (
                      <Badge
                        key={`${stateCode}-${county}`}
                        variant={
                          formData.selectedCounties.includes(county)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            selectedCounties: prev.selectedCounties.includes(county)
                              ? prev.selectedCounties.filter((c) => c !== county)
                              : [...prev.selectedCounties, county],
                          }));
                        }}
                      >
                        {county}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Inspection Systems
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SYSTEMS.map((system) => (
                <Badge
                  key={system}
                  variant={
                    formData.selectedSystems.includes(system)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleSystem(system)}
                >
                  {system}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspection Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <Badge
                  key={category}
                  variant={
                    formData.selectedCategories.includes(category)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
            {formData.selectedCategories.includes("Other") && (
              <div className="space-y-2">
                <Label htmlFor="otherCategory">Other Category</Label>
                <Input
                  id="otherCategory"
                  value={formData.otherCategory}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      otherCategory: e.target.value,
                    }))
                  }
                  placeholder="Specify other category..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Profile (Demo)
          </Button>
        </div>
      </div>
    </DemoAppShell>
  );
}
