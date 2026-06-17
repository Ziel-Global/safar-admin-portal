import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Ambulance,
  Building2,
  Download,
  Flame,
  Globe2,
  Hospital,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  PhoneCall,
  Share2,
  Shield,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { registerEmergencySW } from "@/lib/sw-register";

export const Route = createFileRoute("/tools/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Contacts - Safar" },
      {
        name: "description",
        content:
          "Saudi emergency numbers, hospitals in Makkah and Madinah, and embassy contacts - available offline.",
      },
      { property: "og:title", content: "Emergency Contacts - Safar" },
      {
        property: "og:description",
        content: "Tap-to-call Saudi emergency, hospital and embassy contacts, with offline access.",
      },
    ],
  }),
  component: EmergencyTool,
});

type Contact = {
  id: string;
  country_code: string;
  contact_type: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  sort_order: number;
};

type CountryOption = { code: string; name: string; flag: string };

const COUNTRIES: CountryOption[] = [
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "US", name: "United States", flag: "🇺🇸" },
];

const SERVICE_ICONS: Record<string, typeof Ambulance> = {
  "997": Ambulance,
  "911": Shield,
  "999": Shield,
  "998": Flame,
  "930": Globe2,
  "993": ShieldAlert,
};

function mapsUrl(lat: number | null, lng: number | null, fallback?: string) {
  if (lat != null && lng != null) return `https://maps.google.com/?q=${lat},${lng}`;
  if (fallback) return `https://maps.google.com/?q=${encodeURIComponent(fallback)}`;
  return null;
}

function CallButton({
  phone,
  label,
  full,
  compact,
}: {
  phone: string;
  label: string;
  full?: boolean;
  compact?: boolean;
}) {
  const tel = `tel:${phone.replace(/\s+/g, "")}`;
  return (
    <a
      href={tel}
      aria-label={`Call ${label} on ${phone}`}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#9F2A2A] font-bold text-white shadow-sm transition-colors hover:bg-[#7F2020] active:scale-[0.98] ${
        compact ? "min-h-[44px] px-3 text-[14px]" : "min-h-[48px] px-5 text-[18px]"
      } ${full ? "w-full" : ""}`}
    >
      <PhoneCall className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} />
      <span>{compact ? phone : `Call ${phone}`}</span>
    </a>
  );
}

function DirectionsButton({ url, compact }: { url: string; compact?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 border-border bg-card font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary active:scale-[0.98] ${
        compact ? "min-h-[44px] px-3 text-[14px]" : "min-h-[48px] px-5 text-[18px]"
      }`}
    >
      <Navigation className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} />
      <span>{compact ? "Directions" : "Get Directions"}</span>
    </a>
  );
}

function EmergencyTool() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [embassyCountry, setEmbassyCountry] = useState<string>(profile?.country_code ?? "GB");
  const [city, setCity] = useState<"makkah" | "madinah">("makkah");
  const [online, setOnline] = useState(true);
  const [cached, setCached] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [agentContact, setAgentContact] = useState<{
    business_name: string;
    phone: string | null;
  } | null>(null);

  useEffect(() => {
    void registerEmergencySW();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (profile?.country_code && COUNTRIES.some((c) => c.code === profile.country_code)) {
      setEmbassyCountry(profile.country_code);
    }
  }, [profile?.country_code]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("emergency_contacts")
        .select("id, country_code, contact_type, name, phone, address, email, latitude, longitude, notes, sort_order")
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        const list = (data as Contact[]) ?? [];
        setContacts(list);
        // Cache into Cache API
        try {
          if ("caches" in window) {
            const cache = await caches.open("safar-emergency-data-v1");
            const blob = new Blob([JSON.stringify(list)], { type: "application/json" });
            await cache.put("/__emergency-data.json", new Response(blob));
            setCached(true);
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fallback: read from cache when offline and Supabase failed
  useEffect(() => {
    if (contacts.length > 0) return;
    if (typeof window === "undefined" || !("caches" in window)) return;
    (async () => {
      try {
        const cache = await caches.open("safar-emergency-data-v1");
        const res = await cache.match("/__emergency-data.json");
        if (res) {
          const list = (await res.json()) as Contact[];
          setContacts(list);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [contacts.length]);

  // Look up active booking → agent contact
  useEffect(() => {
    if (!user) {
      setAgentContact(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("agents:agent_id (business_name, user_id)")
        .eq("pilgrim_id", user.id)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      // We don't have a phone column on agents - show name only
      const agent = (data as { agents: { business_name: string } | null }).agents;
      if (agent) setAgentContact({ business_name: agent.business_name, phone: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saudi = useMemo(
    () =>
      contacts
        .filter((c) => c.country_code === "SA" && c.contact_type === "emergency")
        .sort((a, b) => a.sort_order - b.sort_order),
    [contacts],
  );
  const makkahHospitals = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.contact_type === "hospital" && (c.address?.toLowerCase().includes("makkah") ?? false),
      ),
    [contacts],
  );
  const madinahHospitals = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.contact_type === "hospital" && (c.address?.toLowerCase().includes("madinah") ?? false),
      ),
    [contacts],
  );
  const embassy = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.country_code === embassyCountry &&
          (c.contact_type === "embassy" || c.contact_type === "consulate"),
      ),
    [contacts, embassyCountry],
  );

  const handleDownloadOffline = async () => {
    try {
      if ("caches" in window) {
        const cache = await caches.open("safar-emergency-data-v1");
        const blob = new Blob([JSON.stringify(contacts)], { type: "application/json" });
        await cache.put("/__emergency-data.json", new Response(blob));
        setCached(true);
        toast.success("Saved for offline use");
      } else {
        toast.error("Offline storage not supported on this browser");
      }
    } catch {
      toast.error("Could not save for offline");
    }
  };

  const handleShareLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      toast.error("Location not supported on this device");
      return;
    }
    toast.loading("Getting your location…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss("geo");
        const link = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        const text = `I'm at this location: ${link}`;
        try {
          if (navigator.share) {
            await navigator.share({ title: "My location", text, url: link });
          } else {
            await navigator.clipboard.writeText(text);
            toast.success("Location link copied to clipboard");
          }
        } catch {
          /* user cancelled */
        }
      },
      () => {
        toast.dismiss("geo");
        toast.error("Could not get your location. Please enable location access.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const selectedCountry = COUNTRIES.find((c) => c.code === embassyCountry);
  const hospitals = city === "makkah" ? makkahHospitals : madinahHospitals;

  return (
    <PublicLayout>
      <div className="bg-secondary pb-24 print:bg-white print:pb-0">
        {/* COMPACT HEADER */}
        <header className="bg-[#7F2020] text-white print:bg-white print:text-black">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                  <ShieldAlert className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Emergency Contacts
                  </h1>
                  <p className="text-[14px] text-white/80">
                    {dateStr} · {timeStr}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold print:hidden">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    online ? "bg-white/15" : "bg-amber-500/30"
                  }`}
                >
                  {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  {online ? "Online" : "Offline"}
                </span>
                {cached && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/25 px-2.5 py-1">
                    ✓ Saved offline
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* QUICK DIAL - most life-critical, above the fold */}
        <section
          aria-labelledby="sec-quick"
          className="border-b border-border bg-card print:border-0"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="sec-quick" className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground">
                Quick dial - Saudi Arabia
              </h2>
              <span className="text-[13px] text-muted-foreground">Tap to call</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {saudi.map((c) => {
                const Icon = SERVICE_ICONS[c.phone ?? ""] ?? ShieldAlert;
                if (!c.phone) return null;
                return (
                  <a
                    key={c.id}
                    href={`tel:${c.phone.replace(/\s+/g, "")}`}
                    aria-label={`Call ${c.name} on ${c.phone}`}
                    className="group flex min-h-[88px] flex-col items-start justify-between rounded-lg border-2 border-border bg-secondary/40 p-3 transition-all hover:border-[#7F2020] hover:bg-[#F4E4E4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F2020]"
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className="h-5 w-5 text-[#7F2020]" aria-hidden />
                      <PhoneCall className="h-4 w-4 text-muted-foreground group-hover:text-[#7F2020]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-muted-foreground">{c.name}</p>
                      <p className="text-[24px] font-extrabold leading-none tracking-tight text-[#7F2020]">
                        {c.phone}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* MAIN: hospitals full-width, then embassy/agent/support row */}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 print:py-4">
          <div className="space-y-8">
            {/* HOSPITALS - full width */}
            <div>
              <section aria-labelledby="sec-hosp">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id="sec-hosp" className="flex items-center gap-2 text-[20px] font-bold text-foreground">
                    <Hospital className="h-5 w-5 text-primary" /> Nearest Hospitals
                  </h2>
                  <Tabs
                    value={city}
                    onValueChange={(v) => setCity(v as "makkah" | "madinah")}
                    className="print:hidden"
                  >
                    <TabsList className="h-10 bg-secondary p-1">
                      <TabsTrigger
                        value="makkah"
                        className="h-8 px-4 text-[14px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground"
                      >
                        Makkah
                      </TabsTrigger>
                      <TabsTrigger
                        value="madinah"
                        className="h-8 px-4 text-[14px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground"
                      >
                        Madinah
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {hospitals.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-card p-4 text-[15px] text-muted-foreground">
                      No hospitals listed for this city.
                    </p>
                  ) : (
                    hospitals.map((h) => {
                      const dirUrl = mapsUrl(h.latitude, h.longitude, h.address ?? undefined);
                      return (
                        <Card key={h.id} className="border border-border bg-card shadow-sm">
                          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-[17px] font-bold text-foreground">{h.name}</p>
                              {h.address && (
                                <p className="mt-0.5 flex items-start gap-1.5 text-[14px] text-muted-foreground">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span>{h.address}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                              {h.phone && <CallButton phone={h.phone} label={h.name} />}
                              {dirUrl && <DirectionsButton url={dirUrl} />}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* EMBASSY / AGENT / SUPPORT - 3-column row below hospitals */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* EMBASSY */}
              <section aria-labelledby="sec-emb">
                <h2 id="sec-emb" className="mb-3 flex items-center gap-2 text-[20px] font-bold text-foreground">
                  <Building2 className="h-5 w-5 text-primary" /> Your Embassy
                </h2>
                <div className="mb-3 print:hidden">
                  <Select value={embassyCountry} onValueChange={setEmbassyCountry}>
                    <SelectTrigger className="h-11 w-full text-[15px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} className="text-[15px]">
                          <span className="mr-2">{c.flag}</span> {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {embassy.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-card p-4 text-[14px] text-muted-foreground">
                      No embassy listed for this country yet.
                    </p>
                  ) : (
                    embassy.map((e) => {
                      const dirUrl = mapsUrl(e.latitude, e.longitude, e.address ?? undefined);
                      return (
                        <Card key={e.id} className="border border-border bg-card shadow-sm">
                          <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-start gap-2.5">
                              <span className="text-2xl leading-none" aria-hidden>
                                {selectedCountry?.flag}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-bold text-foreground">{e.name}</p>
                                {e.address && (
                                  <p className="mt-0.5 text-[13px] text-muted-foreground">{e.address}</p>
                                )}
                                {e.email && (
                                  <a
                                    href={`mailto:${e.email}`}
                                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary underline-offset-2 hover:underline"
                                  >
                                    <Mail className="h-3.5 w-3.5" /> {e.email}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {e.phone && <CallButton phone={e.phone} label={e.name} compact />}
                              {dirUrl && <DirectionsButton url={dirUrl} compact />}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </section>

              {/* YOUR AGENT */}
              <section aria-labelledby="sec-agent">
                <h2 id="sec-agent" className="mb-3 flex items-center gap-2 text-[20px] font-bold text-foreground">
                  <Sparkles className="h-5 w-5 text-accent" /> Your Agent
                </h2>
                {agentContact ? (
                  <Card className="border border-accent/30 bg-accent/5 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-[16px] font-bold text-foreground">{agentContact.business_name}</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Contact your agent first for trip-related issues.
                      </p>
                      <a
                        href="/dashboard"
                        className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-4 text-[14px] font-bold text-accent-foreground shadow-sm hover:bg-accent-hover"
                      >
                        Open booking
                      </a>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-dashed border-border bg-card shadow-none">
                    <CardContent className="p-4">
                      <p className="text-[14px] text-muted-foreground">
                        Book through Safar to see your agent's emergency contact here.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* PLATFORM SUPPORT */}
              <section aria-labelledby="sec-support">
                <h2 id="sec-support" className="mb-3 flex items-center gap-2 text-[20px] font-bold text-foreground">
                  <Globe2 className="h-5 w-5 text-primary" /> Safar Support
                </h2>
                <Card className="border border-border bg-card shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4">
                    <p className="text-[13px] text-muted-foreground">Available 24/7 for booking & agent issues.</p>
                    <a
                      href="mailto:support@safar.com"
                      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary underline-offset-2 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" /> support@safar.com
                    </a>
                    <div className="flex flex-wrap gap-2">
                      <CallButton phone="+44 20 1234 5678" label="Safar Support" compact />
                      <button
                        type="button"
                        onClick={() => toast("Live chat is coming soon")}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 border-border bg-card px-3 text-[14px] font-semibold text-foreground shadow-sm hover:bg-secondary"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" /> Live Chat
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>

          {/* OFFLINE / PRINT UTILITIES */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-6 print:hidden">
            <Button
              type="button"
              onClick={handleDownloadOffline}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Save for offline
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
              Print this page
            </Button>
          </div>
        </main>

        {/* STICKY LOST-IN-CROWD HELP BAR (mobile) / inline panel (desktop) */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-primary text-primary-foreground shadow-lg print:hidden lg:static lg:mx-auto lg:mt-6 lg:max-w-6xl lg:rounded-lg lg:border lg:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-0 lg:py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold sm:text-[16px]">Lost or separated?</p>
              <p className="hidden text-[13px] text-primary-foreground/80 sm:block">
                Share your live location with your group leader.
              </p>
            </div>
            <button
              type="button"
              onClick={handleShareLocation}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 text-[14px] font-bold text-accent-foreground shadow-sm hover:bg-accent-hover active:scale-[0.98] sm:px-6 sm:text-[15px]"
            >
              <Share2 className="h-4 w-4" /> Share location
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
