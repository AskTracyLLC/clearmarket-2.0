import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Award, MapPin, MessageSquare, Search, Shield, ShieldCheck, Star, TrendingUp, Users } from "lucide-react";
import { FeatureCard } from "@/components/FeatureCard";
const Index = () => {
  return <div className="min-h-screen flex flex-col">
      {/* Navigation/Header - simplified for landing */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/images/clearmarket-logo.jpg"
              alt="ClearMarket"
              className="h-8 w-8 rounded"
            />
            <span className="text-xl font-bold text-primary">ClearMarket</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/demo">
              <Button variant="outline" size="sm">
                View Demo
              </Button>
            </Link>
            <Link to="/signin">
              
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-16 md:py-24 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          Tired of chasing work through group chats and cold calls?
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
          ClearMarket is the professional network built for the property inspection industry. Field reps get found. Vendors get reliable coverage. Everyone gets paid.
        </p>

        {/* Role Selection Buttons - pass role param to signup/onboarding */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/signup?role=rep">
            <Button size="lg" className="min-w-[180px]">
              Join as a Field Rep
            </Button>
          </Link>
          <Link to="/signup?role=vendor">
            <Button size="lg" variant="secondary" className="min-w-[180px]">
              Join as a Vendor
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Free to join · No monthly fees for field reps · Built by people who know the industry
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link to="/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      {/* Three Feature Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard icon={<Search size={32} />} title="Find Work" description="Connect with vendors seeking field reps in your coverage areas. Search by location, systems used, and inspection type." />
          <FeatureCard icon={<Shield size={32} />} title="Build Trust" description="Earn a reputation based on verified work, not popularity contests. Reviews and scores come from confirmed vendor–rep connections." />
          <FeatureCard icon={<TrendingUp size={32} />} title="Grow Network" description="Build a professional network of vendors and reps nationwide while staying in control of who you choose to work with." />
        </div>
      </section>

      {/* How ClearMarket Works */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold mb-6 text-foreground">How ClearMarket Works</h2>
          <p className="text-lg text-muted-foreground mb-4">
            Two sides of the same industry. One platform that finally connects them.
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
            <FeatureCard icon={<Users size={24} />} title="Create a profile" description="Free to join" />
            <FeatureCard icon={<MapPin size={24} />} title="Be seen" description="By vetted vendors" />
            <FeatureCard icon={<MessageSquare size={24} />} title="Message" description="Your network" />
            <FeatureCard icon={<Star size={24} />} title="Build reputation" description="Earn verified reviews" />
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
              Post Seeking Coverage, filter reps by region and systems, and connect directly to build your trusted network.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FeatureCard icon={<TrendingUp size={24} />} title="Post Coverage" description="Seeking Coverage posts" />
            <FeatureCard icon={<Search size={24} />} title="Search & filter" description="Find the right reps" />
            <FeatureCard icon={<Users size={24} />} title="Connect directly" description="Build your network" />
            <FeatureCard icon={<Award size={24} />} title="Monitor performance" description="Track over time" />
          </div>
        </div>
      </section>

      {/* Trust Matters */}
      <section className="container mx-auto px-4 py-20 bg-card/30 rounded-3xl">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-6 text-foreground">Reputation Over Randomness</h2>
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

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4 text-foreground">Ready to stop working the old way?</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Join field reps and vendors who are building their networks the smarter way.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup?role=rep">
            <Button size="lg" className="min-w-[180px]">
              Join as a Field Rep
            </Button>
          </Link>
          <Link to="/signup?role=vendor">
            <Button size="lg" variant="secondary" className="min-w-[180px]">
              Join as a Vendor
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Free for field reps. No credit card required. Takes less than 2 minutes.
        </p>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        <p>&copy; 2026 ClearMarket. Professional connections for field reps and vendors.</p>
      </footer>
    </div>;
};
export default Index;