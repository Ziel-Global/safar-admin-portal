-- Normalise existing mistyped departure cities so they match the canonical
-- cities table used by the search "By City" filter.
UPDATE public.packages
SET departure_city = 'Islamabad', departure_country = 'Pakistan'
WHERE departure_city ILIKE 'iskamabad';

-- Replace stored country codes with full country names to match how the
-- city picker now stores them.
UPDATE public.packages p
SET departure_country = c.country_name
FROM public.cities c
WHERE p.departure_city = c.name
  AND p.departure_country = c.country_code;