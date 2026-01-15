import { Map, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MapLoadPlaceholderProps {
  onLoadMap: () => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  className?: string;
  height?: string;
}

/**
 * Click-to-load placeholder for map views.
 * Avoids loading map tiles/data until user explicitly requests it.
 */
export function MapLoadPlaceholder({
  onLoadMap,
  isLoading = false,
  title = "Coverage Map",
  description = "Click to load the interactive map",
  className,
  height = "h-[400px]",
}: MapLoadPlaceholderProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent
        className={cn(
          "flex flex-col items-center justify-center gap-4",
          height
        )}
      >
        <div className="rounded-full bg-muted p-4">
          <Map className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Button onClick={onLoadMap} disabled={isLoading} variant="secondary">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Map...
            </>
          ) : (
            <>
              <Map className="mr-2 h-4 w-4" />
              Load Map
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Map tiles load on demand to reduce data usage
        </p>
      </CardContent>
    </Card>
  );
}
