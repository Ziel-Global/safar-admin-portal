import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyMergeFields,
  buildMergeValues,
  listQuoteTemplates,
  type QuoteTemplate,
} from "@/lib/quoteTemplates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface SendQuoteDialogProps {
  rfqId: string;
  agentId: string;
  matchId?: string | null;
  defaultCurrency?: string;
  title: string;
  description: string;
  onClose: () => void;
  onSent: () => void;
  rfqContext?: {
    pilgrim_name?: string | null;
    package_name?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
}

export function SendQuoteDialog({
  rfqId,
  agentId,
  matchId,
  defaultCurrency = "GBP",
  title,
  description,
  onClose,
  onSent,
  rfqContext,
}: SendQuoteDialogProps) {
  const { agent } = useAuth();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [hotelName, setHotelName] = useState("");
  const [zone, setZone] = useState<"" | "A" | "B" | "C">("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [breakdown, setBreakdown] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    if (!agent) return;
    listQuoteTemplates(agent.id).then(setTemplates).catch(() => null);
  }, [agent]);

  function loadTemplate(t: QuoteTemplate) {
    const values = buildMergeValues({
      pilgrim_name: rfqContext?.pilgrim_name ?? null,
      package_name: rfqContext?.package_name ?? null,
      price_total: Number(price) || null,
      price_currency: currency,
      hotel_name: hotelName || null,
      date_from: rfqContext?.date_from ?? null,
      date_to: rfqContext?.date_to ?? null,
      agent_name: agent?.business_name ?? null,
      agent_phone: null,
    });
    setNotes(applyMergeFields(t.html_template, values));
    setTemplatesOpen(false);
  }

  async function submit() {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid total price");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("quotes").insert({
        rfq_id: rfqId,
        agent_id: agentId,
        price_total: priceNum,
        price_currency: currency,
        hotel_name: hotelName || null,
        hotel_zone: zone || null,
        valid_until: validUntil || null,
        notes: notes || null,
        price_breakdown: breakdown ? { summary: breakdown } : {},
      });
      if (error) throw error;

      if (matchId) {
        await supabase
          .from("rfq_agent_matches")
          .update({ responded: true, responded_at: new Date().toISOString() })
          .eq("id", matchId);
      }

      await supabase.from("rfqs").update({ status: "quotes_received" }).eq("id", rfqId);

      toast.success("Quote sent");
      onSent();
    } catch (err) {
      console.error(err);
      toast.error("Could not send quote", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-sm">Total price</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2,499"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Hotel name</Label>
              <Input
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="e.g. Hilton Makkah"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Hotel zone</Label>
              <Select value={zone} onValueChange={(v) => setZone(v as "A" | "B" | "C")}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Closest</SelectItem>
                  <SelectItem value="B">B - Mid</SelectItem>
                  <SelectItem value="C">C - Farther</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Valid until</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm">Price breakdown (optional)</Label>
            <Textarea
              value={breakdown}
              onChange={(e) => setBreakdown(e.target.value)}
              rows={2}
              placeholder="e.g. Flights £700, Hotel £1,200, Visa £100..."
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Notes for the pilgrim (optional)</Label>
              <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    Load template
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="end">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No templates yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-auto">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => loadTemplate(t)}
                          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent"
                        >
                          {t.name}
                          {t.is_starter && (
                            <span className="ml-2 text-xs text-muted-foreground">starter</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What makes this offer great..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending..." : "Send quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
