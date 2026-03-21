-- ============================================================
-- Pangaea Demo — Enhancement SQL
-- Adds: shifts, NCRs, adverts, Rex conversations, audit log
-- Trims operative count to 1,187 (less round)
-- ============================================================

DO $$
DECLARE
  v_org   UUID := '00000000-0000-0000-0000-000000000002';
  v_user1 UUID := 'f807307e-867b-4a09-bf48-e7176de995a2'; -- demo@demo.com
  v_user2 UUID := 'd396e90a-6301-4bdf-a1ab-49313eac122c'; -- sarah.okonkwo
  v_user3 UUID := 'd9afb128-4009-4d03-8063-c08dd8af7890'; -- james.whitfield

  -- Trades
  v_tr_labourer  UUID := 'e4f95533-97a1-4857-aa29-c6e9505ee6bd';
  v_tr_plant     UUID := '1fafc069-3b07-43be-b7b5-53f773d28da4';
  v_tr_carpenter UUID := '3df43d67-69c5-424e-98e0-032f8773f816';
  v_tr_bricklayer UUID := '1e68358a-48b5-4cd4-8558-fbcb42222eec';
  v_tr_steelfixer UUID := '2a4c80b3-09aa-476c-b8e4-396c4b5776e6';
  v_tr_supervisor UUID := '4dfa7446-5b88-4ba6-b982-0488803ace40';

  -- Sites (sample for NCRs/adverts)
  v_site1 UUID := '22222222-0000-0000-0000-000000000001';
  v_site2 UUID := '22222222-0000-0000-0000-000000000002';
  v_site3 UUID := '22222222-0000-0000-0000-000000000003';
  v_site4 UUID := '22222222-0000-0000-0000-000000000004';
  v_site5 UUID := '22222222-0000-0000-0000-000000000005';
  v_site6 UUID := '22222222-0000-0000-0000-000000000006';
  v_site7 UUID := '22222222-0000-0000-0000-000000000007';

  -- Labour request IDs (for adverts)
  v_lr1 UUID := 'aa600328-21a3-4d01-a1c6-0f7427f3d3e7';
  v_lr2 UUID := '1a3e4bd5-ed5b-4a4e-baa0-bbeac2b04251';
  v_lr3 UUID := '0d18c899-024f-42eb-a80e-9c2661cd4543';
  v_lr4 UUID := '53eabba3-3710-4cf9-9481-45f344c62a64';

  -- Cursor vars
  v_alloc_id   UUID;
  v_op_id      UUID;
  v_site_id    UUID;
  v_start_date DATE;
  v_end_date   DATE;
  v_shift_date DATE;
  v_shift_start TIMESTAMPTZ;
  v_shift_end   TIMESTAMPTZ;
  v_conv_id    UUID;
  v_ncr_num    INT := 1;
  v_at1 UUID; v_at2 UUID; v_at3 UUID; v_at4 UUID; v_at5 UUID; v_at6 UUID;

BEGIN

-- ── PHASE 1: Trim operative count to 1,187 ─────────────────────────────────
-- Delete 13 operatives that have no allocations AND no message threads
DELETE FROM public.operatives
WHERE id IN (
  SELECT o.id FROM public.operatives o
  LEFT JOIN public.allocations a ON a.operative_id = o.id
  LEFT JOIN public.message_threads mt ON mt.operative_id = o.id
  LEFT JOIN public.non_conformance_incidents ncr ON ncr.operative_id = o.id
  LEFT JOIN public.documents d ON d.operative_id = o.id
  WHERE o.organization_id = v_org AND a.id IS NULL AND mt.id IS NULL AND ncr.id IS NULL AND d.id IS NULL
  LIMIT 13
);
RAISE NOTICE 'Phase 1: Trimmed operatives to 1,187';


-- ── PHASE 2: Shifts ─────────────────────────────────────────────────────────
-- Create realistic shifts for active allocations
-- Each active operative gets 3-5 completed past shifts + 1-2 scheduled upcoming
FOR v_alloc_id, v_op_id, v_site_id, v_start_date, v_end_date IN
  SELECT a.id, a.operative_id, a.site_id, a.start_date::date, a.end_date::date
  FROM public.allocations a
  WHERE a.organization_id = v_org AND a.status = 'active'
  LIMIT 60
LOOP
  -- Create 4 completed past shifts (Mon-Fri pattern)
  FOR i IN 0..3 LOOP
    v_shift_date := CURRENT_DATE - (i * 7 + (i % 5));  -- stagger across weeks
    -- Skip if before allocation start
    CONTINUE WHEN v_shift_date < v_start_date;
    v_shift_start := (v_shift_date::text || ' 07:30:00')::timestamptz;
    v_shift_end   := (v_shift_date::text || ' 17:30:00')::timestamptz;

    INSERT INTO public.shifts (
      id, organization_id, operative_id, allocation_id, site_id,
      scheduled_start, scheduled_end, break_minutes,
      actual_start, actual_end, actual_break_minutes,
      clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
      wtd_overnight_flag, wtd_hours_flag, break_compliance_flag,
      status, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_org, v_op_id, v_alloc_id, v_site_id,
      v_shift_start, v_shift_end, 30,
      v_shift_start + interval '4 minutes' * (random() * 5)::int,  -- slight variation
      v_shift_end   + interval '2 minutes' * (random() * 10)::int,
      30,
      51.5 + (random() - 0.5) * 0.3, -1.9 + (random() - 0.5) * 0.3,
      51.5 + (random() - 0.5) * 0.3, -1.9 + (random() - 0.5) * 0.3,
      false, false, true,
      'completed',
      CASE WHEN random() < 0.1 THEN 'Slight delay at gate security' ELSE NULL END,
      v_shift_start, v_shift_end
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Create 1-2 upcoming scheduled shifts
  FOR i IN 1..2 LOOP
    v_shift_date := CURRENT_DATE + i;
    -- Skip weekends
    CONTINUE WHEN EXTRACT(DOW FROM v_shift_date) IN (0, 6);
    CONTINUE WHEN v_shift_date > v_end_date;
    v_shift_start := (v_shift_date::text || ' 07:30:00')::timestamptz;
    v_shift_end   := (v_shift_date::text || ' 17:30:00')::timestamptz;

    INSERT INTO public.shifts (
      id, organization_id, operative_id, allocation_id, site_id,
      scheduled_start, scheduled_end, break_minutes,
      actual_start, actual_end, actual_break_minutes,
      status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_org, v_op_id, v_alloc_id, v_site_id,
      v_shift_start, v_shift_end, 30,
      NULL, NULL, NULL,
      'published',
      NOW() - interval '2 days', NOW() - interval '2 days'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END LOOP;
RAISE NOTICE 'Phase 2: Shifts created';


-- ── PHASE 3: NCRs ───────────────────────────────────────────────────────────
-- 30 realistic NCRs linked to operatives on active/completed allocations
INSERT INTO public.non_conformance_incidents (
  id, organization_id, reference_number, operative_id, allocation_id, site_id,
  incident_type, severity, incident_date, incident_time, description,
  witness_name, reported_by, reporter_name, reported_via,
  auto_blocked, resolved, resolved_by, resolved_at, resolution_notes,
  created_at
)
SELECT
  gen_random_uuid(), v_org,
  'P43-NCR-' || LPAD(row_number() OVER ()::text, 4, '0'),
  a.operative_id, a.id, a.site_id,
  t.itype::ncr_type, t.sev::ncr_severity,
  (CURRENT_DATE - t.days_ago)::date,
  t.itime,
  t.descr,
  t.witness,
  CASE WHEN t.rep = 1 THEN v_user1 WHEN t.rep = 2 THEN v_user2 ELSE v_user3 END,
  t.reporter_name,
  t.via,
  t.blocked,
  t.resolved,
  CASE WHEN t.resolved THEN v_user2 ELSE NULL END,
  CASE WHEN t.resolved THEN NOW() - interval '1 day' * t.days_ago / 2 ELSE NULL END,
  t.res_notes,
  NOW() - interval '1 day' * t.days_ago
FROM (
  SELECT a.*, row_number() OVER () as rn
  FROM public.allocations a
  WHERE a.organization_id = v_org AND a.status IN ('active','completed')
  ORDER BY random()
  LIMIT 30
) a
JOIN (VALUES
  ('no_show',         'minor', 14, '07:30', 'Operative failed to attend shift without prior notice. Site manager contacted at 08:15 after no-show.', 'Mike Hartley (SM)', 2, 'Sarah Okonkwo', 'whatsapp', false, true,  'Operative contacted — family emergency. Return agreed for following Monday. Verbal warning issued.', 6),
  ('late_arrival',    'minor',  9, '07:45', 'Operative arrived 45 minutes late. No prior notification given to site manager.', 'Dave Collins (SM)', 2, 'Sarah Okonkwo', 'whatsapp', false, true,  'Spoke with operative. Train delays confirmed via Trainline screenshot. No further action taken.', 4),
  ('safety_breach',   'major',  7, '10:20', 'Operative observed working at height without PPE — hard hat removed during steel fixing operation on Level 3.', 'Tom Ashworth (SM)', 1, 'Demo Admin', 'web', true,  false, NULL, 3),
  ('conduct_issue',   'minor', 21, '13:40', 'Dispute with fellow operative on site. Raised voices reported by site manager. No physical altercation.', 'Lisa Park (SM)', 3, 'James Whitfield', 'web', false, true,  'Both operatives spoken to separately. Mediation session conducted. Both agreed to professional conduct going forward.', 7),
  ('poor_workmanship','major', 11, '15:00', 'Brickwork on east elevation found to be out of plumb by 12mm over 2m run. Section required demolition and rebuild.', 'Ray Donoghue (SM)', 2, 'Sarah Okonkwo', 'web', false, true,  'Section rebuilt to specification. Quality check passed by engineer on 2026-03-18. Cost of remediation deducted from invoice.', 1),
  ('drugs_alcohol',   'critical', 3, '08:05', 'Operative displayed signs of impairment at site induction — slurred speech, unsteady gait. Breathalyser result: 0.12mg/L.', 'Phil Gregson (SM)', 1, 'Demo Admin', 'web', true,  false, NULL, 1),
  ('walk_off',        'major',  5, '14:30', 'Operative left site mid-shift without informing site manager or Pillar 43 office. Tools abandoned at workstation.', 'Gina Chambers (SM)', 2, 'Sarah Okonkwo', 'whatsapp', false, false, NULL, 2),
  ('no_show',         'minor', 18, '07:30', 'Second no-show in 3 weeks. Previous NCR issued 2026-03-03. Pattern of unreliability noted.', 'Karl Webb (SM)', 2, 'Sarah Okonkwo', 'whatsapp', false, false, NULL, 6),
  ('poor_attitude',   'minor', 12, '11:15', 'Repeated refusal to follow site manager instructions regarding welfare facilities protocol. Four separate incidents logged by SM.', 'Alan Briggs (SM)', 3, 'James Whitfield', 'web', false, true,  'One-to-one conducted. Clear expectations set. Operative acknowledged. Monitoring ongoing.', 5),
  ('safety_breach',   'critical', 2, '09:30', 'Operative caught using mobile phone whilst operating telehandler. Immediate suspension from site pending investigation.', 'Nick Fallon (SM)', 1, 'Demo Admin', 'web', true,  false, NULL, 1),
  ('late_arrival',    'minor', 30, '08:10', 'Arrived 40 minutes late. Third late arrival this month. Pattern noted and escalated to labour manager.', 'Wendy Ho (SM)', 2, 'Sarah Okonkwo', 'whatsapp', false, true,  'Final warning issued in writing. Next occurrence will result in removal from site.', 4),
  ('conduct_issue',   'major', 16, '16:45', 'Verbal abuse directed at an apprentice after a minor error during timber framing. Witnessed by two other operatives.', 'Steve Nunez (SM)', 1, 'Demo Admin', 'web', false, true,  'Formal written warning issued. Operative removed from shared workspace with apprentice for 2 weeks.', 7),
  ('poor_workmanship','minor', 25, '11:00', 'Concrete pour on ground slab recorded outside specified slump range. Sample taken by QA team.', 'Brian Lowe (SM)', 2, 'Sarah Okonkwo', 'web', false, true,  'Core samples tested — structural integrity confirmed. Remedial surface treatment applied. Signed off by engineer.', 3),
  ('no_show',         'minor', 8,  '07:30', 'Failed to attend without notification. Unable to reach operative by phone or WhatsApp.', 'Carl Hobbs (SM)', 3, 'James Whitfield', 'whatsapp', false, true,  'Operative reported illness. Medical certificate provided covering 3 days.', 6),
  ('safety_breach',   'major', 20, '14:00', 'Excavation work commenced without banksman present. Unacceptable risk created — site manager issued immediate stop notice.', 'Debbie Fynn (SM)', 1, 'Demo Admin', 'web', true,  true,  'Banksman requirement briefed to all plant operators. RAMS updated. Operative issued formal warning.', 2)
) AS t(itype, sev, days_ago, itime, descr, witness, rep, reporter_name, via, blocked, resolved, res_notes, lr_ref)
ON TRUE
LIMIT 30;

RAISE NOTICE 'Phase 3: NCRs inserted';


-- ── PHASE 4: Advert Templates ───────────────────────────────────────────────
INSERT INTO public.advert_templates (
  id, organization_id, name, platform, trade_category_id,
  headline, body_copy, call_to_action,
  target_locations, salary_range_min, salary_range_max,
  is_active, created_by, created_at, updated_at
) VALUES
  (gen_random_uuid(), v_org, 'General Labourer — LinkedIn', 'linkedin', v_tr_labourer,
   'General Labourers Wanted — Immediate Starts | Pillar 43 Construction',
   E'Pillar 43 Construction is seeking experienced General Labourers for ongoing work across our active sites in the Midlands and North West.\n\nWhat we offer:\n• Competitive day rates (£120–£145/day PAYE or CIS)\n• Long-term bookings — 6-month+ programmes\n• PPE provided on site\n• Dedicated labour manager support\n• Weekly pay\n\nRequirements:\n• Valid CSCS Green Card (minimum)\n• Right to work in the UK\n• Strong site safety awareness\n• Reliable and punctual\n\nMultiple positions available across Birmingham, Manchester, and Leeds. Immediate starts for the right candidates.',
   'Apply Now', ARRAY['Birmingham','Manchester','Leeds','Sheffield'], 120, 145,
   true, v_user2, NOW() - interval '45 days', NOW() - interval '10 days'),

  (gen_random_uuid(), v_org, 'Bricklayer — Indeed', 'indeed', v_tr_bricklayer,
   'Experienced Bricklayers — Long-Term Contracts | £160–£185/day',
   E'Pillar 43 Construction urgently requires skilled Bricklayers for large-scale residential and commercial projects across our site portfolio.\n\nThe roles:\n• Residential housing blocks (200+ unit schemes)\n• Commercial façade brickwork\n• Mixed-use development programmes\n• Typical bookings: 4–9 months\n\nWhat you need:\n• CSCS Blue Card (skilled worker minimum)\n• NVQ Level 2 in Bricklaying or equivalent\n• Minimum 3 years commercial site experience\n• Own tools preferred\n• Valid CITB SMSTS or SSSTS desirable\n\nPay: £160–£185 per day (experience dependent) | CIS or PAYE available | Weekly payment\n\nContact our labour team today for an immediate start.',
   'Apply Today', ARRAY['Birmingham','Coventry','Derby','Nottingham'], 160, 185,
   true, v_user2, NOW() - interval '30 days', NOW() - interval '5 days'),

  (gen_random_uuid(), v_org, 'Steel Fixer — Indeed', 'indeed', v_tr_steelfixer,
   'Steel Fixers Required — HS2 & Major Infrastructure | Immediate Start',
   E'Pillar 43 Construction is recruiting Steel Fixers for a high-profile HS2 enabling works contract and several concurrent infrastructure programmes.\n\nAbout the role:\n• Reinforced concrete structures\n• Underground and above-ground works\n• 50+ hour weeks available (overtime paid)\n• Site-based, 5 days per week minimum\n\nYou must have:\n• CSCS Gold or Blue Card\n• Experience with BS8666 scheduling and fixing\n• Safe use of bar bending/cutting equipment\n• Ability to read structural drawings\n\nRate: £170–£200/day DOE | Accommodation allowance for non-local candidates\n\nThis is a 9-month programme with strong potential for extension.',
   'Apply Now', ARRAY['Birmingham','Solihull','Coventry'], 170, 200,
   true, v_user2, NOW() - interval '20 days', NOW() - interval '3 days'),

  (gen_random_uuid(), v_org, 'Plant Operator — Facebook', 'facebook', v_tr_plant,
   '🔧 Plant Operators — Join Pillar 43 Construction | Great Rates!',
   E'Are you an experienced Plant Operator looking for consistent, long-term work?\n\nPillar 43 Construction has immediate openings for:\n✅ 360 Excavator Operators\n✅ Telehandler Operators\n✅ Dumper Drivers (10t+)\n✅ Piling Rig Operators\n\n💷 Day rates from £155 to £210 depending on plant type and experience\n📍 Sites across the Midlands — travel/accommodation support available\n📅 Long bookings — most positions 6+ months\n\n📋 Requirements:\n• Valid CPCS or NPORS card\n• Clean driving licence\n• CSCS card\n• Minimum 2 years\' commercial experience\n\nSend us a message or hit Apply — our team responds within 24 hours.',
   'Message Us', ARRAY['Midlands','West Midlands','East Midlands'], 155, 210,
   true, v_user2, NOW() - interval '15 days', NOW() - interval '2 days'),

  (gen_random_uuid(), v_org, 'Carpenter — LinkedIn', 'linkedin', v_tr_carpenter,
   'Skilled Carpenters — First Fix & Second Fix | Pillar 43 Construction',
   E'We are seeking experienced Carpenters with a strong residential and commercial background for multiple active sites across our Midlands and Yorkshire portfolio.\n\nPositions available:\n• First fix framing and studwork\n• Second fix joinery and fit-out\n• Formwork and shuttering\n• Mixed-use development schemes\n\nMinimum requirements:\n• CSCS Blue Card (Skilled Worker)\n• NVQ Level 2 Carpentry & Joinery or City & Guilds equivalent\n• 3+ years commercial site experience\n• Own tools\n\nWhy Pillar 43?\n• Competitive rates: £150–£175/day\n• Structured programmes with clear end dates\n• Professional, well-managed sites\n• Labour manager always available\n• Rapid onboarding — start within 48 hours of offer',
   'Connect & Apply', ARRAY['Leeds','Sheffield','Derby','Nottingham','Leicester'], 150, 175,
   true, v_user2, NOW() - interval '22 days', NOW() - interval '7 days'),

  (gen_random_uuid(), v_org, 'Supervisor — LinkedIn', 'linkedin', v_tr_supervisor,
   'Working Supervisors — Large-Scale Construction | P43 Pillar 43',
   E'Pillar 43 Construction is expanding its supervisory workforce to support a growing portfolio of Tier 1 sub-contract packages.\n\nWe need Working Supervisors who can:\n• Lead gangs of 6–20 operatives on site\n• Conduct toolbox talks and safety briefings\n• Monitor quality, productivity and attendance\n• Liaise directly with site management\n• Complete daily reports and allocation sheets\n\nProfile:\n• CSCS Gold or Black Card\n• SMSTS or SSSTS certified\n• Trade background (Bricklaying, Carpentry, Groundworks, or Civils)\n• Minimum 5 years supervisory experience\n• Strong communication skills — English essential\n\nPackage: £200–£230/day | Company vehicle or mileage allowance | Long programmes (9–18 months)',
   'Apply Now', ARRAY['National','Birmingham','Manchester','London'], 200, 230,
   true, v_user1, NOW() - interval '35 days', NOW() - interval '12 days')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Phase 4: Advert templates created';


-- ── PHASE 5: Adverts (live campaigns) ──────────────────────────────────────
WITH tpls AS (
  SELECT id, platform, trade_category_id FROM public.advert_templates WHERE organization_id = v_org
)
INSERT INTO public.adverts (
  id, organization_id, template_id, labour_request_id, platform,
  external_id, external_url, status, budget, spend_to_date,
  impressions, clicks, applications,
  started_at, ended_at, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), v_org, t.id,
  CASE rn WHEN 1 THEN v_lr1 WHEN 2 THEN v_lr2 WHEN 3 THEN v_lr3 ELSE v_lr4 END,
  t.platform,
  'P43-' || upper(t.platform::text) || '-' || LPAD(rn::text, 4, '0'),
  CASE t.platform
    WHEN 'linkedin' THEN 'https://www.linkedin.com/jobs/view/' || (1000000 + rn * 137)::text
    WHEN 'indeed'   THEN 'https://uk.indeed.com/viewjob?jk=' || md5(rn::text)
    WHEN 'facebook' THEN 'https://www.facebook.com/ads/manager/account/' || (2000000 + rn * 91)::text
    ELSE 'https://example.com/jobs/' || rn
  END,
  CASE WHEN rn <= 4 THEN 'active' WHEN rn = 5 THEN 'paused' ELSE 'ended' END::advert_status,
  CASE t.platform
    WHEN 'linkedin' THEN 1500.00
    WHEN 'indeed'   THEN 800.00
    WHEN 'facebook' THEN 600.00
    ELSE 400.00
  END,
  CASE WHEN rn <= 4 THEN
    ROUND((CASE t.platform WHEN 'linkedin' THEN 1500 WHEN 'indeed' THEN 800 WHEN 'facebook' THEN 600 ELSE 400 END * (0.3 + random() * 0.5))::numeric, 2)
  ELSE
    ROUND((CASE t.platform WHEN 'linkedin' THEN 1500 WHEN 'indeed' THEN 800 WHEN 'facebook' THEN 600 ELSE 400 END * 0.95)::numeric, 2)
  END,
  (8000 + rn * 2341 + (random() * 5000)::int)::int,
  (180 + rn * 47 + (random() * 200)::int)::int,
  (12 + rn * 7 + (random() * 30)::int)::int,
  NOW() - interval '1 day' * (rn * 5 + 10),
  CASE WHEN rn >= 5 THEN NOW() - interval '2 days' ELSE NULL END,
  CASE WHEN rn % 3 = 0 THEN v_user1 ELSE v_user2 END,
  NOW() - interval '1 day' * (rn * 5 + 10),
  NOW() - interval '1 day' * rn
FROM tpls t
CROSS JOIN LATERAL (SELECT row_number() OVER () as rn FROM public.advert_templates WHERE organization_id = v_org LIMIT 1) sub
LIMIT 8
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Phase 5: Adverts created';


-- ── PHASE 6: Audit Log ──────────────────────────────────────────────────────
-- Realistic audit trail: operative creates/edits, alloc changes, compliance updates, settings

-- Operative records created (batch of new operatives added)
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org, v_user2, 'CREATE', 'operatives', op.id,
  NULL,
  jsonb_build_object('reference_number', op.reference_number, 'first_name', op.first_name, 'last_name', op.last_name, 'status', op.status::text),
  '87.115.' || (32 + (random()*50)::int)::text || '.' || (1 + (random()*200)::int)::text,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0.0.0',
  NOW() - interval '1 hour' * (row_number() OVER () * 3 + 20),
  'labour_manager'
FROM public.operatives op WHERE op.organization_id = v_org ORDER BY op.created_at DESC LIMIT 40;

-- Status changes on operatives (verified → available, available → working, etc.)
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org,
  CASE WHEN row_number() OVER () % 3 = 0 THEN v_user1 ELSE v_user2 END,
  'UPDATE', 'operatives', op.id,
  jsonb_build_object('status', 'pending_docs'),
  jsonb_build_object('status', op.status::text),
  '87.115.61.' || (10 + (random()*100)::int)::text,
  'Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/122.0.0.0',
  NOW() - interval '1 hour' * (row_number() OVER () * 2 + 5),
  CASE WHEN row_number() OVER () % 3 = 0 THEN 'director' ELSE 'labour_manager' END
FROM public.operatives op WHERE op.organization_id = v_org AND op.status IN ('verified','available','working') ORDER BY random() LIMIT 30;

-- Allocation created events
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org, v_user2, 'CREATE', 'allocations', al.id,
  NULL,
  jsonb_build_object('status', al.status::text, 'start_date', al.start_date::text, 'end_date', al.end_date::text),
  '87.115.61.44',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
  NOW() - interval '1 hour' * (row_number() OVER () * 4 + 48),
  'labour_manager'
FROM public.allocations al WHERE al.organization_id = v_org ORDER BY al.created_at DESC LIMIT 25;

-- Allocation status updates (pending → confirmed → active)
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org, v_user2, 'UPDATE', 'allocations', al.id,
  jsonb_build_object('status', 'pending'),
  jsonb_build_object('status', 'confirmed'),
  '87.115.61.44',
  'Mozilla/5.0 (Macintosh) Chrome/122',
  NOW() - interval '1 hour' * (row_number() OVER () * 3 + 36),
  'labour_manager'
FROM public.allocations al WHERE al.organization_id = v_org AND al.status IN ('confirmed','active','completed') ORDER BY random() LIMIT 20;

-- Document compliance updates
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org, v_user3, 'UPDATE', 'documents', d.id,
  jsonb_build_object('verified', false),
  jsonb_build_object('verified', true, 'verified_by', v_user3::text),
  '192.168.1.' || (10 + (random()*50)::int)::text,
  'Mozilla/5.0 (Windows NT 10.0) Chrome/122.0.0.0',
  NOW() - interval '1 hour' * (row_number() OVER () * 2 + 12),
  'admin'
FROM public.documents d WHERE d.organization_id = v_org ORDER BY random() LIMIT 25;

-- NCR created events
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org,
  CASE WHEN row_number() OVER () % 2 = 0 THEN v_user2 ELSE v_user1 END,
  'CREATE', 'non_conformance_incidents', n.id,
  NULL,
  jsonb_build_object('severity', n.severity::text, 'incident_type', n.incident_type::text, 'auto_blocked', n.auto_blocked),
  '87.115.61.44',
  'Mozilla/5.0 Chrome/122',
  n.created_at,
  CASE WHEN row_number() OVER () % 2 = 0 THEN 'labour_manager' ELSE 'director' END
FROM public.non_conformance_incidents n WHERE n.organization_id = v_org;

-- Settings / organisation updates by admin
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
) VALUES
  (gen_random_uuid(), v_org, v_user1, 'UPDATE', 'organizations', v_org,
   '{"settings":{"assistant_name":"Rex","intake_bot_name":"Amber"}}',
   '{"settings":{"assistant_name":"Rex","intake_bot_name":"Amber","company_name":"Pillar 43 Construction","reference_prefix":"P43"}}',
   '87.115.61.44', 'Mozilla/5.0 Chrome/122', NOW() - interval '60 days', 'director'),
  (gen_random_uuid(), v_org, v_user1, 'UPDATE', 'organizations', v_org,
   '{"name":"Pillar 43"}',
   '{"name":"Pillar 43 Construction"}',
   '87.115.61.44', 'Mozilla/5.0 Chrome/122', NOW() - interval '58 days', 'director'),
  (gen_random_uuid(), v_org, v_user3, 'CREATE', 'users', v_user3,
   NULL,
   '{"email":"james.whitfield@pillar43.co.uk","role":"admin"}',
   '87.115.61.44', 'Mozilla/5.0 Chrome/122', NOW() - interval '55 days', 'director'),
  (gen_random_uuid(), v_org, v_user2, 'CREATE', 'users', v_user2,
   NULL,
   '{"email":"sarah.okonkwo@pillar43.co.uk","role":"labour_manager"}',
   '87.115.61.44', 'Mozilla/5.0 Chrome/122', NOW() - interval '57 days', 'director'),
  (gen_random_uuid(), v_org, v_user1, 'UPDATE', 'organizations', v_org,
   '{"settings":{"whatsapp_enabled":false}}',
   '{"settings":{"whatsapp_enabled":true}}',
   '87.115.61.44', 'Mozilla/5.0 Chrome/122', NOW() - interval '40 days', 'director');

-- Timesheet approvals
INSERT INTO public.audit_log (
  id, organization_id, user_id, action, table_name, record_id,
  old_values, new_values, ip_address, user_agent, created_at, changed_by_role
)
SELECT
  gen_random_uuid(), v_org, v_user3, 'UPDATE', 'timesheets', ts.id,
  jsonb_build_object('status', 'submitted'),
  jsonb_build_object('status', ts.status::text, 'approved_by', v_user3::text),
  '192.168.1.15',
  'Mozilla/5.0 Chrome/122',
  NOW() - interval '1 hour' * (row_number() OVER () + 10),
  'admin'
FROM public.timesheets ts WHERE ts.organization_id = v_org AND ts.status IN ('approved','locked') ORDER BY random() LIMIT 20;

RAISE NOTICE 'Phase 6: Audit log created';


-- ── PHASE 7: Rex / Assistant Conversations ──────────────────────────────────
-- 8 realistic conversations that Demo Admin has had with Rex

-- Conversation 1: Compliance overview
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Compliance overview — this week', NOW() - interval '3 days', NOW() - interval '3 days')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'Give me a compliance overview for this week', NOW() - interval '3 days' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'Here''s your compliance snapshot for the week of 17 March 2026:\n\n**Documents**\n- 5,034 documents on record across 1,187 operatives\n- 94 operatives have at least one expiring document in the next 30 days\n- 12 operatives currently flagged with compliance alerts\n\n**CSCS**\n- 847 valid CSCS cards on file\n- 23 cards expiring within 60 days — renewal reminders sent via WhatsApp\n- 15 operatives have no CSCS card recorded\n\n**Right to Work**\n- All 1,187 operatives have RTW verified\n- 8 share codes require re-check (6-month cycle due)\n\n**Action recommended:** Review the 12 compliance-flagged operatives before Friday — 3 are currently active on site.\n\nWould you like me to pull up the list?', NOW() - interval '3 days' + interval '2 minutes');

-- Conversation 2: Site productivity
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Site productivity — Birmingham sites', NOW() - interval '6 days', NOW() - interval '6 days')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'How are the Birmingham sites performing this month?', NOW() - interval '6 days' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'Here''s a summary for your 4 active Birmingham sites in March 2026:\n\n**Birmingham Curzon Gateway — HS2 Enabling**\n- 34 operatives currently allocated\n- Attendance rate: 96.2% (excellent)\n- 2 no-shows logged (NCRs raised)\n- 0 compliance flags\n\n**Birmingham Business Quarter Phase 3**\n- 28 operatives allocated\n- Attendance: 94.1%\n- 1 safety breach NCR — operative auto-blocked\n- Headcount: 2 short vs request (chase labour request LR-0041)\n\n**Birmingham Eastside Metro Extension**\n- 19 operatives (civils-heavy)\n- Attendance: 97.8%\n- Strong performance — no NCRs this month\n\n**Birmingham Jewellery Quarter Regen**\n- 22 operatives\n- Attendance: 91.3% — lowest this month\n- 3 late arrivals, 1 walk-off (in progress)\n\nOverall Birmingham headcount: 103 operatives. Would you like me to drill into any of these sites?', NOW() - interval '6 days' + interval '2 minutes'),
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'Tell me more about the Jewellery Quarter situation', NOW() - interval '6 days' + interval '5 minutes'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'**Birmingham Jewellery Quarter Regen — Detail View**\n\nThe attendance dip at JQ is driven by 3 operatives:\n\n1. **Marcus Osei (P43-0847)** — 3 late arrivals in 14 days, last one 40 mins late. NCR raised by SM Dave Collins on 15 March. Spoken to — rail disruption cited on two occasions, personal reasons on third. Final warning issued by Sarah Okonkwo.\n\n2. **Tomasz Wolski (P43-1103)** — Walk-off on 17 March at 14:30. Left mid-shift without notification. Currently unreachable. Amber sent WhatsApp check-in — no response in 18 hours. Recommend: escalate or replace on this allocation.\n\n3. **Ade Bankole (P43-0392)** — 2 no-shows. Second NCR this month. Auto-block threshold reached — system flagged for your review. Allocation status: at risk.\n\nSite manager Gina Chambers has requested 2 replacement labourers for next week.\n\n**Recommended actions:**\n- Replace Tomasz Wolski on JQ allocation\n- Review Ade Bankole auto-block (confirm or override)\n- Approve 2 new labourer allocations for JQ from available pool\n\nShall I find available labourers near Birmingham for a Monday start?', NOW() - interval '6 days' + interval '6 minutes');

-- Conversation 3: Available operatives search
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Find available steel fixers — Leeds', NOW() - interval '1 day', NOW() - interval '1 day')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'I need 4 steel fixers available to start in Leeds next Monday', NOW() - interval '1 day' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'Found **9 verified Steel Fixers** with available status who have worked in or near Leeds in the past 6 months. Top 4 by RAP score:\n\n1. **Bogdan Petrescu (P43-0211)** ★★★★★ RAP 92 | CSCS Gold | NVQ L3 | Last worked: Leeds Dock Residential, Feb 2026 | Day rate: £185\n\n2. **Shane McAllister (P43-0455)** ★★★★☆ RAP 84 | CSCS Blue | 8 years exp | Last worked: Bradford College Extension, Jan 2026 | Day rate: £175\n\n3. **Piotr Nowaczyk (P43-0678)** ★★★★☆ RAP 81 | CSCS Blue | Polish-English bilingual | Last worked: Wakefield Westgate Q, Dec 2025 | Day rate: £172\n\n4. **Darius Moldovan (P43-0891)** ★★★★☆ RAP 79 | CSCS Blue | Formwork specialist | Available immediately | Day rate: £170\n\nAll 4 have valid RTW, up-to-date documents, and no active compliance flags.\n\nWould you like me to prepare allocation offers for all 4 and send confirmation messages via WhatsApp?', NOW() - interval '1 day' + interval '2 minutes'),
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'Yes send them offers for the Leeds Aire Valley scheme, Monday start', NOW() - interval '1 day' + interval '4 minutes'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'Done. Allocation offers sent to all 4 operatives via WhatsApp:\n\n- Bogdan Petrescu — ✅ Delivered\n- Shane McAllister — ✅ Delivered\n- Piotr Nowaczyk — ✅ Delivered\n- Darius Moldovan — ✅ Delivered\n\nOffer window: 30 minutes. I''ll notify you as responses come in. If fewer than 4 accept, I can automatically cascade to the next available operatives on the list.\n\nAllocation details sent:\n📍 Site: Leeds Aire Valley Regeneration\n📅 Start: Monday 24 March 2026\n💷 Day rate: per operative profile\n🕗 Start time: 07:30', NOW() - interval '1 day' + interval '4 minutes' + interval '30 seconds');

-- Conversation 4: NCR review
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Outstanding NCRs — critical and major', NOW() - interval '2 days', NOW() - interval '2 days')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'Show me all open critical and major NCRs', NOW() - interval '2 days' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'**Open NCRs — Critical & Major** (as of today)\n\n🔴 **CRITICAL — 2 open**\n\n1. **P43-NCR-0006** | Drugs & Alcohol | Coventry City Centre North\n   Operative breathalysed at 0.12mg/L on entry. Auto-blocked. Investigation underway. No resolution yet.\n   Reported: 18 March | Reporter: Demo Admin\n\n2. **P43-NCR-0010** | Safety Breach | Wolverhampton Civic Waterfront\n   Operative using mobile phone whilst operating telehandler. Immediate suspension from site.\n   Reported: 19 March | Reporter: Demo Admin\n\n🟠 **MAJOR — 3 open**\n\n3. **P43-NCR-0003** | Safety Breach | HS2 Enabling Works\n   Working at height without PPE — auto-blocked. Safety re-briefing required before return.\n   Reported: 14 March | Reporter: Demo Admin\n\n4. **P43-NCR-0007** | Walk-Off | Birmingham Business Quarter\n   Operative left site mid-shift. Still unreachable after 5 days. Allocation at risk.\n   Reported: 16 March | Reporter: Sarah Okonkwo\n\n5. **P43-NCR-0008** | Repeat No-Show | Derby Becketwell Live\n   Second NCR this month. Auto-block threshold reached. Awaiting director review.\n   Reported: 13 March | Reporter: Sarah Okonkwo\n\n**Recommended next step:** Confirm or override the 3 auto-blocks. I can send formal warning messages to operatives 7 and 8 via WhatsApp if you''d like.', NOW() - interval '2 days' + interval '2 minutes');

-- Conversation 5: Timesheet query
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Timesheets pending approval — this week', NOW() - interval '4 hours', NOW() - interval '4 hours')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'How many timesheets are waiting for approval?', NOW() - interval '4 hours' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'**Timesheets Pending Approval**\n\nCurrently **47 timesheets** are in ''submitted'' status awaiting review:\n\n- Week ending 14 March: 12 timesheets (overdue — 7 days)\n- Week ending 21 March: 35 timesheets (current cycle)\n\n**Breakdown by site:**\n- Birmingham Curzon Gateway: 9\n- Coventry City Centre North: 8\n- Leeds Aire Valley: 7\n- Derby Becketwell: 6\n- Manchester NOMA: 6\n- Other sites: 11\n\n**Flagged for review:**\n- 3 timesheets show >50 hours in a single week (WTD review recommended)\n- 2 timesheets have mismatched shift records (hours logged don''t match clock-in data)\n\nJames Whitfield (Admin) has already approved 18 timesheets today.\n\nWould you like me to open the approval queue?', NOW() - interval '4 hours' + interval '2 minutes');

-- Conversation 6: Report request
WITH conv AS (
  INSERT INTO public.assistant_conversations (id, organization_id, user_id, title, created_at, updated_at)
  VALUES (gen_random_uuid(), v_org, v_user1, 'Monthly headcount report — February', NOW() - interval '15 days', NOW() - interval '15 days')
  RETURNING id
)
INSERT INTO public.assistant_messages (id, conversation_id, role, content, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conv), 'user', 'Generate the monthly headcount report for February', NOW() - interval '15 days' + interval '1 minute'),
  (gen_random_uuid(), (SELECT id FROM conv), 'assistant', E'**Pillar 43 Construction — Monthly Headcount Report**\n**Period: February 2026**\n\n---\n\n**Overall**\n- Total workforce: 1,187 registered operatives\n- Active (on site at some point in Feb): 412\n- Working (allocated as at 28 Feb): 287\n- Available (verified, no active allocation): 189\n- Unavailable / blocked: 34\n\n**New starters in February:** 67\n**Leavers in February:** 23\n**Net growth:** +44\n\n**By trade:**\n| Trade | Active | Available |\n|---|---|---|\n| General Labourer | 148 | 71 |\n| Bricklayer | 54 | 28 |\n| Carpenter | 41 | 22 |\n| Steel Fixer | 38 | 19 |\n| Plant Operator | 47 | 24 |\n| Supervisor | 29 | 14 |\n| Other trades | 55 | 11 |\n\n**Compliance**\n- Fully compliant: 1,093 (92.1%)\n- Compliance alerts: 94 (7.9%)\n- Auto-blocked: 12\n\n**Top performing sites (attendance)**\n1. Birmingham Eastside Metro — 97.8%\n2. Leeds Aire Valley — 96.9%\n3. Manchester NOMA Phase 2 — 96.1%\n\nReport generated at ' || TO_CHAR(NOW() - interval '15 days', 'HH24:MI on DD Mon YYYY') || '. Would you like this exported to PDF?', NOW() - interval '15 days' + interval '3 minutes');

RAISE NOTICE 'Phase 7: Rex conversations created';


-- ── PHASE 8: Tidy up — make operative count less round ──────────────────────
-- Already done in Phase 1 (deleted 13, so 1200 → 1187)
-- But let's also slightly vary the active allocation statuses to be less round
UPDATE public.allocations
SET status = 'terminated'
WHERE id IN (
  SELECT id FROM public.allocations
  WHERE organization_id = v_org AND status = 'completed'
  ORDER BY random()
  LIMIT 17
);

UPDATE public.allocations
SET status = 'no_show'
WHERE id IN (
  SELECT id FROM public.allocations
  WHERE organization_id = v_org AND status = 'pending'
  ORDER BY random()
  LIMIT 7
);

RAISE NOTICE 'Phase 8: Allocation statuses varied';

-- ── PHASE 9: Replace generic notifications with detailed ones ──────────────
-- Delete existing bland notifications and replace with operative-linked ones
DELETE FROM public.notifications WHERE organization_id = v_org;

-- Insert 60 detailed, operative-linked notifications
INSERT INTO public.notifications (
  id, organization_id, type, title, body, severity,
  operative_id, labour_request_id, ncr_id,
  read, created_at, link_url, read_at
)
SELECT
  gen_random_uuid(), v_org,
  n.ntype, n.ntitle, n.nbody, n.nsev,
  o.id,
  CASE WHEN n.ntype IN ('labour_request_open','labour_request_filled') THEN v_lr1 ELSE NULL END,
  CASE WHEN n.ntype IN ('ncr_raised','ncr_auto_block','ncr_resolved') THEN
    (SELECT id FROM public.non_conformance_incidents WHERE organization_id = v_org ORDER BY random() LIMIT 1)
  ELSE NULL END,
  n.is_read,
  NOW() - n.age,
  n.lurl,
  CASE WHEN n.is_read THEN NOW() - n.age + interval '30 minutes' ELSE NULL END
FROM (VALUES
  -- Timesheets
  ('timesheet_submitted', 'Timesheet submitted — Marcus Osei (P43-0847)', 'Marcus Osei (P43-0847) has submitted their timesheet for w/e 21 Mar 2026. 43.5 hours logged across 5 shifts at Birmingham Jewellery Quarter.', 'info', false, interval '2 hours', '/timesheets'),
  ('timesheet_submitted', 'Timesheet submitted — Bogdan Petrescu (P43-0211)', 'Bogdan Petrescu (P43-0211) submitted their timesheet for w/e 21 Mar 2026. 47 hours — note: above 45h WTD threshold. Please review before approval.', 'warning', false, interval '4 hours', '/timesheets'),
  ('timesheet_submitted', 'Timesheet submitted — Tomasz Wolski (P43-1103)', 'Tomasz Wolski (P43-1103) submitted their timesheet for w/e 14 Mar 2026. 40 hours at Coventry City Centre North.', 'info', true, interval '8 days', '/timesheets'),
  ('timesheet_approved', 'Timesheet approved — Shane McAllister (P43-0455)', 'James Whitfield approved the timesheet for Shane McAllister (P43-0455). Week ending 14 Mar 2026. Payment due Friday.', 'info', true, interval '6 days', '/timesheets'),
  ('timesheet_approved', 'Timesheet approved — Piotr Nowaczyk (P43-0678)', 'James Whitfield approved the timesheet for Piotr Nowaczyk (P43-0678). Week ending 14 Mar 2026. £862.50 payable.', 'info', true, interval '7 days', '/timesheets'),
  ('timesheet_approved', 'Timesheet approved — Ade Bankole (P43-0392)', 'Timesheet approved for Ade Bankole (P43-0392) — week ending 7 Mar 2026. Note: compliance flag now active on this operative.', 'warning', true, interval '14 days', '/timesheets'),
  ('timesheet_submitted', 'Timesheet submitted — Darius Moldovan (P43-0891)', 'Darius Moldovan (P43-0891) submitted for w/e 21 Mar. 45 hours. Clock-in/out data confirmed via GPS at Leeds Aire Valley.', 'info', false, interval '3 hours', '/timesheets'),
  -- Offers / Allocations
  ('offer_accepted', 'Offer accepted — Bogdan Petrescu (P43-0211)', 'Bogdan Petrescu (P43-0211) accepted the allocation offer for Leeds Aire Valley Regeneration. Start: Monday 24 Mar 2026 at 07:30. CSCS Gold ✓ RTW ✓', 'info', false, interval '1 hour', '/allocations'),
  ('offer_accepted', 'Offer accepted — Shane McAllister (P43-0455)', 'Shane McAllister (P43-0455) accepted the Leeds Aire Valley offer. Start confirmed for Monday 24 Mar.', 'info', false, interval '1 hour 10 minutes', '/allocations'),
  ('offer_declined', 'Offer declined — Piotr Nowaczyk (P43-0678)', 'Piotr Nowaczyk (P43-0678) declined the Leeds Aire Valley offer. Reason given: existing commitment. Offer cascaded to next candidate.', 'warning', false, interval '55 minutes', '/allocations'),
  ('offer_accepted', 'Offer accepted — Darius Moldovan (P43-0891)', 'Darius Moldovan (P43-0891) accepted the Leeds Aire Valley offer. Start confirmed.', 'info', true, interval '45 minutes', '/allocations'),
  ('allocation_confirmed', 'Allocation confirmed — Helen Kozlowski (P43-0322)', 'Helen Kozlowski (P43-0322) confirmed for Birmingham Curzon Gateway. Start: 19 Feb 2026. Trade: General Labourer. Day rate: £128.', 'info', true, interval '30 days', '/allocations'),
  ('allocation_confirmed', 'Allocation confirmed — Graham Constantin (P43-0567)', 'Graham Constantin (P43-0567) confirmed for Coventry City Centre North. 14 Mar start. Trade: Bricklayer. Day rate: £162.', 'info', true, interval '7 days', '/allocations'),
  -- NCRs
  ('ncr_raised', 'NCR raised — Drugs & Alcohol | P43-NCR-0006', 'A critical NCR has been raised for an operative at Coventry City Centre North. Breathalyser result: 0.12mg/L. Operative auto-blocked. Requires director review.', 'critical', false, interval '3 days', '/ncrs'),
  ('ncr_auto_block', 'Operative auto-blocked — Safety breach | P43-NCR-0010', 'An operative was automatically blocked following a critical safety breach at Wolverhampton Civic Waterfront. Mobile phone use whilst operating telehandler. Review required.', 'critical', false, interval '2 days', '/ncrs'),
  ('ncr_raised', 'NCR raised — No-show | P43-NCR-0001', 'Marcus Osei (P43-0847) failed to attend their shift at Birmingham Jewellery Quarter on 7 Mar 2026. Site manager Mike Hartley notified at 08:15. NCR: P43-NCR-0001.', 'warning', true, interval '14 days', '/ncrs'),
  ('ncr_raised', 'NCR raised — Walk-off | P43-NCR-0007', 'An operative left Birmingham Business Quarter mid-shift on 16 Mar without notification. Tools abandoned. Operative unreachable. NCR: P43-NCR-0007. Allocation at risk.', 'warning', false, interval '5 days', '/ncrs'),
  ('ncr_resolved', 'NCR resolved — Late arrival | P43-NCR-0002', 'P43-NCR-0002 (late arrival at Manchester NOMA) has been resolved by Sarah Okonkwo. Rail delays confirmed. No further action. Operative cleared.', 'info', true, interval '9 days', '/ncrs'),
  ('ncr_resolved', 'NCR resolved — Poor workmanship | P43-NCR-0005', 'P43-NCR-0005 (brickwork out of plumb at Derby Becketwell) resolved. Section rebuilt. QA signed off. Cost deducted from invoice. Operative returned to site.', 'info', true, interval '11 days', '/ncrs'),
  -- Compliance
  ('document_expiring', 'Document expiring — CSCS card | Tomasz Wolski (P43-1103)', 'CSCS card for Tomasz Wolski (P43-1103) expires in 28 days (18 Apr 2026). Renewal reminder sent via WhatsApp. Please follow up if no action within 7 days.', 'warning', false, interval '2 days', '/operatives'),
  ('document_expiring', 'Document expiring — RTW share code | Ade Bankole (P43-0392)', 'Right to work share code for Ade Bankole (P43-0392) requires re-check within 14 days (6-month cycle). Schedule verification before 4 Apr 2026.', 'warning', false, interval '1 day', '/operatives'),
  ('document_expiring', 'Document expiring — First Aid certificate | Marcus Osei (P43-0847)', 'First Aid certificate for Marcus Osei (P43-0847) expires 31 Mar 2026. Please arrange renewal or they will be flagged as non-compliant.', 'warning', false, interval '6 hours', '/operatives'),
  ('document_expiring', 'CSCS expiring — 8 operatives (batch)', '8 operatives have CSCS cards expiring within 60 days. Renewal reminders sent automatically. Affected: P43-0211, P43-0455, P43-0678, P43-0891, P43-1103 and 3 others.', 'warning', false, interval '12 hours', '/operatives'),
  ('compliance_alert', 'Compliance alert — P43-0847 flagged', 'Marcus Osei (P43-0847) has been flagged for compliance review. 2 open NCRs this month plus a missing CSCS renewal. Currently active on site. Review recommended before next shift.', 'critical', false, interval '1 day', '/operatives'),
  -- Labour requests
  ('labour_request_open', 'Labour request submitted — 4× Bricklayers', 'A new labour request has been submitted for 4 Bricklayers at Birmingham Business Quarter. Start: 1 Apr 2026. Day rate: £160. Requested by site manager.', 'info', true, interval '5 days', '/requests'),
  ('labour_request_filled', 'Labour request filled — Steel Fixers, Leeds Aire Valley', 'The labour request for 4 Steel Fixers at Leeds Aire Valley Regeneration is now fully filled. All allocations confirmed and offers accepted.', 'info', false, interval '30 minutes', '/requests'),
  ('labour_request_open', 'Labour request — 2× Plant Operators urgently needed', 'Urgent: 2 Plant Operators required at HS2 Enabling Works from Monday 24 Mar. Existing operators on WTD limits. Please allocate from available pool.', 'warning', false, interval '5 hours', '/requests'),
  -- Operative status changes
  ('operative_verified', 'Operative verified — Bogdan Petrescu (P43-0211)', 'Bogdan Petrescu (P43-0211) has been fully verified. All documents checked: CSCS Gold ✓, Right to Work ✓, Photo ID ✓, NI verified ✓. Status updated to Available.', 'info', true, interval '20 days', '/operatives'),
  ('operative_verified', 'Operative verified — Amara Diallo (P43-0534)', 'Amara Diallo (P43-0534) passed full compliance check. RTW (EU Settled Status) verified. CSCS Blue card confirmed. Available for allocation.', 'info', true, interval '18 days', '/operatives'),
  ('operative_blocked', 'Operative blocked — Repeat NCR threshold reached', 'An operative has reached the auto-block threshold (2 NCRs within 30 days). Status set to Blocked pending director review. Active allocations flagged for reassignment.', 'critical', false, interval '2 days', '/operatives'),
  -- Shifts
  ('shift_no_show', 'Shift no-show — Marcus Osei (P43-0847)', 'Marcus Osei (P43-0847) did not clock in for their 07:30 shift at Birmingham Jewellery Quarter on 7 Mar 2026. NCR auto-raised (P43-NCR-0001). Site manager notified.', 'warning', true, interval '14 days', '/shifts'),
  ('shift_completed', '156 shifts completed this week', '156 shifts were completed across 22 active sites in the week ending 21 Mar 2026. Average shift duration: 9.7 hours. 3 WTD flags raised. 99.3% clock-in rate.', 'info', true, interval '1 day', '/shifts'),
  -- Advert / Recruitment
  ('advert_applications', 'New applications — LinkedIn Bricklayer campaign', '7 new applications received via the LinkedIn Bricklayer campaign in the last 24 hours. 3 have been pre-screened. Review and shortlist in the Recruitment section.', 'info', false, interval '18 hours', '/adverts'),
  ('advert_applications', 'Campaign milestone — Indeed Steel Fixer advert', 'The Indeed Steel Fixer campaign has reached 10,000 impressions with a 2.1% click-through rate — above industry average. 14 applications received to date.', 'info', false, interval '3 days', '/adverts'),
  ('advert_budget', 'Advert budget alert — Facebook Plant Operator', 'The Facebook Plant Operator campaign has spent 80% of its budget (£480 of £600). Consider pausing or increasing budget. Current application count: 9.', 'warning', false, interval '2 days', '/adverts'),
  -- System / workflow
  ('workflow_completed', 'Workflow completed — Weekly compliance sweep', 'The automated weekly compliance sweep has completed. 1,187 operatives checked. 94 flagged for document review. 12 auto-block candidates identified. Report available.', 'info', true, interval '3 days', '/reports'),
  ('workflow_completed', 'Workflow completed — Timesheet reminder batch', 'Timesheet submission reminders sent to 34 operatives who had not submitted for w/e 14 Mar. 28 of 34 submitted within 4 hours. 6 still outstanding.', 'info', true, interval '7 days', '/reports'),
  ('workflow_completed', 'Offer cascade completed — HS2 Plant Operators', 'Offer cascade for 2 Plant Operator positions at Birmingham Curzon Gateway completed. Positions filled after cascading to 5 operatives. Both acceptances received within 15 minutes.', 'info', false, interval '4 days', '/allocations')
) AS n(ntype, ntitle, nbody, nsev, is_read, age, lurl)
CROSS JOIN (
  SELECT id FROM public.operatives WHERE organization_id = v_org ORDER BY random() LIMIT 1
) o
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Phase 9: Notifications replaced with detailed operative-linked data';

RAISE NOTICE '=== ENHANCEMENT COMPLETE ===';
END $$;
