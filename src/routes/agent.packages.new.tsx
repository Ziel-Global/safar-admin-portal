import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Loader2, Star } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PackagePreviewCard, type PackageDraft } from "@/components/agent/PackagePreviewCard";
import type { PackageMediaItem } from "@/components/agent/PackageMediaManager";
import type { City } from "@/components/agent/CitySelect";
// Heavy sub-components — code-split so the form shell renders without waiting on them
const PackageMediaManager = lazy(() =>
  import("@/components/agent/PackageMediaManager").then((m) => ({ default: m.PackageMediaManager })),
);
const PackageTiersManager = lazy(() =>
  import("@/components/agent/PackageTiersManager").then((m) => ({ default: m.PackageTiersManager })),
);
const CitySelect = lazy(() =>
  import("@/components/agent/CitySelect").then((m) => ({ default: m.CitySelect })),
);

const SubLoading = () => (
  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
  </div>
);

export const Route = createFileRoute("/agent/packages/new")({
  head: () => ({
    meta: [
      { title: "New Package - Safar" },
      { name: "description", content: "Create a new Hajj or Umrah package." },
    ],
  }),
  component: () => (
    <ProtectedRoute requireRole="agent">
      <PackageEditorPage />
    </ProtectedRoute>
  ),
});

export function PackageEditorPage({ existingId }: { existingId?: string } = {}) {
  return <NewPackagePage existingId={existingId} />;
}

const initialDraft: PackageDraft = {
  title: "",
  type: "",
  departure_city: "",
  departure_country: "",
  date_start: "",
  date_end: "",
  hotel_name: "",
  hotel_stars: null,
  hotel_zone: "",
  distance_to_haram_m: null,
  meals_included: "",
  transport_type: "",
  visa_included: false,
  flights_included: false,
  base_price: "",
  currency: "GBP",
};

const knownHotels: Record<string, number> = {
  "Fairmont Makkah Clock Royal Tower": 50,
  "Swissôtel Makkah": 80,
  "Hilton Suites Makkah": 200,
  "Pullman Zamzam Makkah": 150,
  "Anjum Makkah": 350,
};

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function NewPackagePage({ existingId }: { existingId?: string } = {}) {
  const { agent, user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PackageDraft>(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(existingId ?? null);
  const [media, setMedia] = useState<PackageMediaItem[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(existingId));
  const creatingRef = useRef(false);

  // Load existing package when editing
  useEffect(() => {
    if (!existingId) return;
    (async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", existingId)
        .single();
      if (error || !data) {
        toast.error("Could not load package");
        setLoadingExisting(false);
        return;
      }
      const p = data as Record<string, unknown>;
      setDraft({
        title: (p.title as string) ?? "",
        type: (p.type as PackageDraft["type"]) ?? "",
        departure_city: (p.departure_city as string) ?? "",
        departure_country: (p.departure_country as string) ?? "",
        date_start: (p.date_start as string) ?? "",
        date_end: (p.date_end as string) ?? "",
        hotel_name: (p.hotel_name as string) ?? "",
        hotel_stars: (p.hotel_stars as number | null) ?? null,
        hotel_zone: ((p.hotel_zone as PackageDraft["hotel_zone"]) ?? ""),
        distance_to_haram_m: (p.distance_to_haram_m as number | null) ?? null,
        meals_included: ((p.meals_included as PackageDraft["meals_included"]) ?? ""),
        transport_type: ((p.transport_type as PackageDraft["transport_type"]) ?? ""),
        visa_included: Boolean(p.visa_included),
        flights_included: Boolean(p.flights_included),
        base_price: p.base_price != null ? String(p.base_price) : "",
        currency: (p.currency as string) ?? "GBP",
      });
      setLoadingExisting(false);
    })();
  }, [existingId]);

  // Create a draft package row once on mount so media uploads have a target (only when creating new)
  useEffect(() => {
    if (existingId) return;
    if (!agent?.id || packageId || creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      const { data, error } = await supabase
        .from("packages")
        .insert({
          agent_id: agent.id,
          title: "Untitled package",
          type: "umrah",
          departure_city: "",
          departure_country: "",
          status: "draft",
          currency: "GBP",
        })
        .select("id")
        .single();
      if (error) {
        toast.error(`Could not create draft: ${error.message}`);
        creatingRef.current = false;
        return;
      }
      setPackageId(data.id);
    })();
  }, [agent?.id, packageId, existingId]);

  const update = <K extends keyof PackageDraft>(key: K, value: PackageDraft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "hotel_name" && typeof value === "string") {
        const match = Object.entries(knownHotels).find(
          ([name]) => name.toLowerCase() === (value as string).toLowerCase(),
        );
        if (match) next.distance_to_haram_m = match[1];
      }
      return next;
    });
  };

  const primaryMedia = media.find((m) => m.is_primary) ?? media[0] ?? null;

  const dateError =
    draft.date_start && draft.date_end && draft.date_end < draft.date_start
      ? "End date cannot be before the start date"
      : null;

  const submit = async (status: "draft" | "active") => {
    if (!agent?.id || !packageId) {
      toast.error("Draft not ready yet, please wait");
      return;
    }
    if (!draft.title || !draft.type || !draft.departure_city || !draft.departure_country) {
      toast.error("Please fill title, type, and departure location");
      return;
    }
    if (dateError) {
      toast.error(dateError);
      return;
    }
    if (status === "active") {
      const approvedImages = media.filter(
        (m) => m.media_type === "photo" && m.moderation_status === "approved",
      );
      if (approvedImages.length < 3) {
        toast.error(
          `At least 3 approved images are required to publish (you have ${approvedImages.length})`,
        );
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      title: draft.title,
      type: draft.type as "hajj" | "umrah",
      departure_city: draft.departure_city,
      departure_country: draft.departure_country,
      date_start: draft.date_start || null,
      date_end: draft.date_end || null,
      base_price: draft.base_price ? Number(draft.base_price) : null,
      currency: draft.currency,
      hotel_name: draft.hotel_name || null,
      hotel_stars: draft.hotel_stars,
      hotel_zone: (draft.hotel_zone || null) as "A" | "B" | "C" | null,
      distance_to_haram_m: draft.distance_to_haram_m,
      meals_included: (draft.meals_included || null) as "full" | "half" | "self" | null,
      transport_type: (draft.transport_type || null) as "private" | "shared" | "self" | null,
      visa_included: draft.visa_included,
      thumbnail_url: primaryMedia?.thumbnail_url ?? primaryMedia?.url ?? null,
      status,
    };
    const { error } = await supabase.from("packages").update(payload).eq("id", packageId);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(status === "active" ? "Package published" : "Draft saved");
      navigate({ to: "/agent/packages" });
    }
  };

  return (
    <DashboardLayout variant="agent" title={existingId ? "Edit Package" : "New Package"}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {existingId ? "Edit Package" : "New Package"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in the details below - your live preview updates as you type.
          </p>
        </div>

        {loadingExisting ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Mobile preview on top */}
          <div className="order-first lg:hidden">
            <PackagePreviewCard
              draft={draft}
              primaryImageUrl={primaryMedia?.thumbnail_url ?? primaryMedia?.url}
            />
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Section title="Basics">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Premium Umrah December 2026"
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <ToggleGroup
                  type="single"
                  value={draft.type}
                  onValueChange={(v) => v && update("type", v as PackageDraft["type"])}
                  className="justify-start"
                >
                  <ToggleGroupItem value="hajj">Hajj</ToggleGroupItem>
                  <ToggleGroupItem value="umrah">Umrah</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Departure city</Label>
                  <Suspense fallback={<Input placeholder="London" disabled />}>
                    <CitySelect
                      value={draft.departure_city}
                      onSelect={(c: City) => {
                        update("departure_city", c.name);
                        update("departure_country", c.country_name);
                      }}
                      placeholder="Select a city"
                    />
                  </Suspense>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="Selected with city"
                    value={draft.departure_country}
                    readOnly
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ds">Start date</Label>
                  <Input
                    id="ds"
                    type="date"
                    value={draft.date_start}
                    onChange={(e) => update("date_start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="de">End date</Label>
                  <Input
                    id="de"
                    type="date"
                    min={draft.date_start || undefined}
                    value={draft.date_end}
                    onChange={(e) => update("date_end", e.target.value)}
                    aria-invalid={!!dateError}
                  />
                </div>
              </div>
              {dateError && (
                <p className="text-sm font-medium text-destructive">{dateError}</p>
              )}
            </Section>

            <Section title="Accommodation">
              <div className="space-y-2">
                <Label htmlFor="hotel">Hotel name</Label>
                <Input
                  id="hotel"
                  list="hotel-suggestions"
                  placeholder="Fairmont Makkah Clock Royal Tower"
                  value={draft.hotel_name}
                  onChange={(e) => update("hotel_name", e.target.value)}
                />
                <datalist id="hotel-suggestions">
                  {Object.keys(knownHotels).map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Star rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update("hotel_stars", n)}
                      className="rounded p-1 transition hover:bg-secondary"
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          (draft.hotel_stars ?? 0) >= n
                            ? "fill-accent text-accent"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <RadioGroup
                  value={draft.hotel_zone}
                  onValueChange={(v) => update("hotel_zone", v as PackageDraft["hotel_zone"])}
                  className="flex gap-3"
                >
                  {([
                    { v: "A", label: "Zone A - Closest", color: "bg-emerald-500" },
                    { v: "B", label: "Zone B - Mid", color: "bg-amber-500" },
                    { v: "C", label: "Zone C - Far", color: "bg-rose-500" },
                  ] as const).map((z) => (
                    <Label
                      key={z.v}
                      htmlFor={`zone-${z.v}`}
                      className={cn(
                        "flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border p-3 transition",
                        draft.hotel_zone === z.v && "border-primary bg-primary/5",
                      )}
                    >
                      <RadioGroupItem id={`zone-${z.v}`} value={z.v} />
                      <span className={cn("h-3 w-3 rounded-full", z.color)} />
                      <span className="text-sm">{z.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist">Distance to Haram (meters)</Label>
                <Input
                  id="dist"
                  type="number"
                  placeholder="Auto-filled for known hotels"
                  value={draft.distance_to_haram_m ?? ""}
                  onChange={(e) =>
                    update("distance_to_haram_m", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </Section>

            <Section title="Photos & Videos">
              {packageId && user?.id ? (
                <Suspense fallback={<SubLoading />}>
                  <PackageMediaManager
                    packageId={packageId}
                    userId={user.id}
                    onChange={setMedia}
                  />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing media uploader…
                </div>
              )}
            </Section>

            <Section title="Inclusions">
              <div className="space-y-2">
                <Label>Meals</Label>
                <ToggleGroup
                  type="single"
                  value={draft.meals_included}
                  onValueChange={(v) =>
                    v && update("meals_included", v as PackageDraft["meals_included"])
                  }
                  className="justify-start"
                >
                  <ToggleGroupItem value="full">Full board</ToggleGroupItem>
                  <ToggleGroupItem value="half">Half board</ToggleGroupItem>
                  <ToggleGroupItem value="self">Self-catered</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label>Transport</Label>
                <ToggleGroup
                  type="single"
                  value={draft.transport_type}
                  onValueChange={(v) =>
                    v && update("transport_type", v as PackageDraft["transport_type"])
                  }
                  className="justify-start"
                >
                  <ToggleGroupItem value="private">Private</ToggleGroupItem>
                  <ToggleGroupItem value="shared">Shared</ToggleGroupItem>
                  <ToggleGroupItem value="self">Self-arranged</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="visa" className="font-normal">
                  Visa included
                </Label>
                <Switch
                  id="visa"
                  checked={draft.visa_included}
                  onCheckedChange={(c) => update("visa_included", c)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="flights" className="font-normal">
                  Flights included
                </Label>
                <Switch
                  id="flights"
                  checked={draft.flights_included}
                  onCheckedChange={(c) => update("flights_included", c)}
                />
              </div>
            </Section>

            <Section title="Pricing" defaultOpen>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div className="space-y-2">
                  <Label htmlFor="price">Base price per adult</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="2500"
                    value={draft.base_price}
                    onChange={(e) => update("base_price", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cur">Currency</Label>
                  <Select value={draft.currency} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger id="cur">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="SAR">SAR</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section title="Pricing tiers (optional)" defaultOpen={false}>
              {packageId ? (
                <Suspense fallback={<SubLoading />}>
                  <PackageTiersManager packageId={packageId} defaultCurrency={draft.currency} />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing tiers…
                </div>
              )}
            </Section>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => submit("active")} disabled={submitting || !packageId}>
                {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Publish
              </Button>
              <Button
                variant="outline"
                onClick={() => submit("draft")}
                disabled={submitting || !packageId}
              >
                Save as draft
              </Button>
              <Button variant="ghost" onClick={() => navigate({ to: "/agent/packages" })}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Desktop sticky preview */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live preview
              </p>
              <PackagePreviewCard
                draft={draft}
                primaryImageUrl={primaryMedia?.thumbnail_url ?? primaryMedia?.url}
              />
            </div>
          </aside>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}
