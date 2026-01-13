import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DemoLayout } from "@/demo/DemoLayout";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Star, Users, Filter } from "lucide-react";

const STATES = [
  { code: "IL", name: "Illinois" },
  { code: "WI", name: "Wisconsin" },
];

const COUNTIES: Record<string, string[]> = {
  IL: ["Cook", "DuPage", "Lake", "Will"],
  WI: ["Milwaukee", "Kenosha", "Waukesha", "Racine"],
};

const CATEGORIES = [
  "Property Inspections",
  "Loss Insurance Claims",
  "Commercial",
  "Other",
];

const SYSTEMS = ["EZ Inspections", "IA Path", "WorldApp", "Inspect Pro", "Other"];

export default function DemoVendorRepSearch() {
  const navigate = useNavigate();
  const { demoReps } = useDemoContext();
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSystem, setSelectedSystem] = useState("");
  const [sortBy, setSortBy] = useState("trust");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    setHasSearched(true);
  };

  const filteredReps = demoReps.filter((rep) => {
    if (selectedState && !rep.coverage_states.includes(selectedState)) return false;
    if (selectedCategory && !rep.inspection_categories.includes(selectedCategory)) return false;
    if (selectedSystem && !rep.systems.some(s => s.includes(selectedSystem.split(" ")[0]))) return false;
    return true;
  });

  const sortedReps = [...filteredReps].sort((a, b) => {
    if (sortBy === "trust") return b.trust_score - a.trust_score;
    if (sortBy === "community") return b.community_score - a.community_score;
    return 0;
  });

  return (
    <DemoLayout role="vendor">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Find Field Reps</h1>
          <p className="text-muted-foreground">
            Search for qualified field reps in your coverage areas
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>State *</Label>
                <Select value={selectedState} onValueChange={(v) => {
                  setSelectedState(v);
                  setSelectedCounty("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>County</Label>
                <Select 
                  value={selectedCounty} 
                  onValueChange={setSelectedCounty}
                  disabled={!selectedState}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select county" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedState && COUNTIES[selectedState]?.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inspection Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>System Used</Label>
                <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any system" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEMS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label>Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trust">Trust Score</SelectItem>
                    <SelectItem value="community">Community Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={!selectedState}>
                <Search className="h-4 w-4 mr-2" />
                Search Reps
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {sortedReps.length} field rep{sortedReps.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid gap-4">
              {sortedReps.map((rep) => (
                <Card key={rep.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{rep.anonymous_id}</h3>
                          {rep.looking_for_work && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              Looking for Work
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {rep.coverage_counties.slice(0, 2).join(", ")}
                            {rep.coverage_counties.length > 2 && ` +${rep.coverage_counties.length - 2} more`}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {rep.systems.map((sys) => (
                            <Badge key={sys} variant="outline">
                              {sys}
                            </Badge>
                          ))}
                          {rep.inspection_categories.slice(0, 2).map((cat) => (
                            <Badge key={cat} variant="secondary">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-right space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-end gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">{rep.trust_score.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">Trust</span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{rep.community_score}</span>
                            <span className="text-xs text-muted-foreground">Community</span>
                          </div>
                        </div>
                        <Button 
                          onClick={() => navigate(`/demo/vendor/rep/${rep.id}`)}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {sortedReps.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      No field reps found matching your criteria. Try adjusting your filters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {!hasSearched && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Search for Field Reps</h3>
              <p className="text-sm text-muted-foreground">
                Select a state and click Search to find qualified field reps in your area.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DemoLayout>
  );
}
