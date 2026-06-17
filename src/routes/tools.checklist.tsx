import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Circle, Info, Share2, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  COUNTRY_OPTIONS,
  FALLBACK_ITEMS,
  type ChecklistItem,
  deadlineLabel,
  groupChecklistBySection,
  urgencyClasses,
  urgencyFor,
} from "@/lib/checklist";

type ChecklistSearch = {
  country?: string;
  trip?: "hajj" | "umrah";
  date?: string;
  done?: string;
  readonly?: string;
};

export const Route = createFileRoute("/tools/checklist")({
  validateSearch: (s: Record<string, unknown>): ChecklistSearch => ({
    country: typeof s.country === "string" ? s.country : undefined,
    trip: s.trip === "hajj" || s.trip === "umrah" ? s.trip : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    done: typeof s.done === "string" ? s.done : undefined,
    readonly: typeof s.readonly === "string" ? s.readonly : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Document Checklist - Safar" },
      {
        name: "description",
        content:
          "Personalised Hajj and Umrah document checklist with deadline tracking by country and trip type.",
      },
    ],
  }),
  component: ChecklistTool,
});

type Template = {
  id: string;
  country_code: string;
  trip_type: "hajj" | "umrah";
  items: ChecklistItem[];
  isFallback?: boolean;
};

const LS_KEY = "safar.checklist.v1";
type LocalState = {
  country: string;
  trip: "hajj" | "umrah";
  tripDate: string;
  status: Record<string, boolean>;
};

function loadLocal(): LocalState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LocalState) : null;
  } catch {
    return null;
  }
}
function saveLocal(s: LocalState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="fill-none stroke-primary transition-all duration-500"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-foreground">{pct}%</div>
        <div className="text-[11px] text-muted-foreground">
          {done} / {total}
        </div>
      </div>
    </div>
  );
}

function ChecklistTool() {
  const { user, profile } = useAuth();
  const search = useSearch({ from: "/tools/checklist" });
  const isReadonly = search.readonly === "1";

  const local = useMemo(() => loadLocal(), []);
  const initialCountry =
    search.country ?? local?.country ?? profile?.country_code ?? "";
  const initialTrip: "hajj" | "umrah" | "" = search.trip ?? local?.trip ?? "";
  const initialDate = search.date ?? local?.tripDate ?? "";

  const [country, setCountry] = useState<string>(initialCountry);
  const [tripType, setTripType] = useState<"hajj" | "umrah" | "">(initialTrip);
  const [tripDate, setTripDate] = useState<string>(initialDate);
  const [hasSetup, setHasSetup] = useState<boolean>(
    Boolean(initialCountry && initialTrip),
  );

  const [template, setTemplate] = useState<Template | null>(null);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>(
    () => local?.status ?? {},
  );
  const [loading, setLoading] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Apply readonly status from URL (?done=id1,id2,...)
  useEffect(() => {
    if (isReadonly && search.done) {
      const ids = search.done.split(",").filter(Boolean);
      const next: Record<string, boolean> = {};
      ids.forEach((id: string) => {
        next[id] = true;
      });
      setStatus(next);
    }
  }, [isReadonly, search.done]);

  // Fetch matching template
  useEffect(() => {
    if (!country || !tripType) {
      setTemplate(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("checklist_templates")
        .select("id, country_code, trip_type, items")
        .eq("country_code", country)
        .eq("trip_type", tripType)
        .eq("locale", "en")
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setTemplate({
          id: data.id,
          country_code: data.country_code,
          trip_type: data.trip_type as "hajj" | "umrah",
          items: (data.items as unknown as ChecklistItem[]) ?? [],
        });
      } else {
        setTemplate({
          id: "fallback",
          country_code: country,
          trip_type: tripType,
          items: FALLBACK_ITEMS,
          isFallback: true,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [country, tripType]);

  // Load saved checklist for logged-in users (skip in readonly)
  useEffect(() => {
    if (isReadonly) return;
    if (!user || !template || template.isFallback) {
      setChecklistId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pilgrim_checklists")
        .select("id, items_status, trip_date")
        .eq("pilgrim_id", user.id)
        .eq("template_id", template.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setChecklistId(data.id);
        setStatus((data.items_status as Record<string, boolean>) ?? {});
        if (data.trip_date) setTripDate(data.trip_date);
      } else {
        setChecklistId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, template, isReadonly]);

  const sections = useMemo(
    () => (template ? groupChecklistBySection(template.items) : []),
    [template],
  );
  const totalItems = template?.items.length ?? 0;
  const doneCount = template
    ? template.items.filter((i) => status[i.id]).length
    : 0;
  const tripDateObj = tripDate ? new Date(tripDate) : null;

  const persist = async (
    nextStatus: Record<string, boolean>,
    nextTripDate: string,
  ) => {
    // Always persist locally as backup
    if (country && tripType) {
      saveLocal({ country, trip: tripType, tripDate: nextTripDate, status: nextStatus });
    }
    if (!user || !template || template.isFallback) return;

    if (checklistId) {
      const { error } = await supabase
        .from("pilgrim_checklists")
        .update({ items_status: nextStatus, trip_date: nextTripDate || null })
        .eq("id", checklistId);
      if (error) toast.error("Failed to save");
    } else {
      const { data, error } = await supabase
        .from("pilgrim_checklists")
        .insert({
          pilgrim_id: user.id,
          template_id: template.id,
          items_status: nextStatus,
          trip_date: nextTripDate || null,
        })
        .select("id")
        .single();
      if (error) toast.error("Failed to create checklist");
      else setChecklistId(data.id);
    }
  };

  const toggleItem = (id: string) => {
    if (isReadonly) return;
    const next = { ...status, [id]: !status[id] };
    if (next[id]) {
      setAnimatingId(id);
      setTimeout(() => setAnimatingId(null), 400);
    }
    setStatus(next);
    void persist(next, tripDate);
  };

  const onTripDateChange = (val: string) => {
    setTripDate(val);
    void persist(status, val);
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !tripType) {
      toast.error("Please select a country and trip type");
      return;
    }
    setHasSetup(true);
    saveLocal({ country, trip: tripType, tripDate, status });
  };

  const handleShare = async () => {
    if (!template) return;
    const doneIds = Object.entries(status)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",");
    const params = new URLSearchParams({
      country,
      trip: tripType,
      readonly: "1",
    });
    if (tripDate) params.set("date", tripDate);
    if (doneIds) params.set("done", doneIds);
    const url = `${window.location.origin}/tools/checklist?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleReset = async () => {
    setStatus({});
    if (user && checklistId) {
      await supabase
        .from("pilgrim_checklists")
        .update({ items_status: {} })
        .eq("id", checklistId);
    }
    if (country && tripType) {
      saveLocal({ country, trip: tripType, tripDate, status: {} });
    }
    toast.success("Checklist reset");
  };

  // ===== SETUP CARD =====
  if (!hasSetup && !isReadonly) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Document Checklist
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A personalised, deadline-aware checklist for your pilgrimage. Two quick
              questions to get started.
            </p>
          </div>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSetupSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-base font-medium">
                    Where are you travelling from?
                  </Label>
                  <Select value={country || undefined} onValueChange={setCountry}>
                    <SelectTrigger id="country" className="h-12">
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Hajj or Umrah?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["umrah", "hajj"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTripType(t)}
                        className={`flex h-12 items-center justify-center rounded-md border-2 text-base font-medium capitalize transition-all ${
                          tripType === t
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                        aria-pressed={tripType === t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" size="lg" className="h-12 w-full">
                  Build my checklist
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  // ===== CHECKLIST VIEW =====
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Document Checklist
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {COUNTRY_OPTIONS.find((c) => c.code === country)?.name ?? country} ·{" "}
              <span className="capitalize">{tripType}</span>
              {isReadonly && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Read-only view
                </span>
              )}
            </p>
          </div>
          {!isReadonly && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset checklist?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This unchecks every item. Your trip date and country selection
                      are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {!isReadonly && (
          <Card className="mb-6">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <Label htmlFor="setup-country" className="text-xs">Country</Label>
                <Select value={country || undefined} onValueChange={setCountry}>
                  <SelectTrigger id="setup-country" className="mt-1.5">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="setup-trip" className="text-xs">Trip type</Label>
                <Select
                  value={tripType || undefined}
                  onValueChange={(v) => setTripType(v as "hajj" | "umrah")}
                >
                  <SelectTrigger id="setup-trip" className="mt-1.5">
                    <SelectValue placeholder="Select trip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="umrah">Umrah</SelectItem>
                    <SelectItem value="hajj">Hajj</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="setup-date" className="text-xs">Trip date</Label>
                <Input
                  id="setup-date"
                  type="date"
                  value={tripDate}
                  onChange={(e) => onTripDateChange(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {!user && !isReadonly && (
          <Card className="mb-6 border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                Your progress is saved on this device. <a href="/login" className="font-semibold underline">Sign in</a> to sync across devices.
              </div>
            </CardContent>
          </Card>
        )}

        {template?.isFallback && (
          <Card className="mb-6 border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                We don't have a country-specific checklist for{" "}
                {COUNTRY_OPTIONS.find((c) => c.code === country)?.name ?? country}{" "}
                yet. Showing a general pilgrimage checklist.
              </span>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading checklist…</p>
        ) : !template ? (
          <p className="text-sm text-muted-foreground">No checklist available.</p>
        ) : (
          <>
            <Card className="mb-6 bg-gradient-to-br from-background to-muted/30">
              <CardContent className="flex items-center gap-6 p-6">
                <ProgressRing done={doneCount} total={totalItems} />
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {doneCount} of {totalItems} complete
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tripDate
                      ? `Departure: ${new Date(tripDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`
                      : "Set a trip date for personalised deadlines."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {sections.map((section) => (
                <Card key={section.name}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{section.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {section.items.map((item) => {
                      const done = !!status[item.id];
                      const u = urgencyFor(done, tripDateObj, item.deadline_offset_days);
                      const cls = urgencyClasses(u);
                      const isAnimating = animatingId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          disabled={isReadonly}
                          className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                            done
                              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                              : "border-border/60 hover:border-border hover:bg-muted/40"
                          } ${isReadonly ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="relative mt-0.5 shrink-0">
                            {done ? (
                              <CheckCircle2
                                className={`h-6 w-6 text-emerald-600 ${isAnimating ? "animate-in zoom-in-50 duration-300" : ""}`}
                              />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground/60" />
                            )}
                            {isAnimating && (
                              <Check className="absolute inset-0 m-auto h-3 w-3 animate-ping text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                            >
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              Deadline:{" "}
                              {deadlineLabel(tripDateObj, item.deadline_offset_days)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium ${cls.text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
                            {cls.label}
                          </span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
