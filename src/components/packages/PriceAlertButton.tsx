import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function PriceAlertButton({
  packageId,
  currentPrice,
  currency,
  className,
  hasAlert,
  onCreated,
}: {
  packageId: string;
  currentPrice: number | null;
  currency: string;
  className?: string;
  hasAlert?: boolean;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const suggested = currentPrice ? Math.round(currentPrice * 0.9) : 0;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(suggested ? String(suggested) : "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to set a price alert");
      return;
    }
    const value = Number(target);
    if (!value || value <= 0) {
      toast.error("Please enter a valid target price");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("price_alerts").insert({
      pilgrim_id: user.id,
      package_id: packageId,
      target_price: value,
      currency,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to set alert");
      return;
    }
    toast.success(`We'll notify you when the price drops to ${currency} ${value}`);
    setOpen(false);
    onCreated?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={hasAlert ? "Manage price alert" : "Set price alert"}
          className={cn(
            "grid h-9 w-9 place-content-center rounded-full bg-background/95 shadow-sm backdrop-blur transition-colors hover:bg-background",
            className,
          )}
        >
          {hasAlert ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4 text-foreground/70" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end" onClick={(e) => e.stopPropagation()}>
        {!user ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Log in to set a price alert</p>
            <p className="text-muted-foreground text-xs">
              We'll email you when this package drops to your target price.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Set a price alert</p>
              <p className="text-muted-foreground text-xs">
                Current price: {currency} {currentPrice ?? "-"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-price" className="text-xs">
                Notify me when price drops to
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">{currency}</span>
                <Input
                  id="target-price"
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} size="sm" className="w-full">
              {saving ? "Saving…" : "Set Alert"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
