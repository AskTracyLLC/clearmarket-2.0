import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";
import { Search, Shield, TrendingUp, Users, MapPin, MessageSquare, Star, Award } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
          Welcome to ClearMarket
        </h1>
        <p className="text-xl md:text-2xl mb-12 text-muted-foreground max-w-3xl mx-auto">
          The professional network connecting field representatives with vendors in the property inspection industry.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link to="/signup?role=rep">
            <Button size="lg" variant="default" className="w-full sm:w-auto min-w-[200px] shadow-primary-glow">
              I'm a Field Rep
            </Button>
          </Link>
          <Link to="/signup?role=vendor">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto min-w-[200px] shadow-secondary-glow">
              I'm a Vendor
            </Button>
          </Link>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Free to join. No dispatching. You stay independent.
        </p>
        
        <div className="mt-6">
          <Link to="/signin" className="text-muted-foreground hover:text-primary transition-colors">
            Already have an account? <span className="text-primary underline">Sign In</span>
          </Link>
        </div>
      </header>

      {/* Three Feature Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Search size={32} />}
            title="Find Work"
            description="Connect with vendors seeking field reps in your coverage areas. Search by location, systems used, and inspection type."
          />
          <FeatureCard
            icon={<Shield size={32} />}
            title="Build Trust"
            description="Earn a reputation based on verified work, not popularity contests. Reviews and scores come from confirmed vendor–rep connections."
          />
          <FeatureCard
            icon={<TrendingUp size={32} />}
            title="Grow Network"
            description="Build a professional network of vendors and reps nationwide while staying in control of who you choose to work with."
          />
        </div>
      </section>

      {/* How ClearMarket Works */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold mb-6 text-foreground">How ClearMarket Works</h2>
          <p className="text-lg text-muted-foreground mb-4">
            Smarter connections. Stronger reputation. More of the right work.
          </p>
          <p className="text-muted-foreground">
            ClearMarket helps independent Field Reps and Property Inspection Vendors connect with confidence — bringing transparency, trust, and performance to an industry that's often chaotic and underpaid.
          </p>
        </div>

        {/* For Field Reps */}
        <div className="mb-20">
          <div className="max-w-4xl mx-auto mb-8">
            <h3 className="text-3xl font-bold mb-2 text-foreground">For Field Reps</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <Link to="/signup?role=rep" className="text-secondary hover:underline">Looking for work?</Link>
            </p>
            <p className="text-muted-foreground">
              Create a free profile, list your coverage areas and systems, and connect with vetted vendors seeking reliable field representatives.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Users size={24} />}
              title="Create a profile"
              description="Free to join"
            />
            <FeatureCard
              icon={<MapPin size={24} />}
              title="Be seen"
              description="By vetted vendors"
            />
            <FeatureCard
              icon={<MessageSquare size={24} />}
              title="Message"
              description="Your network"
            />
            <FeatureCard
              icon={<Star size={24} />}
              title="Build reputation"
              description="Earn verified reviews"
            />
          </div>
        </div>

        {/* For Vendors */}
        <div>
          <div className="max-w-4xl mx-auto mb-8">
            <h3 className="text-3xl font-bold mb-2 text-foreground">For Vendors</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <Link to="/signup?role=vendor" className="text-secondary hover:underline">Need reliable coverage?</Link>
            </p>
            <p className="text-muted-foreground">
              Post Seeking Coverage, filter reps by region and systems, and unlock contact details to build your trusted network.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<TrendingUp size={24} />}
              title="Post Coverage"
              description="Seeking Coverage posts"
            />
            <FeatureCard
              icon={<Search size={24} />}
              title="Search & filter"
              description="Find the right reps"
            />
            <FeatureCard
              icon={<Users size={24} />}
              title="Unlock & connect"
              description="Build your network"
            />
            <FeatureCard
              icon={<Award size={24} />}
              title="Monitor performance"
              description="Track over time"
            />
          </div>
        </div>
      </section>

      {/* Trust Matters */}
      <section className="container mx-auto px-4 py-20 bg-card/30 rounded-3xl">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-6 text-foreground">Trust Matters</h2>
          <p className="text-muted-foreground">
            ClearMarket focuses on verified, reputation-based connections — not anonymous job boards or mass blasts. Build relationships that matter.
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="text-primary" size={32} />
            </div>
            <p className="font-semibold text-foreground">Professionalism</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center">
              <Award className="text-secondary" size={32} />
            </div>
            <p className="font-semibold text-foreground">Reliability</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Star className="text-primary" size={32} />
            </div>
            <p className="font-semibold text-foreground">Positive verified reviews</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center">
              <Users className="text-secondary" size={32} />
            </div>
            <p className="font-semibold text-foreground">Community engagement</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        <p>&copy; 2025 ClearMarket. Professional connections for field reps and vendors.</p>
      </footer>
    </div>
  );
};

export default Index;
