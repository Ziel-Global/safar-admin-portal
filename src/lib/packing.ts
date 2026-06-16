export type Season = "winter" | "spring" | "summer" | "autumn";
export type Gender = "male" | "female";
export type HealthNeed =
  | "none"
  | "diabetes"
  | "asthma"
  | "mobility"
  | "wheelchair"
  | "prescription"
  | "allergies";

export type PackingPrefs = {
  season: Season;
  duration: number; // days, 5-30
  gender: Gender;
  health: HealthNeed[];
  withChildren: boolean;
  childCount: number;
};

export type PackingItem = {
  id: string;
  name: string;
  qty: number;
  community?: boolean;
  custom?: boolean;
};

export type PackingCategory = { name: string; items: PackingItem[] };

export const STORAGE_KEY = "safar.packing.v2";

export const DEFAULT_PREFS: PackingPrefs = {
  season: "spring",
  duration: 10,
  gender: "male",
  health: [],
  withChildren: false,
  childCount: 0,
};

export const HEALTH_OPTIONS: { id: HealthNeed; label: string }[] = [
  { id: "none", label: "None" },
  { id: "diabetes", label: "Diabetes" },
  { id: "asthma", label: "Asthma" },
  { id: "mobility", label: "Mobility aid" },
  { id: "wheelchair", label: "Wheelchair" },
  { id: "prescription", label: "Prescription medication" },
  { id: "allergies", label: "Allergies" },
];

export const SEASON_OPTIONS: {
  id: Season;
  label: string;
  months: string;
  emoji: string;
}[] = [
  { id: "winter", label: "Winter", months: "Dec – Feb", emoji: "❄️" },
  { id: "spring", label: "Spring", months: "Mar – May", emoji: "🌸" },
  { id: "summer", label: "Summer", months: "Jun – Aug", emoji: "☀️" },
  { id: "autumn", label: "Autumn", months: "Sep – Nov", emoji: "🍂" },
];

type Rule = {
  id: string;
  name: string;
  category: string;
  base: number; // base quantity
  perDays?: number; // 1 unit per N days, added to base (capped)
  cap?: number;
  community?: boolean;
  // Conditions - item only included if all listed conditions match
  seasons?: Season[];
  gender?: Gender;
  health?: HealthNeed[]; // any-of
  childrenOnly?: boolean;
};

const CATEGORIES = [
  "Ihram & Prayer",
  "Clothing",
  "Toiletries",
  "Health & Medication",
  "Electronics",
  "Comfort & Essentials",
] as const;

const RULES: Rule[] = [
  // Ihram & Prayer
  { id: "ihram-male", name: "Ihram cloth (2 sets)", category: "Ihram & Prayer", base: 2, gender: "male" },
  { id: "ihram-belt", name: "Ihram belt with pouch", category: "Ihram & Prayer", base: 1, gender: "male", community: true },
  { id: "abaya", name: "Abaya / modest dress", category: "Ihram & Prayer", base: 2, perDays: 7, cap: 5, gender: "female" },
  { id: "hijabs", name: "Hijabs / scarves", category: "Ihram & Prayer", base: 3, perDays: 5, cap: 8, gender: "female", community: true },
  { id: "prayer-mat", name: "Lightweight prayer mat", category: "Ihram & Prayer", base: 1, community: true },
  { id: "quran", name: "Pocket Quran or app bookmark", category: "Ihram & Prayer", base: 1 },
  { id: "dua-book", name: "Dua book (Hisn al-Muslim)", category: "Ihram & Prayer", base: 1, community: true },
  { id: "tasbih", name: "Tasbih (digital or beads)", category: "Ihram & Prayer", base: 1 },
  { id: "prayer-cap", name: "Prayer cap", category: "Ihram & Prayer", base: 2, gender: "male" },

  // Clothing
  { id: "loose-tops", name: "Loose breathable tops", category: "Clothing", base: 3, perDays: 3, cap: 8 },
  { id: "loose-bottoms", name: "Loose trousers / skirts", category: "Clothing", base: 2, perDays: 5, cap: 6 },
  { id: "walking-shoes", name: "Comfortable walking shoes (broken in)", category: "Clothing", base: 1, community: true },
  { id: "sandals", name: "Sandals / slippers", category: "Clothing", base: 1 },
  { id: "socks", name: "Socks", category: "Clothing", base: 5, perDays: 2, cap: 12 },
  { id: "underwear", name: "Underwear", category: "Clothing", base: 5, perDays: 2, cap: 14 },
  { id: "sleepwear", name: "Sleepwear", category: "Clothing", base: 2 },
  { id: "light-jacket", name: "Light jacket", category: "Clothing", base: 1, seasons: ["winter", "autumn", "spring"] },
  { id: "warm-layer", name: "Warm fleece / shawl", category: "Clothing", base: 1, seasons: ["winter"] },
  { id: "shorts-sleeves", name: "Extra short-sleeve tops (heat)", category: "Clothing", base: 2, seasons: ["summer"] },

  // Toiletries
  { id: "soap", name: "Unscented soap", category: "Toiletries", base: 2, community: true },
  { id: "shampoo", name: "Unscented shampoo", category: "Toiletries", base: 1, community: true },
  { id: "toothbrush", name: "Toothbrush", category: "Toiletries", base: 1 },
  { id: "toothpaste", name: "Toothpaste", category: "Toiletries", base: 1 },
  { id: "miswak", name: "Miswak", category: "Toiletries", base: 2 },
  { id: "sunscreen", name: "Unscented sunscreen", category: "Toiletries", base: 1, seasons: ["spring", "summer", "autumn"] },
  { id: "lip-balm", name: "Lip balm", category: "Toiletries", base: 2 },
  { id: "wet-wipes", name: "Wet wipes", category: "Toiletries", base: 4, community: true },
  { id: "tissues", name: "Tissues", category: "Toiletries", base: 4 },
  { id: "deodorant", name: "Unscented deodorant", category: "Toiletries", base: 1 },
  { id: "razor", name: "Razor / nail clippers", category: "Toiletries", base: 1 },
  { id: "towel", name: "Quick-dry travel towel", category: "Toiletries", base: 2 },

  // Health & Medication
  { id: "paracetamol", name: "Paracetamol / pain relief", category: "Health & Medication", base: 1 },
  { id: "anti-diarrhea", name: "Anti-diarrhoea tablets", category: "Health & Medication", base: 1, community: true },
  { id: "plasters", name: "Plasters / blister pads", category: "Health & Medication", base: 1, community: true },
  { id: "hand-sanitiser", name: "Hand sanitiser", category: "Health & Medication", base: 2 },
  { id: "face-masks", name: "Face masks", category: "Health & Medication", base: 5, perDays: 2, cap: 20 },
  { id: "electrolytes", name: "Electrolyte sachets", category: "Health & Medication", base: 10, seasons: ["summer"], community: true },
  { id: "cooling-towel", name: "Cooling towel", category: "Health & Medication", base: 1, seasons: ["summer"] },
  { id: "misting-fan", name: "Handheld misting fan", category: "Health & Medication", base: 1, seasons: ["summer"], community: true },
  { id: "prescription", name: "Prescription medication + doctor's letter", category: "Health & Medication", base: 1, health: ["prescription"] },
  { id: "diabetes-kit", name: "Glucose monitor + insulin kit", category: "Health & Medication", base: 1, health: ["diabetes"] },
  { id: "diabetes-snacks", name: "Glucose tablets / snacks", category: "Health & Medication", base: 1, health: ["diabetes"] },
  { id: "inhaler", name: "Asthma inhaler (spare)", category: "Health & Medication", base: 2, health: ["asthma"] },
  { id: "allergy-meds", name: "Antihistamines / EpiPen", category: "Health & Medication", base: 1, health: ["allergies"] },
  { id: "vitamins", name: "Daily multivitamins", category: "Health & Medication", base: 1 },

  // Electronics
  { id: "phone-charger", name: "Phone charger + cable", category: "Electronics", base: 1 },
  { id: "powerbank", name: "Power bank (10,000 mAh+)", category: "Electronics", base: 1, community: true },
  { id: "adapter", name: "Universal adapter (Saudi Type G)", category: "Electronics", base: 2, community: true },
  { id: "headphones", name: "Headphones", category: "Electronics", base: 1 },
  { id: "torch", name: "Small torch / head torch", category: "Electronics", base: 1 },

  // Comfort & Essentials
  { id: "water-bottle", name: "Reusable water bottle", category: "Comfort & Essentials", base: 1, community: true },
  { id: "waist-bag", name: "Small backpack / waist bag", category: "Comfort & Essentials", base: 1 },
  { id: "eye-mask", name: "Eye mask", category: "Comfort & Essentials", base: 1 },
  { id: "ear-plugs", name: "Ear plugs", category: "Comfort & Essentials", base: 2 },
  { id: "travel-pillow", name: "Travel pillow", category: "Comfort & Essentials", base: 1 },
  { id: "snacks", name: "Snacks (dates, nuts, energy bars)", category: "Comfort & Essentials", base: 1 },
  { id: "ziplocks", name: "Zip-lock bags (assorted sizes)", category: "Comfort & Essentials", base: 10 },
  { id: "laundry-bag", name: "Laundry bag", category: "Comfort & Essentials", base: 1 },
  { id: "lota", name: "Portable bidet / lota", category: "Comfort & Essentials", base: 1, community: true },
  { id: "umbrella", name: "Compact umbrella (sun shade)", category: "Comfort & Essentials", base: 1, seasons: ["summer"] },
  { id: "id-bracelet", name: "Group / ID bracelet", category: "Comfort & Essentials", base: 1 },
  { id: "money-belt", name: "Hidden money belt", category: "Comfort & Essentials", base: 1 },

  // Mobility
  { id: "wheelchair-cushion", name: "Wheelchair cushion / accessories", category: "Comfort & Essentials", base: 1, health: ["wheelchair"] },
  { id: "walking-aid", name: "Folding walking stick / cane", category: "Comfort & Essentials", base: 1, health: ["mobility"] },

  // Children (multiplied below)
  { id: "child-clothes", name: "Children's clothing sets", category: "Clothing", base: 0, childrenOnly: true },
  { id: "child-snacks", name: "Children's snacks & milk powder", category: "Comfort & Essentials", base: 0, childrenOnly: true },
  { id: "child-meds", name: "Children's paracetamol", category: "Health & Medication", base: 0, childrenOnly: true },
];

function ruleQty(rule: Rule, prefs: PackingPrefs): number {
  if (rule.childrenOnly) {
    if (!prefs.withChildren || prefs.childCount <= 0) return 0;
    if (rule.id === "child-clothes") return Math.min(10, prefs.childCount * Math.min(7, prefs.duration));
    if (rule.id === "child-snacks") return prefs.childCount * 2;
    if (rule.id === "child-meds") return prefs.childCount;
    return prefs.childCount;
  }
  let qty = rule.base;
  if (rule.perDays) {
    qty += Math.floor(prefs.duration / rule.perDays);
  }
  if (rule.cap) qty = Math.min(rule.cap, qty);
  return Math.max(1, qty);
}

function ruleApplies(rule: Rule, prefs: PackingPrefs): boolean {
  if (rule.gender && rule.gender !== prefs.gender) return false;
  if (rule.seasons && !rule.seasons.includes(prefs.season)) return false;
  if (rule.health && !rule.health.some((h) => prefs.health.includes(h))) return false;
  if (rule.childrenOnly && (!prefs.withChildren || prefs.childCount <= 0)) return false;
  return true;
}

export function generatePackingList(prefs: PackingPrefs): PackingCategory[] {
  const grouped = new Map<string, PackingItem[]>();
  for (const cat of CATEGORIES) grouped.set(cat, []);
  for (const rule of RULES) {
    if (!ruleApplies(rule, prefs)) continue;
    const items = grouped.get(rule.category);
    if (!items) continue;
    items.push({
      id: rule.id,
      name: rule.name,
      qty: ruleQty(rule, prefs),
      community: rule.community,
    });
  }
  return CATEGORIES.map((name) => ({ name, items: grouped.get(name) ?? [] }));
}

export function seasonTip(season: Season): { title: string; body: string } | null {
  switch (season) {
    case "summer":
      return {
        title: "Summer pilgrimage tip",
        body: "Temperatures in Makkah can exceed 45°C. Pack electrolyte sachets, a cooling towel, and a handheld misting fan. Wear lightweight breathable fabrics, avoid dark colours, and carry a refillable water bottle everywhere.",
      };
    case "winter":
      return {
        title: "Winter pilgrimage tip",
        body: "Mornings and evenings in Madinah can drop below 10°C. Pack a warm fleece, a light jacket, and thermal layers for Fajr at the Haram. Days are still mild - bring breathable clothing too.",
      };
    case "spring":
      return {
        title: "Spring pilgrimage tip",
        body: "Comfortable temperatures but desert dust storms are common. Pack a face mask, sunglasses, and lip balm. Layer your clothing for cool mornings and warm afternoons.",
      };
    case "autumn":
      return {
        title: "Autumn pilgrimage tip",
        body: "Heat eases through October. Pack a light jacket for evenings, sunscreen for daytime, and stay hydrated - the climate is dry year-round.",
      };
    default:
      return null;
  }
}
