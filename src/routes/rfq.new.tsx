import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarIcon,
  Check,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CityAutocomplete, type City } from "@/components/search/CityAutocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  TYPE_LABEL,
  clearDraft,
  emptyDraft,
  loadDraft,
  saveDraft,
  type RfqDraft,
  type RfqType,
  type ZonePref,
} from "@/lib/rfq";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/rfq/new")({
  head: () => ({
    meta: [
      { title: "Request a Quote - Safar" },
      {
        name: "description",
        content: "Tell us your trip preferences and receive personalised Hajj or Umrah quotes from verified agents.",
      },
    ],
  }),
  component: NewRfqPage,
});

const STEPS = ["Trip Details", "Group", "Preferences", "Review & Submit"] as const;

function NewRfqPage() {
  return (
    <ProtectedRoute requireRole="pilgrim">
      <NewRfqContent />
    </ProtectedRoute>
  );
}

function NewRfqContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RfqDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const update = <K extends keyof RfqDraft>(key: K, value: RfqDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const stepValid = useMemo(() => {
    if (step === 0)
      return Boolean(draft.type && draft.departure_city.trim() && draft.departure_country);
    if (step === 1) return draft.adults >= 1 && draft.adults <= 20;
    if (step === 2) return draft.budget_min !== null && draft.budget_max !== null;
    return true;
  }, [step, draft]);

  const goNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: rfq, error } = await supabase
        .from("rfqs")
        .insert({
          pilgrim_id: user.id,
          type: draft.type,
          departure_city: draft.departure_city,
          departure_country: draft.departure_country,
          date_from: draft.date_from,
          date_to: draft.date_to,
          adults: draft.adults,
          children: draft.children,
          children_ages: draft.children_ages,
          accessibility_needs: draft.accessibility_needs || null,
          budget_min: draft.budget_min,
          budget_max: draft.budget_max,
          budget_currency: draft.budget_currency,
          zone_pref: draft.zone_pref,
          meal_pref: draft.meal_pref,
          transport_pref: draft.transport_pref,
          notes: draft.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: matched } = await supabase.rpc("match_agents_to_rfq", { _rfq_id: rfq.id });

      clearDraft();
      toast.success("Request sent");
      navigate({
        to: "/rfq/sent",
        search: { id: rfq.id, count: typeof matched === "number" ? matched : 0 },
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not send request", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout variant="pilgrim" title="Request a Quote">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {STEPS[step]}
          </h2>
          <Progress value={((step + 1) / STEPS.length) * 100} className="mt-4 h-1.5" />
          <ol className="mt-3 hidden grid-cols-4 gap-2 text-xs sm:grid">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "rounded-md px-2 py-1.5 text-center transition-colors",
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {i + 1}. {s}
              </li>
            ))}
          </ol>
        </div>

        <Card className="border-border">
          <CardContent className="p-5 sm:p-6">
            {step === 0 ? (
              <StepTrip draft={draft} update={update} />
            ) : step === 1 ? (
              <StepGroup draft={draft} update={update} />
            ) : step === 2 ? (
              <StepPrefs draft={draft} update={update} />
            ) : (
              <StepReview draft={draft} jumpTo={setStep} />
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} disabled={!stepValid} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to agents
            </Button>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Progress is saved automatically.{" "}
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setDraft(emptyDraft);
              setStep(0);
              toast("Draft cleared");
            }}
            className="underline-offset-2 hover:underline"
          >
            Clear draft
          </button>
        </p>
      </div>
    </DashboardLayout>
  );
}

/* ---------- Step 1: Trip ---------- */
function StepTrip({
  draft,
  update,
}: {
  draft: RfqDraft;
  update: <K extends keyof RfqDraft>(k: K, v: RfqDraft[K]) => void;
}) {
  const types: RfqType[] = ["hajj", "umrah"];
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Trip type</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update("type", t)}
              className={cn(
                "rounded-lg border px-3 py-3 text-sm font-medium capitalize transition-colors",
                draft.type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-secondary",
              )}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Departure city</Label>
        <div className="mt-2">
          <CityAutocomplete
            value={draft.departure_city}
            onChange={(v) => update("departure_city", v)}
            onSelect={(c: City) => {
              update("departure_city", c.name);
              update("departure_country", c.country_code);
            }}
            placeholder="Start typing your city..."
          />
          {draft.departure_country ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {draft.departure_country}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          label="Earliest departure"
          value={draft.date_from}
          onChange={(v) => update("date_from", v)}
        />
        <DatePicker
          label="Latest return"
          value={draft.date_to}
          onChange={(v) => update("date_to", v)}
          minDate={draft.date_from}
        />
      </div>
    </div>
  );
}

function DatePicker({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  minDate?: string | null;
}) {
  const date = value ? new Date(value) : undefined;
  const min = minDate ? new Date(minDate) : new Date();
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "mt-2 w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) =>
              onChange(
                d
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                  : null,
              )
            }
            disabled={(d) => d < min}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ---------- Step 2: Group ---------- */
function StepGroup({
  draft,
  update,
}: {
  draft: RfqDraft;
  update: <K extends keyof RfqDraft>(k: K, v: RfqDraft[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <Stepper
        label="Adults"
        value={draft.adults}
        onChange={(v) => update("adults", v)}
        min={1}
        max={20}
      />
      <Stepper
        label="Children"
        value={draft.children}
        onChange={(v) => {
          update("children", v);
          const ages = [...draft.children_ages];
          while (ages.length < v) ages.push(8);
          ages.length = v;
          update("children_ages", ages);
        }}
        min={0}
        max={10}
      />
      {draft.children > 0 ? (
        <div>
          <Label className="text-sm font-medium">Children ages</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: draft.children }).map((_, i) => (
              <Input
                key={i}
                type="number"
                min={0}
                max={17}
                value={draft.children_ages[i] ?? 8}
                onChange={(e) => {
                  const ages = [...draft.children_ages];
                  ages[i] = Math.max(0, Math.min(17, Number(e.target.value)));
                  update("children_ages", ages);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Accessibility needs</Label>
            <p className="text-xs text-muted-foreground">
              Wheelchair, mobility aid, dietary, etc.
            </p>
          </div>
          <Switch
            checked={Boolean(draft.accessibility_needs)}
            onCheckedChange={(c) => update("accessibility_needs", c ? draft.accessibility_needs || " " : "")}
          />
        </div>
        {draft.accessibility_needs !== "" ? (
          <Textarea
            className="mt-3"
            rows={3}
            placeholder="Describe any accessibility needs..."
            value={draft.accessibility_needs.trim()}
            onChange={(e) => update("accessibility_needs", e.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Preferences ---------- */
function StepPrefs({
  draft,
  update,
}: {
  draft: RfqDraft;
  update: <K extends keyof RfqDraft>(k: K, v: RfqDraft[K]) => void;
}) {
  const zones: { value: ZonePref; label: string; dot: string }[] = [
    { value: "any", label: "Any", dot: "bg-muted-foreground" },
    { value: "A", label: "A - Closest", dot: "bg-emerald-500" },
    { value: "B", label: "B - Mid", dot: "bg-amber-500" },
    { value: "C", label: "C - Farther", dot: "bg-rose-500" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Budget per person</Label>
          <span className="text-sm font-semibold text-foreground">
            {formatPrice(draft.budget_min ?? 0, draft.budget_currency)} -{" "}
            {formatPrice(draft.budget_max ?? 0, draft.budget_currency)}
          </span>
        </div>
        <Slider
          className="mt-3"
          min={500}
          max={20000}
          step={100}
          value={[draft.budget_min ?? 1500, draft.budget_max ?? 5000]}
          onValueChange={([lo, hi]) => {
            update("budget_min", lo);
            update("budget_max", hi);
          }}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select
              value={draft.budget_currency}
              onValueChange={(v) => update("budget_currency", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["GBP", "USD", "EUR", "SAR", "AED"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Hotel zone</Label>
        <RadioGroup
          className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
          value={draft.zone_pref}
          onValueChange={(v) => update("zone_pref", v as ZonePref)}
        >
          {zones.map((z) => (
            <label
              key={z.value}
              htmlFor={`zone-${z.value}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                draft.zone_pref === z.value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-secondary",
              )}
            >
              <RadioGroupItem id={`zone-${z.value}`} value={z.value} className="sr-only" />
              <span className={cn("h-2.5 w-2.5 rounded-full", z.dot)} />
              <span>{z.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-sm font-medium">Meals</Label>
          <Select value={draft.meal_pref} onValueChange={(v) => update("meal_pref", v)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="breakfast">Breakfast only</SelectItem>
              <SelectItem value="half_board">Half board</SelectItem>
              <SelectItem value="full_board">Full board</SelectItem>
              <SelectItem value="none">Not required</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Transport</Label>
          <Select value={draft.transport_pref} onValueChange={(v) => update("transport_pref", v)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="flight">Flight included</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
              <SelectItem value="land_only">Land only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Notes for agents (optional)</Label>
        <Textarea
          className="mt-2"
          rows={3}
          value={draft.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Anything else agents should know - group composition, preferred airlines, etc."
        />
      </div>
    </div>
  );
}

/* ---------- Step 4: Review ---------- */
function StepReview({
  draft,
  jumpTo,
}: {
  draft: RfqDraft;
  jumpTo: (step: number) => void;
}) {
  const rows = [
    {
      step: 0,
      label: "Trip",
      items: [
        ["Type", TYPE_LABEL[draft.type]],
        ["From", `${draft.departure_city}${draft.departure_country ? `, ${draft.departure_country}` : ""}`],
        ["Dates", `${draft.date_from ?? "Any"} → ${draft.date_to ?? "Any"}`],
      ],
    },
    {
      step: 1,
      label: "Group",
      items: [
        ["Adults", String(draft.adults)],
        ["Children", draft.children > 0 ? `${draft.children} (ages ${draft.children_ages.join(", ")})` : "0"],
        ["Accessibility", draft.accessibility_needs.trim() || "None"],
      ],
    },
    {
      step: 2,
      label: "Preferences",
      items: [
        [
          "Budget",
          `${formatPrice(draft.budget_min ?? 0, draft.budget_currency)} - ${formatPrice(draft.budget_max ?? 0, draft.budget_currency)}`,
        ],
        ["Zone", draft.zone_pref === "any" ? "Any" : `Zone ${draft.zone_pref}`],
        ["Meals", draft.meal_pref],
        ["Transport", draft.transport_pref],
      ],
    },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            We'll send this to verified agents who run packages from your departure country.
            You'll typically receive quotes within <strong>24-48 hours</strong>.
          </p>
        </div>
      </div>

      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">{row.label}</h3>
            <Button variant="ghost" size="sm" onClick={() => jumpTo(row.step)}>
              Edit
            </Button>
          </div>
          <dl className="divide-y divide-border">
            {row.items.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="col-span-2 text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {draft.notes ? (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{draft.notes}</p>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Need to start over?{" "}
        <Link to="/dashboard" className="underline-offset-2 hover:underline">
          Cancel
        </Link>
      </p>
    </div>
  );
}
