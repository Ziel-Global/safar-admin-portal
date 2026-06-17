import { useEffect, useState } from "react";
import { Plus, Trash2, Star, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TIER_ORDER,
  TIER_LABELS,
  TIER_ACCENTS,
  TIER_DESCRIPTIONS,
  sortTiers,
  type PackageTierRecord,
  type TierName,
} from "@/lib/tiers";
import { cn } from "@/lib/utils";

interface Props {
  packageId: string;
  defaultCurrency?: string;
}

export function PackageTiersManager({ packageId, defaultCurrency = "GBP" }: Props) {
  const [tiers, setTiers] = useState<PackageTierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("package_tiers")
      .select("*")
      .eq("package_id", packageId);
    if (error) toast.error(error.message);
    else setTiers(sortTiers((data ?? []) as PackageTierRecord[]));
    setLoading(false);
  };

  useEffect(() => {
    if (packageId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  const usedNames = new Set(tiers.map((t) => t.tier_name));
  const available = TIER_ORDER.filter((t) => !usedNames.has(t));

  const addTier = async (name: TierName) => {
    if (tiers.length >= 4) {
      toast.error("Max 4 tiers per package");
      return;
    }
    // Default price: keep ascending order
    const sorted = sortTiers(tiers);
    const idx = TIER_ORDER.indexOf(name);
    const lowerMax = sorted.filter((t) => TIER_ORDER.indexOf(t.tier_name) < idx).at(-1)?.price_adult ?? 1000;
    const upperMin = sorted.find((t) => TIER_ORDER.indexOf(t.tier_name) > idx)?.price_adult ?? lowerMax + 500;
    const defaultPrice = Math.round((lowerMax + upperMin) / 2);

    const { data, error } = await supabase
      .from("package_tiers")
      .insert({
        package_id: packageId,
        tier_name: name,
        price_adult: defaultPrice,
        currency: defaultCurrency,
        sort_order: idx,
        is_highlighted: name === "standard" && !tiers.some((t) => t.is_highlighted),
      })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      setTiers((prev) => sortTiers([...prev, data as PackageTierRecord]));
      toast.success(`${TIER_LABELS[name]} tier added`);
    }
  };

  const updateTier = async (tier: PackageTierRecord, patch: Partial<PackageTierRecord>) => {
    // Enforce ascending price hierarchy when price_adult changes
    if (patch.price_adult != null) {
      const newPrice = Number(patch.price_adult);
      if (!Number.isFinite(newPrice) || newPrice <= 0) {
        toast.error("Price must be a positive number");
        return;
      }
      const idx = TIER_ORDER.indexOf(tier.tier_name);
      const lowerMax = tiers
        .filter((t) => t.id !== tier.id && TIER_ORDER.indexOf(t.tier_name) < idx)
        .reduce<number | null>(
          (acc, t) => (acc == null || t.price_adult > acc ? t.price_adult : acc),
          null,
        );
      const upperMin = tiers
        .filter((t) => t.id !== tier.id && TIER_ORDER.indexOf(t.tier_name) > idx)
        .reduce<number | null>(
          (acc, t) => (acc == null || t.price_adult < acc ? t.price_adult : acc),
          null,
        );
      if (lowerMax != null && newPrice <= lowerMax) {
        toast.error(
          `${TIER_LABELS[tier.tier_name]} price must be greater than lower tier (${lowerMax})`,
        );
        load();
        return;
      }
      if (upperMin != null && newPrice >= upperMin) {
        toast.error(
          `${TIER_LABELS[tier.tier_name]} price must be less than higher tier (${upperMin})`,
        );
        load();
        return;
      }
    }
    if (patch.price_child != null) {
      const c = Number(patch.price_child);
      if (!Number.isFinite(c) || c < 0) {
        toast.error("Child price must be zero or positive");
        return;
      }
    }
    setSaving(tier.id);
    const optimistic = { ...tier, ...patch };
    setTiers((prev) => sortTiers(prev.map((t) => (t.id === tier.id ? optimistic : t))));
    const { error } = await supabase
      .from("package_tiers")
      .update(patch)
      .eq("id", tier.id);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const removeTier = async (tier: PackageTierRecord) => {
    if (!confirm(`Remove ${TIER_LABELS[tier.tier_name]} tier?`)) return;
    const { error } = await supabase.from("package_tiers").delete().eq("id", tier.id);
    if (error) toast.error(error.message);
    else {
      setTiers((prev) => prev.filter((t) => t.id !== tier.id));
      toast.success("Tier removed");
    }
  };

  const copyFrom = (target: PackageTierRecord, sourceId: string) => {
    const src = tiers.find((t) => t.id === sourceId);
    if (!src) return;
    updateTier(target, {
      hotel_override: src.hotel_override,
      zone_override: src.zone_override,
      room_type: src.room_type,
      transport_override: src.transport_override,
      meal_override: src.meal_override,
      description_override: src.description_override,
      // do NOT copy price - must keep ordering valid
    });
    toast.success(`Copied details from ${TIER_LABELS[src.tier_name]}`);
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Offer up to 4 tiers per package. Prices must increase from Economy → VIP.
            Highlight one tier as <em>Most Popular</em>.
          </p>
        </div>
        {available.length > 0 && (
          <Select onValueChange={(v) => addTier(v as TierName)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Add tier" />
            </SelectTrigger>
            <SelectContent>
              {available.map((n) => (
                <SelectItem key={n} value={n}>
                  <Plus className="mr-1 inline h-3.5 w-3.5" /> {TIER_LABELS[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tiers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">No tiers yet - add Economy to start.</p>
            <Button size="sm" onClick={() => addTier("economy")}>
              <Plus className="mr-1 h-4 w-4" /> Add Economy tier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tiers.map((tier) => (
            <Card key={tier.id} className={cn("overflow-hidden", TIER_ACCENTS[tier.tier_name])}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold">{TIER_LABELS[tier.tier_name]}</h4>
                      {tier.is_highlighted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          <Star className="h-3 w-3 fill-current" /> Most Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {TIER_DESCRIPTIONS[tier.tier_name]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {saving === tier.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTier(tier)}
                      aria-label="Remove tier"
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Price per adult</Label>
                    <Input
                      type="number"
                      defaultValue={tier.price_adult}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== tier.price_adult) updateTier(tier, { price_adult: v });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price per child</Label>
                    <Input
                      type="number"
                      defaultValue={tier.price_child ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (v !== tier.price_child) updateTier(tier, { price_child: v });
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Hotel override</Label>
                    <Input
                      defaultValue={tier.hotel_override ?? ""}
                      placeholder="Inherit base hotel"
                      onBlur={(e) =>
                        e.target.value !== (tier.hotel_override ?? "") &&
                        updateTier(tier, { hotel_override: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Room type</Label>
                    <Input
                      defaultValue={tier.room_type ?? ""}
                      placeholder="Quad / Triple / Double"
                      onBlur={(e) =>
                        e.target.value !== (tier.room_type ?? "") &&
                        updateTier(tier, { room_type: e.target.value || null })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Transport override</Label>
                    <Select
                      value={tier.transport_override ?? ""}
                      onValueChange={(v) =>
                        updateTier(tier, { transport_override: v || null })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Inherit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                        <SelectItem value="self">Self-arranged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meals override</Label>
                    <Select
                      value={tier.meal_override ?? ""}
                      onValueChange={(v) => updateTier(tier, { meal_override: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Inherit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full board</SelectItem>
                        <SelectItem value="half">Half board</SelectItem>
                        <SelectItem value="self">Self-catered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description override</Label>
                  <Textarea
                    defaultValue={tier.description_override ?? ""}
                    placeholder="What makes this tier special…"
                    rows={2}
                    onBlur={(e) =>
                      e.target.value !== (tier.description_override ?? "") &&
                      updateTier(tier, { description_override: e.target.value || null })
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`hl-${tier.id}`}
                      checked={tier.is_highlighted}
                      onCheckedChange={(c) => updateTier(tier, { is_highlighted: c })}
                    />
                    <Label htmlFor={`hl-${tier.id}`} className="text-xs font-normal">
                      Most Popular
                    </Label>
                  </div>
                  {tiers.filter((t) => t.id !== tier.id).length > 0 && (
                    <Select onValueChange={(v) => copyFrom(tier, v)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <Copy className="mr-1 h-3 w-3" />
                        <SelectValue placeholder="Copy from…" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiers
                          .filter((t) => t.id !== tier.id)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {TIER_LABELS[t.tier_name]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
