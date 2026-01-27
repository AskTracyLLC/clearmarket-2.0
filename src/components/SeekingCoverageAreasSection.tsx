import { MapPin } from "lucide-react";

interface SeekingCoverageArea {
  state_code: string;
  counties: string[];
}

interface SeekingCoverageAreasSectionProps {
  areas: SeekingCoverageArea[];
}

export function SeekingCoverageAreasSection({ areas }: SeekingCoverageAreasSectionProps) {
  if (!areas || areas.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        Currently seeking field reps in…
      </h3>
      <div className="space-y-1.5">
        {areas.map((area) => (
          <p key={area.state_code} className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{area.state_code}</span>
            {" - "}
            {area.counties.join(", ")}
          </p>
        ))}
      </div>
    </div>
  );
}
