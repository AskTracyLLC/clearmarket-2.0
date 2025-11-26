import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Building } from "lucide-react";

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [user, authLoading, navigate]);

  const handleRoleSelect = async (role: 'rep' | 'vendor') => {
    if (!user) return;

    setLoading(true);

    const updates = role === 'rep' 
      ? { is_fieldrep: true }
      : { is_vendor_admin: true };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Role selected!",
      description: "Proceeding to terms agreement...",
    });

    navigate("/onboarding/terms");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Choose Your Role</h1>
          <p className="text-xl text-muted-foreground">
            How will you be using ClearMarket?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card 
            className="p-8 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-primary-glow group"
            onClick={() => !loading && handleRoleSelect('rep')}
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Briefcase className="text-primary" size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">I'm a Field Rep</h2>
              <p className="text-muted-foreground mb-6">
                Find work, build your reputation, and connect with vetted vendors in your coverage areas.
              </p>
              <Button 
                size="lg" 
                className="w-full"
                disabled={loading}
              >
                Continue as Field Rep
              </Button>
            </div>
          </Card>

          <Card 
            className="p-8 cursor-pointer hover:border-secondary transition-all duration-300 hover:shadow-secondary-glow group"
            onClick={() => !loading && handleRoleSelect('vendor')}
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Building className="text-secondary" size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">I'm a Vendor</h2>
              <p className="text-muted-foreground mb-6">
                Post seeking coverage, find reliable field reps, and build your professional network.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                className="w-full"
                disabled={loading}
              >
                Continue as Vendor
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
