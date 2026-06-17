import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaBand() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Begin your journey today
          </h2>
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Join thousands of pilgrims discovering trusted agents - or list your packages and reach
            pilgrims worldwide.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link to="/signup">
              Sign up as pilgrim <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to="/agent/dashboard">List as agent</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
