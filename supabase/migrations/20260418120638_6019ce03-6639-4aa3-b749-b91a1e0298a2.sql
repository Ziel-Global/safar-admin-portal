-- 1. checklist_templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  trip_type text NOT NULL CHECK (trip_type IN ('hajj','umrah')),
  locale text NOT NULL DEFAULT 'en',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, trip_type, locale)
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist templates are public"
  ON public.checklist_templates FOR SELECT USING (true);

CREATE POLICY "Admins manage checklist templates"
  ON public.checklist_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_checklist_templates_touch
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. pilgrim_checklists
CREATE TABLE public.pilgrim_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilgrim_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  trip_date date,
  items_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pilgrim_checklists_pilgrim ON public.pilgrim_checklists(pilgrim_id);

ALTER TABLE public.pilgrim_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilgrims view their own checklists"
  ON public.pilgrim_checklists FOR SELECT USING (pilgrim_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Pilgrims insert their own checklists"
  ON public.pilgrim_checklists FOR INSERT WITH CHECK (pilgrim_id = auth.uid());

CREATE POLICY "Pilgrims update their own checklists"
  ON public.pilgrim_checklists FOR UPDATE USING (pilgrim_id = auth.uid());

CREATE POLICY "Pilgrims delete their own checklists"
  ON public.pilgrim_checklists FOR DELETE USING (pilgrim_id = auth.uid());

CREATE TRIGGER trg_pilgrim_checklists_touch
  BEFORE UPDATE ON public.pilgrim_checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. emergency_contacts
CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('emergency','hospital','embassy','consulate','police','other')),
  name text NOT NULL,
  phone text,
  address text,
  latitude numeric,
  longitude numeric,
  notes text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emergency_contacts_country ON public.emergency_contacts(country_code);
CREATE INDEX idx_emergency_contacts_type ON public.emergency_contacts(contact_type);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Emergency contacts are public"
  ON public.emergency_contacts FOR SELECT USING (true);

CREATE POLICY "Admins manage emergency contacts"
  ON public.emergency_contacts FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. Seed checklist templates (UK, PK, ID, NG, US for both Hajj & Umrah)
INSERT INTO public.checklist_templates (country_code, trip_type, items) VALUES
('GB','umrah','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Passport valid 6+ months from return","description":"Saudi requires passports valid for at least 6 months beyond your return date.","deadline_offset_days":-180},
  {"id":"umrah_visa","section":"Passport & Visa","title":"Umrah visa approved","description":"Apply via Nusuk app or licensed UK agent. Allow 2-3 weeks.","deadline_offset_days":-21},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY vaccine (10+ days before)","description":"Mandatory for Saudi entry. Certificate required at airport.","deadline_offset_days":-10},
  {"id":"covid_health","section":"Health","title":"Health declaration ready","description":"Complete any current Saudi MOH declarations before travel.","deadline_offset_days":-3},
  {"id":"travel_insurance","section":"Health","title":"Travel insurance with medical cover","description":"Mandatory for visa. Must cover Hajj/Umrah-specific risks.","deadline_offset_days":-14},
  {"id":"flight_tickets","section":"Travel Documents","title":"Return flight tickets booked","description":"Saudi authorities check return ticket on entry.","deadline_offset_days":-30},
  {"id":"hotel_voucher","section":"Travel Documents","title":"Hotel reservations confirmed","description":"Print Makkah and Madinah hotel vouchers.","deadline_offset_days":-14},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents (women under 45)","description":"Marriage/birth certificates if travelling with Mahram.","deadline_offset_days":-30},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + card","description":"Bring SAR 1000-2000 cash plus a fee-free travel card.","deadline_offset_days":-7},
  {"id":"emergency_funds","section":"Financial","title":"Emergency funds accessible","description":"Notify your bank of travel dates to avoid card blocks.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments packed","description":"Two unstitched white sheets for men. Modest clothing for women.","deadline_offset_days":-3},
  {"id":"prescriptions","section":"Health","title":"Prescription medication + letter","description":"Carry medications in original packaging with a doctor''s letter.","deadline_offset_days":-7}
]'::jsonb),
('GB','hajj','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Passport valid 6+ months from return","description":"Saudi requires passports valid for at least 6 months beyond your return date.","deadline_offset_days":-180},
  {"id":"hajj_visa","section":"Passport & Visa","title":"Hajj visa via UK Hajj Mission","description":"Hajj visas issued through approved UK agents only — apply early.","deadline_offset_days":-90},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + flu + COVID boosters","description":"Mandatory ACWY plus seasonal vaccines for crowded conditions.","deadline_offset_days":-21},
  {"id":"medical_check","section":"Health","title":"Full medical fitness check","description":"GP check for cardiovascular fitness before Hajj.","deadline_offset_days":-30},
  {"id":"travel_insurance","section":"Health","title":"Hajj-specific travel insurance","description":"Standard insurance often excludes Hajj — buy specialist cover.","deadline_offset_days":-30},
  {"id":"flight_tickets","section":"Travel Documents","title":"Hajj package confirmed","description":"Use a UK-licensed Hajj operator. Keep package documents.","deadline_offset_days":-90},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents (women under 45)","description":"Required for women without Mahram exemption.","deadline_offset_days":-60},
  {"id":"id_bracelet","section":"Travel Documents","title":"ID bracelet & emergency card","description":"Wear ID with group leader contact at all times.","deadline_offset_days":-3},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + travel card","description":"Bring SAR 2000-3000 cash plus a fee-free card.","deadline_offset_days":-7},
  {"id":"sadaqah_funds","section":"Financial","title":"Sadaqah & dam (sacrifice) funds","description":"Budget for sacrifice and charitable giving on-site.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments + belt","description":"Two unstitched white sheets, ihram belt, sandals.","deadline_offset_days":-7},
  {"id":"prayer_mat","section":"Travel Documents","title":"Lightweight prayer mat & dua book","description":"Compact items for outdoor prayers in Mina.","deadline_offset_days":-7},
  {"id":"prescriptions","section":"Health","title":"Prescription medication + doctor''s letter","description":"Two weeks supply minimum, in original packaging.","deadline_offset_days":-7}
]'::jsonb),
('PK','umrah','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Pakistani passport valid 6+ months","description":"Renew in advance via NADRA — processing can take 4-6 weeks.","deadline_offset_days":-180},
  {"id":"umrah_visa","section":"Passport & Visa","title":"Umrah visa via approved Pakistani agent","description":"Use a Ministry of Religious Affairs approved travel agent.","deadline_offset_days":-30},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Polio vaccine","description":"Both required for Pakistani travellers to Saudi Arabia.","deadline_offset_days":-14},
  {"id":"travel_insurance","section":"Health","title":"Travel insurance certificate","description":"Mandatory for visa issuance.","deadline_offset_days":-21},
  {"id":"flight_tickets","section":"Travel Documents","title":"Return flight tickets","description":"PIA, Saudia, or other approved carrier.","deadline_offset_days":-30},
  {"id":"hotel_voucher","section":"Travel Documents","title":"Hotel reservations","description":"Confirmed Makkah and Madinah accommodation.","deadline_offset_days":-14},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documentation","description":"Nikah Nama / B-Form attested by NADRA for women under 45.","deadline_offset_days":-30},
  {"id":"cnic_copies","section":"Travel Documents","title":"CNIC + passport photocopies","description":"Multiple sets, kept separately from originals.","deadline_offset_days":-7},
  {"id":"currency","section":"Financial","title":"Saudi Riyal + USD backup","description":"Money changers in Pakistan accept USD readily.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram + comfortable footwear","description":"Available widely in Pakistani markets pre-departure.","deadline_offset_days":-3},
  {"id":"prescriptions","section":"Health","title":"Prescription medications","description":"Keep originals with prescription copies.","deadline_offset_days":-7},
  {"id":"emergency_contacts","section":"Travel Documents","title":"Emergency contact list","description":"Family + group leader + Pakistani embassy in Riyadh.","deadline_offset_days":-3}
]'::jsonb),
('PK','hajj','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Pakistani passport valid 6+ months","description":"Renew via NADRA well before Hajj season.","deadline_offset_days":-180},
  {"id":"hajj_quota","section":"Passport & Visa","title":"Hajj quota allocation confirmed","description":"Government or private scheme via Ministry of Religious Affairs.","deadline_offset_days":-120},
  {"id":"hajj_visa","section":"Passport & Visa","title":"Hajj visa stamped","description":"Issued through approved Pakistani Hajj operators.","deadline_offset_days":-60},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Polio + Flu","description":"All mandatory for Pakistani Hajj pilgrims.","deadline_offset_days":-30},
  {"id":"medical_fitness","section":"Health","title":"Hajj medical fitness certificate","description":"Issued by approved hospital — required before departure.","deadline_offset_days":-30},
  {"id":"travel_insurance","section":"Health","title":"Hajj insurance package","description":"Often included in package — confirm coverage.","deadline_offset_days":-60},
  {"id":"package_docs","section":"Travel Documents","title":"Hajj package documents","description":"Schedule, hotel, transport, group leader contacts.","deadline_offset_days":-30},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents","description":"Required for women — Nikah Nama, B-Form, attested copies.","deadline_offset_days":-60},
  {"id":"id_bracelet","section":"Travel Documents","title":"ID bracelet + group identification","description":"Issued by your operator before departure.","deadline_offset_days":-3},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + USD","description":"SAR 3000+ recommended for personal expenses.","deadline_offset_days":-7},
  {"id":"sadaqah_funds","section":"Financial","title":"Dam (sacrifice) and sadaqah budget","description":"Often handled via approved IDB scheme.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram + waist belt + sandals","description":"Widely available in Pakistan — buy 2 sets.","deadline_offset_days":-7},
  {"id":"prescriptions","section":"Health","title":"Prescription medications + doctor''s note","description":"Three weeks supply in original packaging.","deadline_offset_days":-7}
]'::jsonb),
('ID','umrah','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Indonesian passport valid 6+ months","description":"Renew at Imigrasi office well in advance.","deadline_offset_days":-180},
  {"id":"umrah_visa","section":"Passport & Visa","title":"Umrah visa via PPIU agent","description":"Use a Kemenag-registered Umrah travel organiser (PPIU).","deadline_offset_days":-21},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY vaccine","description":"Available at Indonesian port health offices.","deadline_offset_days":-10},
  {"id":"istitha_app","section":"Health","title":"Register on Istitho''ah Kesehatan","description":"Indonesian MOH health declaration required pre-travel.","deadline_offset_days":-14},
  {"id":"travel_insurance","section":"Health","title":"Travel insurance certificate","description":"Required for Saudi visa.","deadline_offset_days":-14},
  {"id":"flight_tickets","section":"Travel Documents","title":"Return flight tickets booked","description":"Garuda, Saudia, or approved carrier.","deadline_offset_days":-30},
  {"id":"hotel_voucher","section":"Travel Documents","title":"Hotel reservations","description":"Print Makkah and Madinah vouchers.","deadline_offset_days":-14},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents (women under 45)","description":"Buku Nikah / Kartu Keluarga as proof.","deadline_offset_days":-30},
  {"id":"ktp_copies","section":"Travel Documents","title":"KTP + passport copies","description":"Multiple sets stored separately.","deadline_offset_days":-7},
  {"id":"currency","section":"Financial","title":"Saudi Riyal + USD","description":"Exchange in Indonesia — bring SAR 1500+ cash.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments","description":"Buy via PPIU package or local Islamic store.","deadline_offset_days":-3},
  {"id":"prescriptions","section":"Health","title":"Prescription medications","description":"Keep doctor''s letter in English.","deadline_offset_days":-7}
]'::jsonb),
('ID','hajj','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Indonesian passport valid 6+ months","description":"Renew at Imigrasi well before Hajj.","deadline_offset_days":-180},
  {"id":"hajj_quota","section":"Passport & Visa","title":"Hajj quota slot confirmed","description":"Indonesia operates a long Hajj waiting list — confirm via Kemenag.","deadline_offset_days":-180},
  {"id":"hajj_visa","section":"Passport & Visa","title":"Hajj visa via Kemenag","description":"Kementerian Agama coordinates Hajj visa issuance.","deadline_offset_days":-60},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Flu + COVID","description":"All mandatory for Indonesian Hajj pilgrims.","deadline_offset_days":-30},
  {"id":"istitha_app","section":"Health","title":"Istitho''ah Kesehatan health certificate","description":"Mandatory health screening from approved Indonesian clinic.","deadline_offset_days":-60},
  {"id":"travel_insurance","section":"Health","title":"Hajj insurance via Kemenag","description":"Usually included in BPIH package.","deadline_offset_days":-60},
  {"id":"package_docs","section":"Travel Documents","title":"Kemenag Hajj package documents","description":"BPIH receipt, kloter (group) details, schedule.","deadline_offset_days":-30},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents","description":"Buku Nikah / Kartu Keluarga for women under 45.","deadline_offset_days":-60},
  {"id":"id_bracelet","section":"Travel Documents","title":"Gelang ID kloter","description":"Distributed by Kemenag with kloter (flight group) info.","deadline_offset_days":-3},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash","description":"Living allowance partially provided — SAR 1500 personal recommended.","deadline_offset_days":-7},
  {"id":"sadaqah_funds","section":"Financial","title":"Dam (sacrifice) funds","description":"Often handled via Kemenag — confirm with kloter leader.","deadline_offset_days":-14},
  {"id":"ihram","section":"Travel Documents","title":"Ihram + waist belt + sandals","description":"Provided in some BPIH packages.","deadline_offset_days":-14},
  {"id":"prescriptions","section":"Health","title":"Prescription medications","description":"Three weeks supply with English doctor''s letter.","deadline_offset_days":-14}
]'::jsonb),
('NG','umrah','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Nigerian passport valid 6+ months","description":"Renew at NIS — allow 6-8 weeks for processing.","deadline_offset_days":-180},
  {"id":"umrah_visa","section":"Passport & Visa","title":"Umrah visa via NAHCON-licensed agent","description":"Use a National Hajj Commission-approved tour operator.","deadline_offset_days":-30},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Yellow Fever + Polio","description":"Yellow Fever required for Nigerian travellers to Saudi.","deadline_offset_days":-14},
  {"id":"yellow_card","section":"Health","title":"International Yellow Card","description":"Carry stamped vaccination certificate at all times.","deadline_offset_days":-14},
  {"id":"travel_insurance","section":"Health","title":"Travel insurance certificate","description":"Required for Saudi visa.","deadline_offset_days":-21},
  {"id":"flight_tickets","section":"Travel Documents","title":"Return flight tickets","description":"Saudia, Egyptair, or approved carrier.","deadline_offset_days":-30},
  {"id":"hotel_voucher","section":"Travel Documents","title":"Hotel reservations","description":"Makkah and Madinah confirmations.","deadline_offset_days":-14},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documentation","description":"Marriage / birth certificates for women under 45.","deadline_offset_days":-30},
  {"id":"nin_copies","section":"Travel Documents","title":"NIN + passport copies","description":"Multiple sets kept separately.","deadline_offset_days":-7},
  {"id":"currency","section":"Financial","title":"Saudi Riyal + USD","description":"Limited Naira availability abroad — bring USD for exchange.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments","description":"Buy in Lagos / Kano markets pre-departure.","deadline_offset_days":-3},
  {"id":"prescriptions","section":"Health","title":"Prescription medications","description":"Original packaging with prescription.","deadline_offset_days":-7}
]'::jsonb),
('NG','hajj','[
  {"id":"passport_validity","section":"Passport & Visa","title":"Nigerian passport valid 6+ months","description":"Renew via NIS well in advance of Hajj.","deadline_offset_days":-180},
  {"id":"hajj_quota","section":"Passport & Visa","title":"Hajj quota via NAHCON","description":"State pilgrims welfare board allocates quota slots.","deadline_offset_days":-120},
  {"id":"hajj_visa","section":"Passport & Visa","title":"Hajj visa via NAHCON","description":"Coordinated by National Hajj Commission of Nigeria.","deadline_offset_days":-60},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Yellow Fever + Polio + Flu","description":"All mandatory for Nigerian Hajj pilgrims.","deadline_offset_days":-30},
  {"id":"medical_fitness","section":"Health","title":"Hajj medical screening","description":"NAHCON-approved hospital screening certificate.","deadline_offset_days":-30},
  {"id":"travel_insurance","section":"Health","title":"NAHCON Hajj insurance","description":"Included in NAHCON Hajj package.","deadline_offset_days":-60},
  {"id":"package_docs","section":"Travel Documents","title":"NAHCON package documents","description":"Schedule, kloter, accommodation details.","deadline_offset_days":-30},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documentation","description":"Required for women under 45 — marriage / birth certificates.","deadline_offset_days":-60},
  {"id":"id_bracelet","section":"Travel Documents","title":"NAHCON ID bracelet","description":"Issued before departure with state contingent details.","deadline_offset_days":-3},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + USD","description":"BTA limit applies — plan currency mix carefully.","deadline_offset_days":-14},
  {"id":"sadaqah_funds","section":"Financial","title":"Dam and sadaqah funds","description":"Often handled via NAHCON — confirm with leader.","deadline_offset_days":-14},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments + sandals","description":"Buy in Nigerian markets — bring 2 sets.","deadline_offset_days":-14},
  {"id":"prescriptions","section":"Health","title":"Prescription medications","description":"Three weeks supply with doctor''s letter in English.","deadline_offset_days":-14}
]'::jsonb),
('US','umrah','[
  {"id":"passport_validity","section":"Passport & Visa","title":"US passport valid 6+ months","description":"Renew via State Department — routine processing 6-8 weeks.","deadline_offset_days":-180},
  {"id":"umrah_visa","section":"Passport & Visa","title":"Umrah visa via Nusuk app","description":"US passport holders eligible for e-visa via Nusuk.","deadline_offset_days":-21},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY vaccine","description":"Mandatory for entry — get certificate from CDC-approved provider.","deadline_offset_days":-10},
  {"id":"covid_health","section":"Health","title":"Health declaration","description":"Check current Saudi MOH requirements pre-travel.","deadline_offset_days":-3},
  {"id":"travel_insurance","section":"Health","title":"Travel insurance with medical evacuation","description":"US health insurance rarely covers Saudi — buy travel cover.","deadline_offset_days":-14},
  {"id":"flight_tickets","section":"Travel Documents","title":"Return flight tickets booked","description":"Saudia, Delta, United, or partner carriers.","deadline_offset_days":-30},
  {"id":"hotel_voucher","section":"Travel Documents","title":"Hotel reservations","description":"Print Makkah and Madinah confirmations.","deadline_offset_days":-14},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents (women under 45)","description":"Marriage / birth certificates if travelling with Mahram.","deadline_offset_days":-30},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + travel card","description":"USD widely accepted — bring SAR 1500-2500 for convenience.","deadline_offset_days":-7},
  {"id":"emergency_funds","section":"Financial","title":"Notify bank of travel","description":"Avoid card blocks — register travel dates with your bank.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments packed","description":"Two unstitched white sheets for men. Modest clothing for women.","deadline_offset_days":-3},
  {"id":"prescriptions","section":"Health","title":"Prescription medication + letter","description":"Original packaging plus doctor''s letter in English.","deadline_offset_days":-7}
]'::jsonb),
('US','hajj','[
  {"id":"passport_validity","section":"Passport & Visa","title":"US passport valid 6+ months","description":"Renew via State Department well before Hajj season.","deadline_offset_days":-180},
  {"id":"hajj_visa","section":"Passport & Visa","title":"Hajj visa via approved US Hajj operator","description":"Saudi Embassy in DC issues Hajj visas via approved agents.","deadline_offset_days":-90},
  {"id":"vaccinations","section":"Health","title":"Meningitis ACWY + Flu + COVID boosters","description":"Mandatory ACWY plus seasonal vaccines.","deadline_offset_days":-21},
  {"id":"medical_check","section":"Health","title":"Full medical fitness check","description":"Cardiovascular and general fitness screening.","deadline_offset_days":-30},
  {"id":"travel_insurance","section":"Health","title":"Hajj-specific travel insurance","description":"Standard plans exclude Hajj — buy specialist cover with medical evac.","deadline_offset_days":-30},
  {"id":"package_docs","section":"Travel Documents","title":"Hajj package documents","description":"Use a US-licensed Hajj operator — keep all paperwork.","deadline_offset_days":-90},
  {"id":"mahram_docs","section":"Travel Documents","title":"Mahram documents (women under 45)","description":"Required without Mahram exemption.","deadline_offset_days":-60},
  {"id":"id_bracelet","section":"Travel Documents","title":"ID bracelet & emergency card","description":"Wear at all times with group leader contact.","deadline_offset_days":-3},
  {"id":"currency","section":"Financial","title":"Saudi Riyal cash + travel card","description":"SAR 2500-3500 cash recommended for Hajj.","deadline_offset_days":-7},
  {"id":"sadaqah_funds","section":"Financial","title":"Sadaqah & dam (sacrifice) funds","description":"Budget for sacrifice and on-site charity.","deadline_offset_days":-7},
  {"id":"ihram","section":"Travel Documents","title":"Ihram garments + belt","description":"Two unstitched white sheets, ihram belt, sandals.","deadline_offset_days":-7},
  {"id":"prayer_mat","section":"Travel Documents","title":"Lightweight prayer mat & dua book","description":"Compact items for outdoor prayers in Mina.","deadline_offset_days":-7},
  {"id":"prescriptions","section":"Health","title":"Prescription medication + doctor''s letter","description":"Three weeks supply in original packaging.","deadline_offset_days":-7}
]'::jsonb);

-- 5. Seed Saudi emergency numbers
INSERT INTO public.emergency_contacts (country_code, contact_type, name, phone, address, sort_order, notes) VALUES
('SA','emergency','Unified Emergency Number','911',NULL,1,'All emergencies — Saudi Arabia (replaces older numbers)'),
('SA','emergency','Police','999',NULL,2,'Direct police line'),
('SA','emergency','Ambulance / Red Crescent','997',NULL,3,'Medical emergencies'),
('SA','emergency','Civil Defense / Fire','998',NULL,4,'Fire and rescue services'),
('SA','emergency','Traffic Police','993',NULL,5,'Road accidents and traffic'),
('SA','emergency','Hajj & Umrah Helpline','920002814',NULL,6,'Saudi Ministry of Hajj and Umrah hotline'),
-- Hospitals in Makkah / Madinah
('SA','hospital','King Abdullah Medical City — Makkah','+966125509999','Al Mashair, Makkah 24246, Saudi Arabia',10,'Major tertiary hospital near the Holy Sites'),
('SA','hospital','King Faisal Hospital — Makkah','+966125566200','Al Aziziyah, Makkah, Saudi Arabia',11,'General hospital serving central Makkah'),
('SA','hospital','Ajyad Emergency Hospital — Makkah','+966125749999','Ajyad St, Near Masjid al-Haram, Makkah',12,'Closest hospital to Masjid al-Haram'),
('SA','hospital','King Fahd Hospital — Madinah','+966148237000','Quba Rd, Madinah 42351, Saudi Arabia',13,'Major hospital in Madinah'),
('SA','hospital','Madinah General Hospital — Madinah','+966148260000','Khalid bin Walid Rd, Madinah',14,'Central Madinah emergency care'),
-- Embassies for top 10 sending countries
('GB','embassy','British Embassy — Riyadh','+966114819100','Diplomatic Quarter, Riyadh 11693, Saudi Arabia',20,'UK embassy. Consular emergencies 24/7'),
('GB','consulate','British Consulate-General — Jeddah','+966126227730','Al Hamra District, Jeddah',21,'UK consulate serving Hajj/Umrah pilgrims'),
('PK','embassy','Pakistan Embassy — Riyadh','+966114919999','Diplomatic Quarter, Riyadh, Saudi Arabia',22,'Pakistan embassy'),
('PK','consulate','Pakistan Consulate-General — Jeddah','+966126614111','Al Hamra District, Jeddah',23,'Pakistan consulate — Hajj/Umrah support'),
('ID','embassy','Indonesian Embassy — Riyadh','+966114882800','Diplomatic Quarter, Riyadh, Saudi Arabia',24,'Indonesia embassy'),
('ID','consulate','Indonesian Consulate-General — Jeddah','+966126699760','Madain Al Fahd District, Jeddah',25,'Indonesia consulate'),
('NG','embassy','Nigerian Embassy — Riyadh','+966114825193','Diplomatic Quarter, Riyadh, Saudi Arabia',26,'Nigeria embassy'),
('NG','consulate','Nigerian Consulate — Jeddah','+966126830024','Al Andalus District, Jeddah',27,'Nigeria consulate — NAHCON liaison'),
('US','embassy','US Embassy — Riyadh','+966114883800','Diplomatic Quarter, Riyadh 11564, Saudi Arabia',28,'US embassy. Emergencies +966 11 488 3800'),
('US','consulate','US Consulate-General — Jeddah','+966126670080','Al Falah District, Jeddah',29,'US consulate serving western Saudi Arabia'),
('IN','embassy','Indian Embassy — Riyadh','+966114884144','Diplomatic Quarter, Riyadh, Saudi Arabia',30,'India embassy'),
('IN','consulate','Indian Consulate-General — Jeddah','+966126614848','Al Hamra District, Jeddah',31,'India consulate — Hajj support'),
('BD','embassy','Bangladesh Embassy — Riyadh','+966114195300','Diplomatic Quarter, Riyadh, Saudi Arabia',32,'Bangladesh embassy'),
('BD','consulate','Bangladesh Consulate-General — Jeddah','+966126510999','Al Andalus District, Jeddah',33,'Bangladesh consulate'),
('TR','embassy','Turkish Embassy — Riyadh','+966114821053','Diplomatic Quarter, Riyadh, Saudi Arabia',34,'Türkiye embassy'),
('MY','embassy','Malaysian Embassy — Riyadh','+966114882207','Diplomatic Quarter, Riyadh, Saudi Arabia',35,'Malaysia embassy — Tabung Haji liaison'),
('EG','embassy','Egyptian Embassy — Riyadh','+966114911069','Diplomatic Quarter, Riyadh, Saudi Arabia',36,'Egypt embassy'),
('FR','embassy','French Embassy — Riyadh','+966114347222','Diplomatic Quarter, Riyadh, Saudi Arabia',37,'France embassy');