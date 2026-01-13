import { useState } from "react";
import { DemoLayout } from "@/demo/DemoLayout";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Building2, Search, ExternalLink } from "lucide-react";

export default function DemoRepVendorDirectory() {
  const { demoVendors } = useDemoContext();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVendors = demoVendors.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.coverage_states.some((s) =>
        s.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  return (
    <DemoLayout role="rep">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Vendor Directory</h1>
          <p className="text-muted-foreground">
            Browse vendors looking for field reps
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors by name or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Vendor List */}
        <div className="grid gap-4">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold text-lg">{vendor.name}</h3>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {vendor.coverage_states.join(", ")} •{" "}
                        {vendor.coverage_counties.slice(0, 3).join(", ")}
                        {vendor.coverage_counties.length > 3 &&
                          ` +${vendor.coverage_counties.length - 3} more`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {vendor.systems.map((sys) => (
                        <Badge key={sys} variant="outline">
                          {sys}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {vendor.description}
                    </p>
                  </div>

                  <Button variant="outline">
                    View Details
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredVendors.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No vendors found matching your search.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DemoLayout>
  );
}
