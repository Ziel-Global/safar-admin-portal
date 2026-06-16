-- Create guide_rituals table
CREATE TABLE public.guide_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_type text NOT NULL CHECK (guide_type IN ('hajj','umrah')),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_mistakes text[] NOT NULL DEFAULT ARRAY[]::text[],
  header_image_url text,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_rituals_type_sort ON public.guide_rituals(guide_type, sort_order);

ALTER TABLE public.guide_rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ritual guides are public"
  ON public.guide_rituals FOR SELECT USING (true);

CREATE POLICY "Admins manage ritual guides"
  ON public.guide_rituals FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_guide_rituals_touch
  BEFORE UPDATE ON public.guide_rituals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed Umrah rituals
INSERT INTO public.guide_rituals (guide_type, name, slug, sort_order, description, steps, common_mistakes) VALUES
('umrah','Ihram','umrah-ihram',1,
 'The sacred state of consecration entered before crossing the Miqat. It marks the formal beginning of your Umrah.',
 '[
   {"order":1,"text":"Perform ghusl (full body wash) or wudu before entering Ihram. Trim nails, remove unwanted hair, and apply unscented oil if desired."},
   {"order":2,"text":"Men wear two white unstitched cloths (izar around the waist, rida over the shoulders). Women wear modest everyday clothing — face and hands remain uncovered."},
   {"order":3,"text":"Pray two rak''ahs of Salat al-Ihram with the intention of starting Umrah, if it is not a disliked time for prayer."},
   {"order":4,"text":"Make the niyyah (intention) for Umrah and recite the Talbiyah aloud.","dua_arabic":"لَبَّيْكَ اللَّهُمَّ عُمْرَةً","dua_transliteration":"Labbayk Allahumma ''Umratan","dua_translation":"Here I am, O Allah, for Umrah."},
   {"order":5,"text":"Repeat the Talbiyah frequently from this point until you begin Tawaf.","dua_arabic":"لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ","dua_transliteration":"Labbayk Allahumma labbayk, labbayka la sharika laka labbayk, innal-hamda wan-ni''mata laka wal-mulk, la sharika lak","dua_translation":"Here I am, O Allah, here I am. Here I am, You have no partner, here I am. Surely all praise, blessing, and dominion are Yours. You have no partner."}
 ]'::jsonb,
 ARRAY[
   'Crossing the Miqat without entering Ihram — you must return or pay a penalty (dam).',
   'Using scented soap, perfume, or scented wipes after Ihram has begun.',
   'Men covering the head with a hat or umbrella that touches the head, or wearing stitched garments.',
   'Forgetting to make the verbal intention — Ihram is the niyyah plus Talbiyah, not just the clothing.'
 ]),

('umrah','Tawaf','umrah-tawaf',2,
 'Circumambulating the Kaaba seven times in an anti-clockwise direction, beginning and ending at the Black Stone (Hajar al-Aswad).',
 '[
   {"order":1,"text":"Stop the Talbiyah on entering the Masjid al-Haram. Approach the Black Stone with the Kaaba on your left."},
   {"order":2,"text":"Make the intention for Tawaf al-Umrah. Face the Black Stone, raise your right hand toward it, and say ''Bismillah, Allahu Akbar''. Kiss it if possible without harming others — otherwise just point."},
   {"order":3,"text":"For the first three circuits men perform raml (brisk walking with shoulders shaken). Walk normally for the remaining four. Women walk normally throughout."},
   {"order":4,"text":"Throughout Tawaf, recite any dhikr, du''a, or Quran. There is no fixed prayer for each lap.","dua_arabic":"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ","dua_transliteration":"Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina ''adhaban-nar","dua_translation":"Our Lord, give us good in this world and good in the Hereafter, and save us from the punishment of the Fire."},
   {"order":5,"text":"Each time you pass the Black Stone, point to it and say ''Allahu Akbar''. Each time you pass the Yemeni Corner, touch it if easy — do not kiss or point."},
   {"order":6,"text":"After completing seven circuits, cover both shoulders (men), and pray two rak''ahs behind Maqam Ibrahim if possible — otherwise anywhere in the mosque."},
   {"order":7,"text":"Drink Zamzam water generously. Many pilgrims face the Kaaba while drinking and make personal du''a."}
 ]'::jsonb,
 ARRAY[
   'Starting Tawaf from the wrong place — it must begin in line with the Black Stone.',
   'Walking inside the Hijr Ismail (the semi-circular wall) — this area is part of the Kaaba and must be circled around.',
   'Pushing or harming others to kiss the Black Stone — pointing is fully sufficient.',
   'Counting only six or eight circuits by mistake — use a tasbih or app to keep count accurately.'
 ]),

('umrah','Sa''i','umrah-sai',3,
 'Walking seven times between the hills of Safa and Marwah, commemorating Hajar''s search for water for her son Isma''il.',
 '[
   {"order":1,"text":"After Tawaf and the two rak''ahs, head to Safa. As you approach, recite the verse from Surah al-Baqarah (2:158).","dua_arabic":"إِنَّ الصَّفَا وَالْمَرْوَةَ مِن شَعَائِرِ اللَّهِ","dua_transliteration":"Innas-Safa wal-Marwata min sha''a''irillah","dua_translation":"Indeed Safa and Marwah are among the symbols of Allah."},
   {"order":2,"text":"Climb Safa, face the Kaaba, raise both hands, and say the takbir and tahlil three times, making personal du''a between each.","dua_arabic":"اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ","dua_transliteration":"Allahu Akbar. La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ''ala kulli shay''in qadir","dua_translation":"Allah is the Greatest. There is no god but Allah, alone, with no partner. To Him belongs all sovereignty and praise, and He is over all things capable."},
   {"order":3,"text":"Walk down toward Marwah. Men jog briskly between the two green markers; women walk normally throughout."},
   {"order":4,"text":"On reaching Marwah, climb it, face the Kaaba, and repeat the same du''a as on Safa. This counts as one circuit."},
   {"order":5,"text":"Continue back and forth seven times in total. Safa to Marwah is one, Marwah to Safa is two, and so on. The seventh ends at Marwah."},
   {"order":6,"text":"There is no fixed dhikr — recite Quran, make du''a, or remember Allah in any words during the walk."}
 ]'::jsonb,
 ARRAY[
   'Counting one round trip (Safa → Marwah → Safa) as one circuit — each one-way trip is one circuit.',
   'Performing Sa''i without first completing Tawaf.',
   'Skipping the climb of Safa or Marwah — even just stepping onto the marked area is enough, but it must not be omitted.',
   'Believing the green-light jogging zone applies to women — it is for men only.'
 ]),

('umrah','Halq or Taqsir','umrah-halq-taqsir',4,
 'Shaving (halq) or shortening (taqsir) the hair, which marks the completion of Umrah and exit from the state of Ihram.',
 '[
   {"order":1,"text":"After completing Sa''i, proceed to one of the barber shops near the Haram or your accommodation."},
   {"order":2,"text":"Men: shaving the head completely (halq) is preferred and earns greater reward. Shortening the hair (taqsir) is also permitted — at least a fingertip''s length must be cut from all around the head."},
   {"order":3,"text":"Women: only taqsir is allowed. Cut at least a fingertip''s length from the end of the hair — typically gathered together and cut once."},
   {"order":4,"text":"Make a quiet du''a of gratitude after cutting — there is no fixed wording.","dua_arabic":"الْحَمْدُ لِلَّهِ الَّذِي أَكْمَلَ لَنَا عُمْرَتَنَا","dua_transliteration":"Alhamdulillahil-ladhi akmala lana ''umratana","dua_translation":"All praise to Allah who has completed our Umrah for us."},
   {"order":5,"text":"With the hair cut, you have now exited Ihram. All previous restrictions (perfume, normal clothing, etc.) are lifted. Your Umrah is complete."}
 ]'::jsonb,
 ARRAY[
   'Cutting only a few hairs as taqsir — the cut must cover all of the head (men) or at least a fingertip from the bulk of the hair (women).',
   'Women shaving their heads — this is not permitted.',
   'Removing Ihram clothing or applying perfume before any hair has been cut.',
   'Choosing barbers who do not sterilise blades properly — always check hygiene.'
 ]);

-- Seed Hajj-specific rituals
INSERT INTO public.guide_rituals (guide_type, name, slug, sort_order, description, steps, common_mistakes) VALUES
('hajj','Ihram','hajj-ihram',1,
 'Entering the sacred state of Ihram on the 8th of Dhul Hijjah (Yawm at-Tarwiyah) with the intention of Hajj.',
 '[
   {"order":1,"text":"Perform ghusl, trim nails, and put on Ihram clothing as for Umrah."},
   {"order":2,"text":"Pray two rak''ahs and make the intention for Hajj.","dua_arabic":"لَبَّيْكَ اللَّهُمَّ حَجًّا","dua_transliteration":"Labbayk Allahumma Hajjan","dua_translation":"Here I am, O Allah, for Hajj."},
   {"order":3,"text":"Recite the Talbiyah continuously and travel to Mina before Dhuhr on the 8th of Dhul Hijjah.","dua_arabic":"لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ","dua_transliteration":"Labbayk Allahumma labbayk, labbayka la sharika laka labbayk","dua_translation":"Here I am, O Allah, here I am. Here I am, You have no partner, here I am."},
   {"order":4,"text":"Observe all Ihram restrictions strictly — no perfume, no cutting hair or nails, no marital relations, no arguing, no hunting."}
 ]'::jsonb,
 ARRAY[
   'Delaying entering Ihram until after reaching Mina.',
   'Forgetting that all Ihram restrictions from Umrah apply equally to Hajj.',
   'Travelling without enough water and snacks — the journey to Mina can be slow with crowds.'
 ]),

('hajj','Mina (Yawm at-Tarwiyah)','hajj-mina',2,
 'Spending the 8th of Dhul Hijjah in the tent city of Mina in worship and preparation for the Day of Arafat.',
 '[
   {"order":1,"text":"Arrive at your assigned camp in Mina before Dhuhr on the 8th of Dhul Hijjah."},
   {"order":2,"text":"Pray Dhuhr, Asr, Maghrib, Isha, and Fajr in Mina. Each four-rak''ah prayer is shortened (qasr) to two rak''ahs but not combined."},
   {"order":3,"text":"Spend the day and night in worship — recite Quran, make du''a, sleep early to be ready for the journey to Arafat after Fajr."},
   {"order":4,"text":"Continue reciting the Talbiyah throughout your stay.","dua_arabic":"لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ","dua_transliteration":"Labbayk Allahumma labbayk","dua_translation":"Here I am, O Allah, here I am."},
   {"order":5,"text":"Drink plenty of water and rest — the next day in Arafat is physically demanding."}
 ]'::jsonb,
 ARRAY[
   'Combining prayers in Mina — they are shortened, not combined.',
   'Wandering far from your assigned tent — getting lost in the camps is very common.',
   'Underestimating dehydration — keep a water bottle with you at all times.'
 ]),

('hajj','Arafat (Yawm al-Wuquf)','hajj-arafat',3,
 'Standing at Arafat from Dhuhr until sunset on the 9th of Dhul Hijjah — the central pillar of Hajj. Without Arafat, there is no Hajj.',
 '[
   {"order":1,"text":"After Fajr on the 9th, travel from Mina to Arafat. Arrive before midday so you are inside the boundary by Dhuhr."},
   {"order":2,"text":"Pray Dhuhr and Asr together as a shortened combined prayer (qasr and jam''), led if possible by the imam."},
   {"order":3,"text":"Spend the entire afternoon in du''a, dhikr, repentance, and Quran. Face the Qibla, raise your hands, and pour out your needs to Allah."},
   {"order":4,"text":"Recite the most virtuous du''a of the day repeatedly.","dua_arabic":"لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ","dua_transliteration":"La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ''ala kulli shay''in qadir","dua_translation":"There is no god but Allah, alone, with no partner. To Him belongs all sovereignty and praise, and He is over all things capable."},
   {"order":5,"text":"Do not leave the boundary of Arafat until after sunset. Confirm with your group leaders that you are inside the marked area."},
   {"order":6,"text":"After sunset, depart calmly toward Muzdalifah without praying Maghrib at Arafat."}
 ]'::jsonb,
 ARRAY[
   'Leaving Arafat before sunset — this invalidates the standing and may require a penalty.',
   'Standing outside the marked boundary by mistake — many pilgrims set up tents just outside.',
   'Wasting the afternoon on social media or sleep instead of du''a — this is the most blessed time of the year.',
   'Praying Maghrib at Arafat — Maghrib should be delayed and combined with Isha at Muzdalifah.'
 ]),

('hajj','Muzdalifah','hajj-muzdalifah',4,
 'Spending the night of the 9th–10th of Dhul Hijjah at Muzdalifah, where pilgrims combine Maghrib and Isha and gather pebbles for Rami.',
 '[
   {"order":1,"text":"Travel from Arafat to Muzdalifah after sunset. Do not pray Maghrib until you arrive."},
   {"order":2,"text":"On arrival, pray Maghrib (3 rak''ahs) and Isha (2 rak''ahs, shortened) combined with one adhan and two iqamahs."},
   {"order":3,"text":"Sleep on the open ground until Fajr. Travel light and bring a small mat or sheet."},
   {"order":4,"text":"Collect 49 small pebbles (about the size of a chickpea) for the days of Rami al-Jamarat. Take 70 if you plan to stay through the 13th."},
   {"order":5,"text":"Pray Fajr early on the 10th, then make abundant du''a until just before sunrise.","dua_arabic":"اللَّهُمَّ كَمَا أَوْقَفْتَنَا فِيهِ وَأَرَيْتَنَا إِيَّاهُ، فَوَفِّقْنَا لِذِكْرِكَ كَمَا هَدَيْتَنَا","dua_transliteration":"Allahumma kama awqaftana fihi wa araytana iyyah, fawaffiqna li-dhikrika kama hadaytana","dua_translation":"O Allah, just as You have made us stand here and shown it to us, grant us the ability to remember You as You have guided us."},
   {"order":6,"text":"Depart for Mina before sunrise. The weak, elderly, women, and children may leave Muzdalifah after midnight."}
 ]'::jsonb,
 ARRAY[
   'Praying Maghrib before reaching Muzdalifah — it must be delayed and combined with Isha there.',
   'Collecting pebbles from the Jamarat area itself — pebbles should be gathered at Muzdalifah or anywhere nearby that is clean.',
   'Leaving Muzdalifah before midnight without a valid reason — this is required to spend at least part of the night there.'
 ]),

('hajj','Rami al-Jamarat','hajj-rami',5,
 'Throwing pebbles at the three pillars (Jamarat) in Mina on the 10th, 11th, 12th and optionally 13th of Dhul Hijjah.',
 '[
   {"order":1,"text":"On the 10th of Dhul Hijjah after sunrise, head to Jamarat al-Aqaba (the largest pillar) and throw 7 pebbles, one at a time, saying ''Allahu Akbar'' with each.","dua_arabic":"اللَّهُ أَكْبَرُ","dua_transliteration":"Allahu Akbar","dua_translation":"Allah is the Greatest."},
   {"order":2,"text":"On the 10th, only Jamarat al-Aqaba is stoned. Stop the Talbiyah after the first stone hits."},
   {"order":3,"text":"On the 11th, 12th, and optionally 13th, stone all three pillars after Dhuhr — the small (Sughra), middle (Wusta), and large (Aqaba) — 7 stones each."},
   {"order":4,"text":"After Sughra and Wusta, step aside, face the Qibla, raise your hands, and make long du''a. Do not stop after Aqaba."},
   {"order":5,"text":"If crowds are dangerous, you may stone after sunset or even at night. Weak or elderly pilgrims may delegate stoning to a trusted companion."},
   {"order":6,"text":"Stones must enter the basin around the pillar — they do not have to strike the pillar itself."}
 ]'::jsonb,
 ARRAY[
   'Throwing all 7 stones at once — each must be thrown individually.',
   'Using stones that are too large — they must be small pebbles only.',
   'Pushing into dangerous crowds at peak times when stoning later is permitted.',
   'Forgetting to count — bring a small bag with the stones pre-counted.'
 ]),

('hajj','Qurbani and Halq','hajj-qurbani',6,
 'Sacrificing an animal (hady) and shaving or shortening the hair on the 10th of Dhul Hijjah, marking the partial exit from Ihram.',
 '[
   {"order":1,"text":"After stoning Jamarat al-Aqaba on the 10th, arrange your sacrifice. For most pilgrims today, this is paid for in advance through an authorised agency or the IDB Adahi scheme."},
   {"order":2,"text":"The animal — typically a sheep, goat, or a 1/7 share of a cow or camel — is slaughtered on your behalf and the meat distributed."},
   {"order":3,"text":"Once you are confident the sacrifice has been carried out, proceed to halq (men shave the head) or taqsir (men or women shorten the hair). Halq is preferred for men."},
   {"order":4,"text":"With Rami, Qurbani, and Halq complete, you have made the first exit from Ihram (tahallul al-asghar). All restrictions are lifted except marital relations."},
   {"order":5,"text":"Make du''a of gratitude.","dua_arabic":"الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ","dua_transliteration":"Alhamdulillahi rabbil-''alamin","dua_translation":"All praise is to Allah, Lord of the worlds."}
 ]'::jsonb,
 ARRAY[
   'Cutting hair before confirming the sacrifice has been performed — order matters: Rami, then sacrifice, then halq.',
   'Assuming a single sheep covers a family — one sheep or goat is one person; a cow or camel covers seven.',
   'Forgetting that marital relations remain forbidden until after Tawaf al-Ifadah.'
 ]),

('hajj','Tawaf al-Ifadah and Sa''i','hajj-tawaf-ifadah',7,
 'Returning to Makkah on or after the 10th of Dhul Hijjah to perform Tawaf al-Ifadah (a pillar of Hajj) and Sa''i.',
 '[
   {"order":1,"text":"Travel from Mina to Makkah after halq. This may be done on the 10th, 11th, 12th, or 13th."},
   {"order":2,"text":"Perform Tawaf al-Ifadah — seven circuits of the Kaaba — exactly like Tawaf al-Umrah. There is no Ihram required for this Tawaf."},
   {"order":3,"text":"Pray two rak''ahs behind Maqam Ibrahim and drink Zamzam.","dua_arabic":"رَبَّنَا تَقَبَّلْ مِنَّا، إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ","dua_transliteration":"Rabbana taqabbal minna, innaka antas-Sami''ul-''Alim","dua_translation":"Our Lord, accept this from us. Indeed You are the All-Hearing, the All-Knowing."},
   {"order":4,"text":"Perform Sa''i between Safa and Marwah — seven circuits — if you have not already done so during a Tamattu Hajj."},
   {"order":5,"text":"After Tawaf al-Ifadah, the second exit from Ihram (tahallul al-akbar) is complete. All restrictions including marital relations are lifted."},
   {"order":6,"text":"Return to Mina before nightfall to spend the remaining nights of Tashriq."}
 ]'::jsonb,
 ARRAY[
   'Skipping Tawaf al-Ifadah — this is a pillar (rukn) of Hajj and cannot be made up by a sacrifice.',
   'Forgetting Sa''i if performing Tamattu or Qiran with a fresh Sa''i — check with your scholar or guide.',
   'Resuming marital relations before completing Tawaf al-Ifadah.'
 ]),

('hajj','Days of Tashriq in Mina','hajj-tashriq',8,
 'Spending the 11th, 12th, and optionally 13th of Dhul Hijjah back in Mina, completing the daily stoning of all three Jamarat.',
 '[
   {"order":1,"text":"Sleep in Mina each night of the 11th and 12th (and 13th if you choose to extend). Spending the major part of each night is required."},
   {"order":2,"text":"Each day after Dhuhr, stone the three Jamarat in order: Sughra (small), Wusta (middle), then Aqaba (large) — 7 stones at each."},
   {"order":3,"text":"Recite the takbir abundantly during these days — they are among the most blessed days of the year.","dua_arabic":"اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ","dua_transliteration":"Allahu Akbar, Allahu Akbar, la ilaha illallah, wallahu Akbar, Allahu Akbar, wa lillahil-hamd","dua_translation":"Allah is the Greatest, Allah is the Greatest, there is no god but Allah, and Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise."},
   {"order":4,"text":"On the 12th after stoning, you may leave Mina before Maghrib (Nafr al-Awwal) — or stay one more night and stone again on the 13th (Nafr ath-Thani, more virtuous)."},
   {"order":5,"text":"Use this time for du''a, family, gratitude, and Quran. The hardest physical work of Hajj is now behind you."}
 ]'::jsonb,
 ARRAY[
   'Leaving Mina on the 12th after Maghrib without intending to leave before sunset — once Maghrib enters, you must stay the night and stone on the 13th.',
   'Stoning before Dhuhr on the 11th, 12th, or 13th — stoning must be after midday.',
   'Forgetting to stone in the correct order: Sughra, then Wusta, then Aqaba.'
 ]),

('hajj','Tawaf al-Wada (Farewell Tawaf)','hajj-tawaf-wada',9,
 'The farewell circumambulation of the Kaaba performed as the very last act before leaving Makkah.',
 '[
   {"order":1,"text":"Once you are ready to leave Makkah, head to the Masjid al-Haram for Tawaf al-Wada. This must be the final act in Makkah — do nothing significant after it except minor errands."},
   {"order":2,"text":"Perform seven circuits of the Kaaba as in any Tawaf. There is no raml and no special clothing required."},
   {"order":3,"text":"Pray two rak''ahs behind Maqam Ibrahim and drink Zamzam."},
   {"order":4,"text":"Make a heartfelt farewell du''a, asking Allah to accept your Hajj and to bring you back.","dua_arabic":"اللَّهُمَّ لَا تَجْعَلْهُ آخِرَ الْعَهْدِ بِبَيْتِكَ الْحَرَامِ، وَتَقَبَّلْ مِنَّا حَجَّنَا","dua_transliteration":"Allahumma la taj''alhu akhiral-''ahdi bi-baytikal-haram, wa taqabbal minna hajjana","dua_translation":"O Allah, do not make this the last of my visits to Your Sacred House, and accept our Hajj from us."},
   {"order":5,"text":"Leave the mosque walking backward if easy, with your gaze on the Kaaba. Then proceed directly to your departure."},
   {"order":6,"text":"Menstruating women are exempt from Tawaf al-Wada and may travel without performing it."}
 ]'::jsonb,
 ARRAY[
   'Doing significant shopping or sightseeing after Tawaf al-Wada — it must be the last act before leaving.',
   'Forgetting that Tawaf al-Wada is wajib (obligatory) — missing it without excuse requires a sacrifice.',
   'Performing it too early — if your departure is delayed by days, you must repeat it just before leaving.'
 ]);