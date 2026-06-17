import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Baby,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  FileText,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Sun,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  generatePackingList,
  seasonTip,
  STORAGE_KEY,
  DEFAULT_PREFS,
  HEALTH_OPTIONS,
  SEASON_OPTIONS,
  type Gender,
  type HealthNeed,
  type PackingCategory,
  type PackingPrefs,
  type Season,
} from "@/lib/packing";

export const Route = createFileRoute("/tools/packing")({
  head: () => ({
    meta: [
      { title: "Packing List Generator - Safar" },
      {
        name: "description",
        content:
          "Personalised Hajj and Umrah packing list tailored to your season, trip length, gender, health needs and family.",
      },
      { property: "og:title", content: "Packing List Generator - Safar" },
      {
        property: "og:description",
        content: "Build a smart packing checklist for your pilgrimage in under a minute.",
      },
    ],
  }),
  component: PackingTool,
});

type SavedState = {
  prefs: PackingPrefs;
  categories: PackingCategory[];
  status: Record<string, boolean>;
  setupComplete: boolean;
};

function PackingTool() {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<PackingPrefs>(DEFAULT_PREFS);
  const [categories, setCategories] = useState<PackingCategory[]>([]);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [setupComplete, setSetupComplete] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.prefs && typeof parsed.prefs === "object") {
        setPrefs({ ...DEFAULT_PREFS, ...parsed.prefs });
      }
      if (Array.isArray(parsed.categories)) {
        setCategories(parsed.categories);
      }
      if (parsed.status && typeof parsed.status === "object") {
        setStatus(parsed.status);
      }
      if (
        typeof parsed.setupComplete === "boolean" &&
        Array.isArray(parsed.categories) &&
        parsed.categories.length > 0
      ) {
        setSetupComplete(parsed.setupComplete);
      }
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: SavedState = { prefs, categories, status, setupComplete };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [prefs, categories, status, setupComplete, hydrated]);

  const totalItems = useMemo(
    () => categories.reduce((sum, c) => sum + c.items.length, 0),
    [categories],
  );
  const doneCount = useMemo(
    () =>
      categories.reduce(
        (sum, c) => sum + c.items.filter((i) => status[i.id]).length,
        0,
      ),
    [categories, status],
  );
  const progress = totalItems ? Math.round((doneCount / totalItems) * 100) : 0;

  const tip = setupComplete ? seasonTip(prefs.season) : null;

  function finishSetup() {
    setCategories(generatePackingList(prefs));
    setStatus({});
    setSetupComplete(true);
  }

  function reset() {
    setSetupComplete(false);
    setStep(1);
    setPrefs(DEFAULT_PREFS);
    setCategories([]);
    setStatus({});
    setCollapsed({});
    setCustomDrafts({});
  }

  function updateQty(catIdx: number, itemIdx: number, delta: number) {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: c.items.slice() }));
      const item = next[catIdx].items[itemIdx];
      next[catIdx].items[itemIdx] = { ...item, qty: Math.max(1, item.qty + delta) };
      return next;
    });
  }

  function addCustomItem(catIdx: number) {
    const draft = customDrafts[categories[catIdx].name]?.trim();
    if (!draft) return;
    const id = `custom-${Date.now()}`;
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: c.items.slice() }));
      next[catIdx].items.push({ id, name: draft, qty: 1, custom: true });
      return next;
    });
    setCustomDrafts((d) => ({ ...d, [categories[catIdx].name]: "" }));
  }

  function removeCustomItem(catIdx: number, itemIdx: number) {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: c.items.slice() }));
      next[catIdx].items.splice(itemIdx, 1);
      return next;
    });
  }

  function copyAsText() {
    const lines = [`Safar Packing List`, ``];
    for (const cat of categories) {
      lines.push(cat.name);
      lines.push("-".repeat(cat.name.length));
      for (const item of cat.items) {
        const mark = status[item.id] ? "[x]" : "[ ]";
        lines.push(`${mark} ${item.name} × ${item.qty}`);
      }
      lines.push("");
    }
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Packing list copied to clipboard"))
      .catch(() => toast.error("Could not copy to clipboard"));
  }

  if (!setupComplete) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Packing List Generator
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Five quick questions to build a packing list tailored for you.
            </p>
          </div>

          <Card className="overflow-hidden border-border/60 shadow-sm">
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Step {step} of 5
              </div>

              {step === 1 && (
                <SeasonStep
                  value={prefs.season}
                  onChange={(season) => setPrefs({ ...prefs, season })}
                />
              )}
              {step === 2 && (
                <DurationStep
                  value={prefs.duration}
                  onChange={(duration) => setPrefs({ ...prefs, duration })}
                />
              )}
              {step === 3 && (
                <GenderStep
                  value={prefs.gender}
                  onChange={(gender) => setPrefs({ ...prefs, gender })}
                />
              )}
              {step === 4 && (
                <HealthStep
                  value={prefs.health}
                  onChange={(health) => setPrefs({ ...prefs, health })}
                />
              )}
              {step === 5 && (
                <ChildrenStep
                  withChildren={prefs.withChildren}
                  childCount={prefs.childCount}
                  onChange={(withChildren, childCount) =>
                    setPrefs({ ...prefs, withChildren, childCount })
                  }
                />
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  disabled={step === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                {step < 5 ? (
                  <Button onClick={() => setStep((s) => s + 1)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={finishSetup}>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Build my list
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8 print:py-0">
        <div className="mb-8 print:mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your Packing List
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {SEASON_OPTIONS.find((s) => s.id === prefs.season)?.label} ·{" "}
            {prefs.duration} days · {prefs.gender === "male" ? "Male" : "Female"}
            {prefs.withChildren ? ` · ${prefs.childCount} child(ren)` : ""}
          </p>
        </div>

        {tip && (
          <Card className="mb-6 border-amber-200 bg-amber-50/60 print:hidden">
            <CardContent className="flex gap-3 p-4">
              <Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">{tip.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                  {tip.body}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 print:hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                {doneCount} of {totalItems} packed
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {categories.map((cat, ci) => {
            const isCollapsed = collapsed[cat.name];
            const catDone = cat.items.filter((i) => status[i.id]).length;
            return (
              <Card key={cat.name} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [cat.name]: !c[cat.name] }))
                  }
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30 print:hover:bg-transparent"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {cat.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {catDone} of {cat.items.length} packed
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform print:hidden ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <CardContent className="space-y-2 px-5 pb-5 pt-0">
                    {cat.items.length === 0 && (
                      <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                        No items in this category for your selections.
                      </p>
                    )}
                    {cat.items.map((item, ii) => {
                      const done = !!status[item.id];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/20 print:border-muted print:hover:bg-transparent"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setStatus({ ...status, [item.id]: !done })
                            }
                            className="shrink-0 transition-transform active:scale-90"
                            aria-label={done ? "Unpack" : "Mark packed"}
                          >
                            {done ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground/50" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  done
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {item.name}
                              </span>
                              {item.community && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 gap-1 bg-primary/10 px-1.5 text-[10px] font-medium text-primary print:hidden"
                                >
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Pilgrim favourite
                                </Badge>
                              )}
                              {item.custom && (
                                <Badge
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] print:hidden"
                                >
                                  Custom
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 print:hidden">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQty(ci, ii, -1)}
                              aria-label="Decrease"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums">
                              {item.qty}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQty(ci, ii, 1)}
                              aria-label="Increase"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            {item.custom && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-1 h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => removeCustomItem(ci, ii)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          <span className="hidden text-sm font-semibold tabular-nums print:inline">
                            × {item.qty}
                          </span>
                        </div>
                      );
                    })}

                    <div className="flex gap-2 pt-2 print:hidden">
                      <Input
                        placeholder="Add a custom item…"
                        value={customDrafts[cat.name] ?? ""}
                        onChange={(e) =>
                          setCustomDrafts((d) => ({ ...d, [cat.name]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomItem(ci);
                          }
                        }}
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addCustomItem(ci)}
                        disabled={!customDrafts[cat.name]?.trim()}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 border-dashed bg-muted/20 print:hidden">
          <CardContent className="flex items-start gap-3 p-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Don't forget your documents
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Track passport, visa, vaccination certificates and Mahram letters in
                the document checklist.
              </p>
              <Link
                to="/tools/checklist"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Open Document Checklist →
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()} variant="default">
            <Printer className="mr-2 h-4 w-4" />
            Print list
          </Button>
          <Button onClick={copyAsText} variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy as text
          </Button>
          <Button onClick={reset} variant="ghost">
            <RefreshCw className="mr-2 h-4 w-4" />
            Start over
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

// ---------------- Step components ----------------

function SeasonStep({
  value,
  onChange,
}: {
  value: Season;
  onChange: (s: Season) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">When are you travelling?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the season - it shapes your clothing and health items.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEASON_OPTIONS.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className="text-sm font-semibold text-foreground">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.months}</span>
              {active && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DurationStep({
  value,
  onChange,
}: {
  value: number;
  onChange: (d: number) => void;
}) {
  const clamp = (n: number) => Math.max(5, Math.min(30, n));
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">How long is your trip?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Most Umrah trips are 7–14 days; Hajj packages run 15–25 days.
      </p>
      <div className="mt-8 flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 5}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <div className="text-5xl font-bold tabular-nums text-foreground">{value}</div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            days
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= 30}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Range: 5 – 30 days</p>
    </div>
  );
}

function GenderStep({
  value,
  onChange,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
}) {
  const options: { id: Gender; label: string; emoji: string; sub: string }[] = [
    { id: "male", label: "Male", emoji: "🕋", sub: "Includes Ihram cloth & belt" },
    { id: "female", label: "Female", emoji: "🌙", sub: "Includes abaya & hijabs" },
  ];
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Travelling as?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This adjusts Ihram and clothing items.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-6 text-center transition-all ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <span className="text-4xl">{o.emoji}</span>
              <span className="text-base font-semibold text-foreground">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.sub}</span>
              {active && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HealthStep({
  value,
  onChange,
}: {
  value: HealthNeed[];
  onChange: (v: HealthNeed[]) => void;
}) {
  function toggle(id: HealthNeed) {
    if (id === "none") {
      onChange(value.includes("none") ? [] : ["none"]);
      return;
    }
    const without = value.filter((v) => v !== "none");
    onChange(
      without.includes(id) ? without.filter((v) => v !== id) : [...without, id],
    );
  }
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Any health needs?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select all that apply - we'll add the right medical items.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {HEALTH_OPTIONS.map((h) => {
          const active = value.includes(h.id);
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => toggle(h.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {active && <Check className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />}
              {h.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChildrenStep({
  withChildren,
  childCount,
  onChange,
}: {
  withChildren: boolean;
  childCount: number;
  onChange: (withChildren: boolean, childCount: number) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">
        Travelling with children?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll add child snacks, clothing, and basic medication if needed.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { val: false, label: "No" },
          { val: true, label: "Yes" },
        ].map((o) => {
          const active = withChildren === o.val;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() =>
                onChange(o.val, o.val ? Math.max(1, childCount) : 0)
              }
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-all ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <Baby
                className={`h-7 w-7 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="text-base font-semibold text-foreground">{o.label}</span>
              {active && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {withChildren && (
        <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-5">
          <div className="text-sm font-medium text-foreground">How many?</div>
          <div className="mt-3 flex items-center justify-center gap-5">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => onChange(true, Math.max(1, childCount - 1))}
              disabled={childCount <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[2.5rem] text-center text-3xl font-bold tabular-nums text-foreground">
              {childCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => onChange(true, Math.min(8, childCount + 1))}
              disabled={childCount >= 8}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
