import type { Ritual } from "@/lib/guides";
import { ritualGradient } from "@/lib/guides";
import { AlertTriangle, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function RitualCard({ ritual, index, total }: { ritual: Ritual; index: number; total: number }) {
  return (
    <article className="flex min-h-[calc(100vh-12rem)] flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <header
        className={cn(
          "relative bg-gradient-to-br px-6 py-10 text-white sm:px-10 sm:py-14",
          ritualGradient(ritual.slug),
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Step {index + 1} of {total}
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{ritual.name}</h2>
        {ritual.description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
            {ritual.description}
          </p>
        )}
        <div className="absolute right-6 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur sm:right-10 sm:top-10 sm:h-20 sm:w-20">
          <Sparkles className="h-6 w-6 text-white sm:h-9 sm:w-9" aria-hidden />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 space-y-6 px-6 py-8 sm:px-10">
        <section>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-4 w-4" /> Step by step
          </h3>
          <ol className="space-y-5">
            {ritual.steps.map((step) => (
              <li key={step.order} className="flex gap-4">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                    ritualGradient(ritual.slug),
                  )}
                >
                  {step.order}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">{step.text}</p>
                  {step.dua_transliteration && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      {step.dua_arabic && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-right text-xl leading-relaxed text-foreground"
                        >
                          {step.dua_arabic}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-medium italic text-primary">
                        {step.dua_transliteration}
                      </p>
                      {step.dua_translation && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          “{step.dua_translation}”
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {ritual.common_mistakes.length > 0 && (
          <section className="rounded-lg border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-950/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Common mistakes to avoid
            </h3>
            <ul className="space-y-2 text-sm text-amber-900/90 dark:text-amber-100/90">
              {ritual.common_mistakes.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
