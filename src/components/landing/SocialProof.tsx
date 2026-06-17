import { Star, Quote } from "lucide-react";

const stats = [
  { value: "10,000+", label: "Pilgrims served" },
  { value: "200+", label: "Verified agents" },
  { value: "4.9★", label: "Average rating" },
  { value: "30+", label: "Countries" },
];

const testimonials = [
  {
    name: "Aisha R.",
    location: "London, UK",
    quote:
      "Safar made finding a trusted agent so easy. The reviews helped us pick the right package for our family.",
  },
  {
    name: "Yusuf M.",
    location: "Toronto, CA",
    quote:
      "Compared a dozen Umrah packages in minutes. Booking was seamless and the agent was excellent.",
  },
  {
    name: "Fatima K.",
    location: "Kuala Lumpur, MY",
    quote:
      "Beautifully simple. I felt confident every step of the way to Makkah. Alhamdulillah.",
  },
];

const agencies = ["Al-Noor Travel", "Madinah Tours", "Barakah Hajj", "Sakinah Group", "Kausar Travel"];

export function SocialProof() {
  return (
    <section className="border-t border-border/60 bg-secondary/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
            Social proof
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by pilgrims worldwide
          </h2>
        </div>

        {/* Stats strip */}
        <div className="mt-10 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-primary sm:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agency logos */}
        <div className="mt-10 grid grid-cols-2 items-center justify-items-center gap-6 opacity-70 sm:grid-cols-3 md:grid-cols-5">
          {agencies.map((name) => (
            <div
              key={name}
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="relative rounded-2xl border border-border bg-card p-6"
            >
              <Quote className="absolute right-5 top-5 h-6 w-6 text-accent/40" />
              <div className="flex items-center gap-1 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-relaxed text-foreground/90">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-4 border-t border-border pt-3">
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.location}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
