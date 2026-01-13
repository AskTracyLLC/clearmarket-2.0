import { useParams, useNavigate } from "react-router-dom";
import { DemoLayout } from "@/demo/DemoLayout";
import { useDemoContext } from "@/demo/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Star,
  Users,
  Lock,
  Unlock,
  Phone,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Info,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function DemoVendorRepProfile() {
  const { repId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { demoReps, unlockedReps, unlockRep } = useDemoContext();

  const rep = demoReps.find((r) => r.id === repId);
  const isUnlocked = rep ? unlockedReps.includes(rep.id) : false;

  if (!rep) {
    return (
      <DemoLayout role="vendor">
        <div className="container mx-auto py-12 text-center">
          <p className="text-muted-foreground">Rep not found</p>
          <Button variant="link" onClick={() => navigate("/demo/vendor/search")}>
            Back to Search
          </Button>
        </div>
      </DemoLayout>
    );
  }

  const handleUnlock = () => {
    unlockRep(rep.id);
    toast({
      title: "Contact Unlocked (Demo)",
      description: `You are now connected with ${rep.real_name}. In production, this would use credits.`,
    });
  };

  const displayName = isUnlocked ? rep.real_name : rep.anonymous_id;

  return (
    <DemoLayout role="vendor">
      <div className="container mx-auto py-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/demo/vendor/search")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {isUnlocked && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  In Network
                </Badge>
              )}
              {rep.looking_for_work && (
                <Badge variant="secondary">Looking for Work</Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {rep.city}, {rep.coverage_states[0]}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{rep.trust_score.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Trust Score</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{rep.community_score}</span>
              </div>
              <p className="text-xs text-muted-foreground">Community</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{rep.bio}</p>
              </CardContent>
            </Card>

            {/* Coverage Areas */}
            <Card>
              <CardHeader>
                <CardTitle>Coverage Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {rep.coverage_counties.map((county) => (
                    <Badge key={county} variant="outline">
                      {county} County
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  States: {rep.coverage_states.join(", ")}
                </p>
              </CardContent>
            </Card>

            {/* Systems & Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Systems & Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Inspection Systems</p>
                  <div className="flex flex-wrap gap-2">
                    {rep.systems.map((sys) => (
                      <Badge key={sys} variant="secondary">
                        {sys}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Inspection Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {rep.inspection_categories.map((cat) => (
                      <Badge key={cat} variant="outline">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ratings Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Rating Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rep.reviews.length > 0 && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">On-Time</span>
                        <span className="text-sm font-medium">
                          {(rep.reviews.reduce((a, r) => a + r.on_time, 0) / rep.reviews.length).toFixed(1)}/5
                        </span>
                      </div>
                      <Progress 
                        value={(rep.reviews.reduce((a, r) => a + r.on_time, 0) / rep.reviews.length) * 20} 
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Quality</span>
                        <span className="text-sm font-medium">
                          {(rep.reviews.reduce((a, r) => a + r.quality, 0) / rep.reviews.length).toFixed(1)}/5
                        </span>
                      </div>
                      <Progress 
                        value={(rep.reviews.reduce((a, r) => a + r.quality, 0) / rep.reviews.length) * 20} 
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Communication</span>
                        <span className="text-sm font-medium">
                          {(rep.reviews.reduce((a, r) => a + r.communication, 0) / rep.reviews.length).toFixed(1)}/5
                        </span>
                      </div>
                      <Progress 
                        value={(rep.reviews.reduce((a, r) => a + r.communication, 0) / rep.reviews.length) * 20} 
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Reviews Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Verified Reviews</AlertTitle>
              <AlertDescription>
                Reviews on ClearMarket are based on real completed jobs. In production, 
                the platform prompts for feedback 2 weeks after a connection is made.
              </AlertDescription>
            </Alert>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                {isUnlocked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{rep.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{rep.email}</span>
                    </div>
                    <Badge className="w-full justify-center py-2 bg-green-500/10 text-green-600 border-green-500/20">
                      <Unlock className="h-4 w-4 mr-2" />
                      Connected
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-6 bg-muted/50 rounded-lg">
                      <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Contact info is locked
                      </p>
                    </div>
                    <Button onClick={handleUnlock} className="w-full">
                      <Unlock className="h-4 w-4 mr-2" />
                      Unlock Contact (Demo)
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      In production, unlocking uses credits
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sample Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rep.reviews.slice(0, 2).map((review, idx) => (
                  <div key={idx} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {review.date}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}
