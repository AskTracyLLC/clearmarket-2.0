import { useState } from "react";
import { NavigateFunction } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface FeedItem {
  id: string;
  type: 'message' | 'notification' | 'review' | 'opportunity' | 'connection_request' | 'alert' | 'announcement';
  title: string;
  description: string;
  timestamp: string;
  isUnread?: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

interface EarlierActivitySectionProps {
  earlierKeys: string[];
  groupedItems: { [dateKey: string]: FeedItem[] };
  getDateHeader: (dateKey: string) => string;
  getTypeColor: (type: string) => string;
  getIcon: (type: string) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  navigate: NavigateFunction;
}

export function EarlierActivitySection({
  earlierKeys,
  groupedItems,
  getDateHeader,
  getTypeColor,
  getIcon,
  getTypeLabel,
  navigate,
}: EarlierActivitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  const totalEarlierCount = earlierKeys.reduce(
    (sum, key) => sum + (groupedItems[key]?.length || 0),
    0
  );

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full"
      >
        <Card className="bg-muted/30 border-border hover:bg-muted/50 transition-colors">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  Earlier activity ({totalEarlierCount})
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                View updates from previous days
              </span>
            </div>
          </CardContent>
        </Card>
      </button>

      {expanded && (
        <div className="space-y-4 mt-2">
          {earlierKeys.map((dateKey, groupIndex) => (
            <div key={dateKey}>
              <div className={`flex items-center gap-2 ${groupIndex > 0 ? 'mt-4 pt-4 border-t border-border' : ''}`}>
                <span className="text-sm font-semibold text-foreground">
                  {getDateHeader(dateKey)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              
              <div className="space-y-2 mt-2">
                {groupedItems[dateKey].map((item) => (
                  <Card 
                    key={item.id} 
                    className={`bg-card border-border hover:border-primary/50 transition-colors cursor-pointer ${
                      item.isUnread ? 'border-l-2 border-l-primary' : ''
                    }`}
                    onClick={() => item.link && navigate(item.link)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${getTypeColor(item.type)} flex-shrink-0`}>
                          {getIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground truncate">
                              {item.title}
                            </span>
                            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${getTypeColor(item.type)}`}>
                              {getTypeLabel(item.type)}
                            </Badge>
                            {item.isUnread && (
                              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                            </div>
                            {item.metadata?.assignmentId && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  item.link && navigate(item.link);
                                }}
                              >
                                Review assignment
                              </Button>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
