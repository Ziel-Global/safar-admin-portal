import { Search, Scale, BookCheck } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: Search,
    title: "Search",
    desc: "Browse verified Hajj and Umrah packages from licensed travel agents around the world.",
  },
  {
    n: "02",
    icon: Scale,
    title: "Compare",
    desc: "Side-by-side comparisons on price, hotel proximity, agent ratings, and pilgrim reviews.",
  },
  {
    n: "03",
    icon: BookCheck,
    title: "Book",
    desc: "Reserve your package securely with trusted agents and travel with peace of mind.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border/60 bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your sacred journey, simplified
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Three simple steps from inspiration to ihram.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-sm font-bold tracking-widest text-accent">
                  {step.n}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
