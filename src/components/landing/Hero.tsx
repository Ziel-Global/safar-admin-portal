import { HeroSearch } from "@/components/search/HeroSearch";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* subtle geometric accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--primary) 0, transparent 35%), radial-gradient(circle at 85% 70%, var(--accent) 0, transparent 35%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--primary) 25%, transparent 25%, transparent 75%, var(--primary) 75%), linear-gradient(45deg, var(--primary) 25%, transparent 25%, transparent 75%, var(--primary) 75%)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Verified Hajj & Umrah agents
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Find your trusted path to{" "}
            <span className="text-primary">Makkah & Madinah</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Compare packages from licensed travel agents, read real pilgrim reviews, and book with
            confidence - all in one trusted marketplace.
          </p>
        </div>

        {/* Search card */}
        <div className="mx-auto mt-10 max-w-4xl">
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}
