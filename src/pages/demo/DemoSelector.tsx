import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, User, HelpCircle, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function DemoSelector() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">
            ClearMarket
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/signin">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Welcome to Demo Mode
            </h1>
            <p className="text-lg text-muted-foreground">
              Experience ClearMarket without creating an account. Choose a role to explore.
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Vendor Demo */}
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Vendor Demo</CardTitle>
                <CardDescription>
                  See how Vendors search coverage and unlock contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                  <li>• Search for Field Reps by area and skills</li>
                  <li>• View Trust Scores and Community ratings</li>
                  <li>• Simulate unlocking contact information</li>
                  <li>• Explore the Community Board</li>
                </ul>
                <Link to="/demo/vendor">
                  <Button className="w-full">Enter Vendor Demo</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Field Rep Demo */}
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-foreground" />
                </div>
                <CardTitle>Field Rep Demo</CardTitle>
                <CardDescription>
                  See how Reps build profiles and get discovered
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
                  <li>• Build a professional profile</li>
                  <li>• Set coverage areas and systems</li>
                  <li>• Browse the Vendor Directory</li>
                  <li>• Engage with the Community Board</li>
                </ul>
                <Link to="/demo/rep">
                  <Button variant="secondary" className="w-full">
                    Enter Field Rep Demo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Accordion */}
          <div className="mt-12 text-left">
            <Accordion type="single" collapsible>
              <AccordionItem value="what-is-demo">
                <AccordionTrigger className="text-left">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    What is Demo Mode?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Demo Mode lets you explore ClearMarket's features without creating an account 
                  or entering any payment information. All actions in Demo Mode use simulated 
                  data and don't affect real users or require real credits. It's the perfect 
                  way to see how the platform works for both Vendors and Field Reps.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Help Center & Back to home */}
          <div className="pt-8 flex flex-col items-center gap-4">
            <Link to="/public-help" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80">
              <BookOpen className="h-4 w-4" />
              View Help Center
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
