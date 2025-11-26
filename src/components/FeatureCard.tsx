import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface FeatureCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export const FeatureCard = ({ icon, title, description, className = "" }: FeatureCardProps) => {
  return (
    <Card className={`p-6 bg-card border-border hover:border-primary/30 transition-all duration-300 hover:shadow-primary-glow ${className}`}>
      {icon && <div className="mb-4 text-primary">{icon}</div>}
      <h3 className="text-xl font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </Card>
  );
};
