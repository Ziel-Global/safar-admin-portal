-- Cities table for autocomplete
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL,
  country_name text NOT NULL,
  population integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, country_code)
);

CREATE INDEX idx_cities_name ON public.cities (lower(name));
CREATE INDEX idx_cities_country_code ON public.cities (country_code);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cities are viewable by everyone"
  ON public.cities FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert cities"
  ON public.cities FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cities"
  ON public.cities FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cities"
  ON public.cities FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed top 100 departure cities
INSERT INTO public.cities (name, country_code, country_name, population) VALUES
  ('London', 'GB', 'United Kingdom', 9000000),
  ('Birmingham', 'GB', 'United Kingdom', 1150000),
  ('Manchester', 'GB', 'United Kingdom', 550000),
  ('Leeds', 'GB', 'United Kingdom', 800000),
  ('Glasgow', 'GB', 'United Kingdom', 635000),
  ('Bradford', 'GB', 'United Kingdom', 540000),
  ('Liverpool', 'GB', 'United Kingdom', 500000),
  ('Sheffield', 'GB', 'United Kingdom', 580000),
  ('Edinburgh', 'GB', 'United Kingdom', 520000),
  ('Cardiff', 'GB', 'United Kingdom', 490000),
  ('Newcastle', 'GB', 'United Kingdom', 300000),
  ('Nottingham', 'GB', 'United Kingdom', 330000),
  ('Leicester', 'GB', 'United Kingdom', 360000),
  ('Bristol', 'GB', 'United Kingdom', 470000),
  ('Luton', 'GB', 'United Kingdom', 220000),
  ('New York', 'US', 'United States', 8400000),
  ('Los Angeles', 'US', 'United States', 4000000),
  ('Chicago', 'US', 'United States', 2700000),
  ('Houston', 'US', 'United States', 2300000),
  ('Dallas', 'US', 'United States', 1340000),
  ('Detroit', 'US', 'United States', 670000),
  ('Washington', 'US', 'United States', 700000),
  ('Atlanta', 'US', 'United States', 500000),
  ('Minneapolis', 'US', 'United States', 430000),
  ('Toronto', 'CA', 'Canada', 2900000),
  ('Montreal', 'CA', 'Canada', 1780000),
  ('Vancouver', 'CA', 'Canada', 675000),
  ('Calgary', 'CA', 'Canada', 1340000),
  ('Ottawa', 'CA', 'Canada', 1010000),
  ('Sydney', 'AU', 'Australia', 5300000),
  ('Melbourne', 'AU', 'Australia', 5000000),
  ('Perth', 'AU', 'Australia', 2100000),
  ('Brisbane', 'AU', 'Australia', 2500000),
  ('Auckland', 'NZ', 'New Zealand', 1650000),
  ('Paris', 'FR', 'France', 2160000),
  ('Marseille', 'FR', 'France', 870000),
  ('Lyon', 'FR', 'France', 520000),
  ('Lille', 'FR', 'France', 235000),
  ('Berlin', 'DE', 'Germany', 3700000),
  ('Hamburg', 'DE', 'Germany', 1900000),
  ('Munich', 'DE', 'Germany', 1500000),
  ('Frankfurt', 'DE', 'Germany', 760000),
  ('Cologne', 'DE', 'Germany', 1085000),
  ('Amsterdam', 'NL', 'Netherlands', 870000),
  ('Rotterdam', 'NL', 'Netherlands', 650000),
  ('Brussels', 'BE', 'Belgium', 1220000),
  ('Antwerp', 'BE', 'Belgium', 530000),
  ('Madrid', 'ES', 'Spain', 3300000),
  ('Barcelona', 'ES', 'Spain', 1620000),
  ('Rome', 'IT', 'Italy', 2870000),
  ('Milan', 'IT', 'Italy', 1380000),
  ('Stockholm', 'SE', 'Sweden', 980000),
  ('Oslo', 'NO', 'Norway', 700000),
  ('Copenhagen', 'DK', 'Denmark', 660000),
  ('Helsinki', 'FI', 'Finland', 660000),
  ('Dublin', 'IE', 'Ireland', 590000),
  ('Lisbon', 'PT', 'Portugal', 540000),
  ('Vienna', 'AT', 'Austria', 1900000),
  ('Zurich', 'CH', 'Switzerland', 430000),
  ('Geneva', 'CH', 'Switzerland', 200000),
  ('Istanbul', 'TR', 'Turkey', 15500000),
  ('Ankara', 'TR', 'Turkey', 5700000),
  ('Dubai', 'AE', 'United Arab Emirates', 3500000),
  ('Abu Dhabi', 'AE', 'United Arab Emirates', 1480000),
  ('Doha', 'QA', 'Qatar', 2380000),
  ('Riyadh', 'SA', 'Saudi Arabia', 7700000),
  ('Jeddah', 'SA', 'Saudi Arabia', 4700000),
  ('Kuwait City', 'KW', 'Kuwait', 4100000),
  ('Manama', 'BH', 'Bahrain', 600000),
  ('Muscat', 'OM', 'Oman', 1400000),
  ('Cairo', 'EG', 'Egypt', 10100000),
  ('Alexandria', 'EG', 'Egypt', 5200000),
  ('Casablanca', 'MA', 'Morocco', 3700000),
  ('Rabat', 'MA', 'Morocco', 580000),
  ('Tunis', 'TN', 'Tunisia', 640000),
  ('Algiers', 'DZ', 'Algeria', 3400000),
  ('Lagos', 'NG', 'Nigeria', 15400000),
  ('Abuja', 'NG', 'Nigeria', 3500000),
  ('Nairobi', 'KE', 'Kenya', 4400000),
  ('Johannesburg', 'ZA', 'South Africa', 5600000),
  ('Cape Town', 'ZA', 'South Africa', 4600000),
  ('Karachi', 'PK', 'Pakistan', 16000000),
  ('Lahore', 'PK', 'Pakistan', 13000000),
  ('Islamabad', 'PK', 'Pakistan', 1100000),
  ('Mumbai', 'IN', 'India', 20400000),
  ('Delhi', 'IN', 'India', 32000000),
  ('Hyderabad', 'IN', 'India', 10500000),
  ('Bangalore', 'IN', 'India', 13200000),
  ('Chennai', 'IN', 'India', 11500000),
  ('Kolkata', 'IN', 'India', 14900000),
  ('Dhaka', 'BD', 'Bangladesh', 22000000),
  ('Chittagong', 'BD', 'Bangladesh', 5200000),
  ('Colombo', 'LK', 'Sri Lanka', 750000),
  ('Kuala Lumpur', 'MY', 'Malaysia', 1800000),
  ('Singapore', 'SG', 'Singapore', 5900000),
  ('Jakarta', 'ID', 'Indonesia', 10800000),
  ('Surabaya', 'ID', 'Indonesia', 2900000),
  ('Bandung', 'ID', 'Indonesia', 2500000),
  ('Manila', 'PH', 'Philippines', 13900000),
  ('Bangkok', 'TH', 'Thailand', 10700000),
  ('Hong Kong', 'HK', 'Hong Kong', 7400000),
  ('Tokyo', 'JP', 'Japan', 13900000);

-- Search logs table
CREATE TABLE public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  pilgrim_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  results_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_logs_session ON public.search_logs (session_id);
CREATE INDEX idx_search_logs_pilgrim ON public.search_logs (pilgrim_id);
CREATE INDEX idx_search_logs_created_at ON public.search_logs (created_at DESC);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert search logs"
  ON public.search_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all search logs"
  ON public.search_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update search logs"
  ON public.search_logs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete search logs"
  ON public.search_logs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));