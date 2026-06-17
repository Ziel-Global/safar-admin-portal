import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ActiveCampaignInfo,
  discountLabel,
  useCampaignCountdown,
} from "@/lib/campaigns";

export function CampaignRibbon({
  campaign,
  className,
}: {
  campaign: ActiveCampaignInfo;
  className?: string;
}) {
  const countdown = useCampaignCountdown(campaign.end_date);
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 top-3 z-10 flex items-center gap-1.5 rounded-r-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md",
        countdown?.urgent
          ? "bg-gradient-to-r from-rose-600 to-orange-500"
          : "bg-gradient-to-r from-primary to-primary/80",
        className,
      )}
    >
      <Tag className="h-3 w-3" />
      <span>{discountLabel(campaign)}</span>
      {countdown ? <span className="font-medium opacity-90">- {countdown.text}</span> : null}
    </div>
  );
}
