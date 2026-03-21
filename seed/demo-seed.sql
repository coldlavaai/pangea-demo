-- ============================================================
-- PILLAR 43 CONSTRUCTION — FULL DEMO SEED
-- Org: 00000000-0000-0000-0000-000000000002
-- Run via: node seed/create-demo.js
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;

-- ============================================================
-- PHASE 1: USER FIX-UP + TRADE CATEGORIES
-- ============================================================

UPDATE public.users SET
  organization_id = '00000000-0000-0000-0000-000000000002',
  role = 'director', can_export = true, can_import = true
WHERE auth_user_id = '{{AUTH_USER_ID_1}}';

UPDATE public.users SET
  organization_id = '00000000-0000-0000-0000-000000000002',
  role = 'labour_manager', can_export = true
WHERE auth_user_id = '{{AUTH_USER_ID_2}}';

UPDATE public.users SET
  organization_id = '00000000-0000-0000-0000-000000000002',
  role = 'admin'
WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

INSERT INTO trade_categories (id, organization_id, name, labour_type, typical_day_rate, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Groundworker','blue_collar',185.00,1,true),
  ('11111111-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Labourer (General)','blue_collar',155.00,2,true),
  ('11111111-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Scaffolder','blue_collar',195.00,3,true),
  ('11111111-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Concrete Finisher','blue_collar',175.00,4,true),
  ('11111111-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','Steel Fixer / Rebar','blue_collar',190.00,5,true),
  ('11111111-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','Plant Operator (360 Excavator)','blue_collar',220.00,6,true),
  ('11111111-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','Plant Operator (Forward Tipping Dumper)','blue_collar',200.00,7,true),
  ('11111111-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','Bricklayer','blue_collar',195.00,8,true),
  ('11111111-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','Demolition Operative','blue_collar',185.00,9,true),
  ('11111111-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','Site Manager','white_collar',350.00,10,true),
  ('11111111-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000002','Quantity Surveyor','white_collar',400.00,11,true),
  ('11111111-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','Health & Safety Officer','white_collar',325.00,12,true);

-- ============================================================
-- PHASE 2: SITES (22 active, 4 completed, 2 upcoming = 28 total)
-- IDs: 22222222-0000-0000-0000-000000000001 through 000000000028
-- Active: 001-022 | Completed: 023-026 | Upcoming: 027-028
-- ============================================================

INSERT INTO sites (id,organization_id,name,address,postcode,lat,lng,site_manager_name,site_manager_phone,site_manager_email,contact_phone,main_duties,project_value,project_start_date,project_end_date,is_active,notes,key_contacts,created_at,updated_at) VALUES

('22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Ancoats Quarter — Phase 2','14 Blossom Street, Manchester','M4 6AJ',53.4835,-2.2301,'Kevin Hartley','+447800001001','k.hartley@pillar43.co.uk','+447800001001','Groundworks, RC frame, drainage and external works for 18-storey mixed-use tower. 142 apartments, ground-floor retail and underground car park.',12400000.00,'2024-09-01','2026-11-30',true,'Access via Blossom Street entrance only. LMCR zones apply.',
'[{"name":"Rachel Chow","role":"Client PM","phone":"+441612301100","email":"r.chow@anscompany.co.uk"},{"name":"Stuart Fenn","role":"Structural Engineer","phone":"+441612301101","email":"s.fenn@fenn-struct.co.uk"}]',
NOW()-'390 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Salford Quays Media Hub','3 The Quays, Salford','M50 3AG',53.4724,-2.2986,'Patricia Nolan','+447800001002','p.nolan@pillar43.co.uk','+447800001002','Piled foundations, concrete frame, cladding subframe and MEP first-fix for 9-storey commercial office development adjacent to MediaCityUK.',8700000.00,'2024-11-15','2026-08-31',true,'Working alongside MediaCity broadcast schedule — no heavy plant 06:00-08:00 or 17:00-19:00.',
'[{"name":"Tom Alderton","role":"Developer PM","phone":"+441617001200","email":"t.alderton@salforddev.co.uk"}]',
NOW()-'492 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Bolton Central Interchange','Moor Lane, Bolton','BL1 2RU',53.5768,-2.4295,'Derek Sims','+447800001003','d.sims@pillar43.co.uk','+447800001003','Bus interchange demolition, enabling works, new RC frame, canopy steelwork and public realm hard landscaping.',6200000.00,'2025-01-06','2026-12-18',true,'TfGM coordinated works. Highway lane closures require 72hr notice.',
'[{"name":"Amara Johnson","role":"TfGM Representative","phone":"+441612001234","email":"a.johnson@tfgm.com"},{"name":"Clive Pratt","role":"H&S Advisor","phone":"+447900221001","email":"c.pratt@safeworks.co.uk"}]',
NOW()-'440 days'::interval,NOW()-'3 days'::interval),

('22222222-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Wirral Waters — Block F','Dock Road, Birkenhead','CH41 1DJ',53.3887,-3.0247,'Sandra Beech','+447800001004','s.beech@pillar43.co.uk','+447800001004','Waterfront residential — RC pile cap, basement retention, 11 floors of modular apartments, brick external skin.',9800000.00,'2024-08-19','2027-03-31',true,'Tidal zone restrictions. All piling operations Mon-Fri 08:00-17:00 only.',
'[{"name":"Jim Whittaker","role":"Wirral Development Co","phone":"+441516009900","email":"j.whittaker@wirraldev.co.uk"},{"name":"Dr Lee Morris","role":"Geotechnical","phone":"+447811221100","email":"l.morris@geo-consult.com"}]',
NOW()-'415 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','Liverpool Tobacco Warehouse Conversion','Stanley Dock, Great Howard Street, Liverpool','L3 0AN',53.4240,-2.9963,'Carl Jennings','+447800001005','c.jennings@pillar43.co.uk','+447800001005','Heritage-sensitive conversion of Grade II* warehouse to 461 luxury apartments. Structural repairs, new RC cores, rooftop extension.',14200000.00,'2024-06-03','2027-06-30',true,'Heritage England grade II* monitoring — weekly photographic record required.',
'[{"name":"Fiona McNab","role":"Heritage England Liaison","phone":"+441512000001","email":"f.mcnab@historicengland.org.uk"}]',
NOW()-'475 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','Stockport Town Centre Living','Wellington Road South, Stockport','SK1 3UA',53.4072,-2.1581,'Phil Davenport','+447800001006','p.davenport@pillar43.co.uk','+447800001006','Six-storey residential above retail. Strip foundations, brick-and-block superstructure, timber roof, hard landscaping.',5100000.00,'2025-02-17','2026-10-15',true,NULL,
'[{"name":"Gary Orr","role":"Stockport MBC","phone":"+441614800001","email":"g.orr@stockport.gov.uk"}]',
NOW()-'397 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','Wigan Athletic Village — Phase 1','Robin Park Road, Wigan','WN5 0UH',53.5449,-2.6418,'Lesley Barker','+447800001007','l.barker@pillar43.co.uk','+447800001007','Leisure and residential. Ground-bearing slab, steel frame sports hall, 72-unit housing. Landscaping and car park.',3800000.00,'2025-03-03','2026-09-30',true,NULL,
'[{"name":"Mike Tait","role":"Wigan Council PM","phone":"+441942001001","email":"m.tait@wigan.gov.uk"}]',
NOW()-'383 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','Leeds South Bank Enterprise Zone','Meadow Road, Leeds','LS11 5PL',53.7895,-1.5507,'Graham Ord','+447800001008','g.ord@pillar43.co.uk','+447800001008','14-storey office and co-working tower. Bored pile foundation, post-tensioned concrete frame, unitised curtain walling.',11300000.00,'2024-10-07','2027-02-28',true,'Leeds City Council BID area. Community liaison meetings monthly.',
'[{"name":"Andrea Bloom","role":"Developer Rep","phone":"+441132001100","email":"a.bloom@leedssouthbank.co.uk"}]',
NOW()-'530 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','Sheffield Olympic Legacy Village','Attercliffe Road, Sheffield','S9 2LA',53.3928,-1.4207,'Pete Horner','+447800001009','p.horner@pillar43.co.uk','+447800001009','240-unit residential development on former Olympic legacy land. Driven piles, RC frame, brick external, communal landscaping.',7600000.00,'2025-01-20','2026-11-30',true,NULL,
'[{"name":"Yolanda Price","role":"Homes England","phone":"+447900330001","email":"y.price@homesengland.gov.uk"}]',
NOW()-'425 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','Bradford City Village','Drake Street, Bradford','BD1 4RF',53.7980,-1.7554,'Brendan Foley','+447800001010','b.foley@pillar43.co.uk','+447800001010','Mixed-use regeneration. Demolition of 1970s office block, new RC frame, 180 apartments, 4 commercial units.',8900000.00,'2024-09-23','2027-01-31',true,'Demolition phase completed. Currently superstructure.',
'[{"name":"Helen Barratt","role":"Bradford MDC","phone":"+441274001001","email":"h.barratt@bradford.gov.uk"}]',
NOW()-'544 days'::interval,NOW()-'3 days'::interval),

('22222222-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000002','Hull Marina — Phase 3','Castle Street, Hull','HU1 2BX',53.7456,-0.3379,'Natalie Kirk','+447800001011','n.kirk@pillar43.co.uk','+447800001011','Waterfront apartment complex. Sheet piling, RC frame, timber-clad facade, private marina pontoon and access.',6100000.00,'2025-02-03','2026-12-15',true,NULL,
'[{"name":"Tony Doyle","role":"Hull City Council","phone":"+441482001001","email":"t.doyle@hullcc.gov.uk"}]',
NOW()-'441 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','Birmingham Curzon Gateway — HS2 Enabling','Curzon Street, Birmingham','B4 7XG',52.4807,-1.8817,'Robert Adkins','+447800001012','r.adkins@pillar43.co.uk','+447800001012','HS2 enabling works including diversion of utilities, demolition, ground remediation and construction of temporary access roads.',15200000.00,'2024-04-22','2026-09-30',true,'HS2 programme — daily access passes required for all operatives. No mobile phones in controlled zones.',
'[{"name":"Claire Moss","role":"HS2 Ltd","phone":"+447600001100","email":"c.moss@hs2.org.uk"},{"name":"Dwayne Clarke","role":"Site Safety","phone":"+447600001101","email":"d.clarke@hs2-safety.co.uk"}]',
NOW()-'334 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','Coventry City Centre North','Corporation Street, Coventry','CV1 1GY',52.4081,-1.5069,'Annie Moss','+447800001013','a.moss@pillar43.co.uk','+447800001013','Retail and leisure regeneration. Demolition, ground remediation, RC retail podium, four residential towers above.',9400000.00,'2024-12-02','2027-05-31',true,NULL,
'[{"name":"Paul Sherwood","role":"Coventry City Council","phone":"+442476001001","email":"p.sherwood@coventry.gov.uk"}]',
NOW()-'474 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000002','Wolverhampton Civic Waterfront','Broad Street, Wolverhampton','WV1 1JZ',52.5862,-2.1283,'Dave Allsop','+447800001014','d.allsop@pillar43.co.uk','+447800001014','Public realm, pedestrianisation, new civic square, feature water installation and adjacent 6-storey office building.',5800000.00,'2025-01-13','2026-10-31',true,NULL,
'[{"name":"Jo Pearce","role":"Wolverhampton CC","phone":"+441902001001","email":"j.pearce@wolverhampton.gov.uk"}]',
NOW()-'430 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000002','Leicester Waterside East','Sanvey Gate, Leicester','LE1 4EQ',52.6395,-1.1281,'Gill Carpenter','+447800001015','g.carpenter@pillar43.co.uk','+447800001015','Mixed-use waterside development on former print works site. Ground remediation, RC frame, 196 apartments, restaurant units.',6900000.00,'2025-03-10','2027-03-31',true,NULL,
'[{"name":"Raj Mehta","role":"Leicester City Council","phone":"+441162001001","email":"r.mehta@leicester.gov.uk"}]',
NOW()-'376 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000002','Stratford Village Central','Great Eastern Road, London','E15 1BB',51.5413,-0.0041,'Marcus Webb','+447800001016','m.webb@pillar43.co.uk','+447800001016','Twin 22-storey residential towers. Driven precast piles, RC flat slab frame, engineered timber top 4 storeys. 312 units.',18600000.00,'2024-07-15','2027-08-31',true,'LLDC development zone. Environmental monitoring programme in place.',
'[{"name":"Priya Sharma","role":"LLDC PM","phone":"+442089001001","email":"p.sharma@lldc.co.uk"},{"name":"Ben Frost","role":"Structural Engineer","phone":"+447711001001","email":"b.frost@frost-eng.co.uk"}]',
NOW()-'250 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000002','Nine Elms South Tower','Nine Elms Lane, London','SW11 7AU',51.4786,-0.1401,'Veronica Salt','+447800001017','v.salt@pillar43.co.uk','+447800001017','30-storey premium residential tower. CFA piled raft, post-tensioned RC frame, aluminium unitised facade, roof terrace.',22100000.00,'2024-05-20','2027-11-30',true,'SuDS drainage requirements. Night-time concrete pours permitted with advance LB Wandsworth consent.',
'[{"name":"Oliver Crane","role":"Developer","phone":"+442076001001","email":"o.crane@nineelmscapital.co.uk"},{"name":"Suki Tanaka","role":"Architect","phone":"+442076001002","email":"s.tanaka@starchitects.co.uk"}]',
NOW()-'306 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000002','Croydon Whitgift Quarter','North End, Croydon','CR0 1TY',51.3754,-0.0993,'Mark Easton','+447800001018','m.easton@pillar43.co.uk','+447800001018','Major town centre retail and residential. Sub-basement car park, RC frame, two residential towers of 17 and 19 storeys.',11800000.00,'2025-02-24','2027-06-30',true,'TfL Tramlink overhead restrictions in NE corner. Crane oversail licence applied.',
'[{"name":"Sean Hadley","role":"LB Croydon","phone":"+442086001001","email":"s.hadley@croydon.gov.uk"}]',
NOW()-'390 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000002','M25 Junction 28 Improvement','Brook Street, Brentwood','CM14 5NF',51.6189,0.3097,'Colin Fraser','+447800001019','c.fraser@pillar43.co.uk','+447800001019','Highway infrastructure. Gantry demolition, carriageway widening, new slip roads, drainage, signal upgrades.',8400000.00,'2025-01-06','2026-08-31',true,'National Highways contract. SMP and Traffic Management Plan updated monthly. Lane restrictions 21:00-06:00 only.',
'[{"name":"Dawn Hayward","role":"National Highways","phone":"+443003001001","email":"d.hayward@nationalhighways.co.uk"}]',
NOW()-'440 days'::interval,NOW()-'2 days'::interval),

('22222222-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002','Canary Wharf South Quay Tower','South Quay Square, London','E14 9FF',51.5023,-0.0198,'Irene Park','+447800001020','i.park@pillar43.co.uk','+447800001020','36-storey Grade-A office tower. Secant piled basement, post-tensioned RC frame, full-height glass curtain walling, roof plant.',25300000.00,'2024-03-18','2028-02-28',true,'Canary Wharf Group protocols. All operatives require CW security pass. First aid post on site at all times.',
'[{"name":"Peter Orr","role":"CWG PM","phone":"+442072191001","email":"p.orr@canarywharf.com"},{"name":"Yulia Volkov","role":"Structural","phone":"+442072191002","email":"y.volkov@arup.com"}]',
NOW()-'369 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','Bristol Temple Quarter Enterprise Zone','Avon Street, Bristol','BS2 0PX',51.4497,-2.5823,'Steve Nuttall','+447800001021','s.nuttall@pillar43.co.uk','+447800001021','Commercial enterprise zone. Ground remediation, RC frame, 8-storey spec office, district heating connection, public realm.',13400000.00,'2024-08-05','2027-04-30',true,NULL,
'[{"name":"Carla Ash","role":"Bristol City Council","phone":"+441179001001","email":"c.ash@bristol.gov.uk"}]',
NOW()-'229 days'::interval,NOW()-'1 day'::interval),

('22222222-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','Glasgow Waterfront Regeneration','Pacific Quay, Glasgow','G51 1EA',55.8598,-4.2920,'Angus MacDonald','+447800001022','a.macdonald@pillar43.co.uk','+447800001022','Waterfront mixed use. Bored pile foundations to rock, RC frame, 280 apartments, hotel, retail and public boardwalk.',16700000.00,'2024-10-14','2027-09-30',true,'SEPA ecological survey findings require amphibian exclusion from Oct-Mar.',
'[{"name":"Fiona Hendry","role":"Glasgow City Council","phone":"+441412271001","email":"f.hendry@glasgow.gov.uk"},{"name":"Ross McBain","role":"Historic Environment Scotland","phone":"+441312701001","email":"r.mcbain@hes.scot"}]',
NOW()-'524 days'::interval,NOW()-'2 days'::interval),

-- COMPLETED SITES (023-026)
('22222222-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000002','Huddersfield Northern Gateway','New Street, Huddersfield','HD1 2UA',53.6463,-1.7804,'Janet Booth','+447800001023','j.booth@pillar43.co.uk','+447800001023','Retail and residential regeneration. RC frame, 150 apartments, 6 retail units, multi-storey car park.',4700000.00,'2023-09-04','2025-10-31',false,'Project complete. Final account agreed.',
'[{"name":"Dennis Wood","role":"Kirklees Council","phone":"+441484001001","email":"d.wood@kirklees.gov.uk"}]',
NOW()-'730 days'::interval,NOW()-'150 days'::interval),

('22222222-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000002','Nottingham Eastside Quarter','Manvers Street, Nottingham','NG2 4JY',52.9471,-1.1429,'Chris Bland','+447800001024','c.bland@pillar43.co.uk','+447800001024','City fringe residential. Brownfield remediation, 220 apartments across three blocks, public open space.',7300000.00,'2023-11-13','2025-11-30',false,'Handover complete. Snagging closed November 2025.',
'[{"name":"Sue Ellis","role":"Nottingham City Homes","phone":"+441157481001","email":"s.ellis@nottinghamch.co.uk"}]',
NOW()-'850 days'::interval,NOW()-'112 days'::interval),

('22222222-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000002','Lewisham Gateway — Phase 2','Lewisham High Street, London','SE13 6EE',51.4617,-0.0137,'Rod Carr','+447800001025','r.carr@pillar43.co.uk','+447800001025','Mixed use. RC frame, 168 apartments, commercial ground floor, public realm improvements and cycle infrastructure.',9700000.00,'2023-07-24','2025-12-19',false,'DLP period active until July 2026.',
'[{"name":"Val Grant","role":"Lewisham Homes","phone":"+442087481001","email":"v.grant@lewishamhomes.co.uk"}]',
NOW()-'900 days'::interval,NOW()-'93 days'::interval),

('22222222-0000-0000-0000-000000000026','00000000-0000-0000-0000-000000000002','Bath Western Riverside — Phase 3','Lower Bristol Road, Bath','BA2 3BY',51.3741,-2.3682,'Elaine Cross','+447800001026','e.cross@pillar43.co.uk','+447800001026','Residential. RC frame, 112 apartments, rooftop communal terrace, riverside public realm and mooring.',7800000.00,'2023-04-17','2025-09-30',false,'Final account in dispute. Retention released.',
'[{"name":"Ian Fox","role":"Bath & NE Somerset","phone":"+441225001001","email":"i.fox@bathnes.gov.uk"}]',
NOW()-'700 days'::interval,NOW()-'173 days'::interval),

-- UPCOMING SITES (027-028)
('22222222-0000-0000-0000-000000000027','00000000-0000-0000-0000-000000000002','Swindon North Star District','Great Western Way, Swindon','SN5 7XZ',51.5581,-1.8241,'Darren Cole','+447800001027','d.cole@pillar43.co.uk','+447800001027','Retail, leisure and hotel complex. RC frame, 7-screen cinema, 160-bed hotel, 22 retail units, surface car park.',5300000.00,'2026-05-04','2027-10-31',true,'Pre-commencement phase. Mobilisation April 2026. Enabling works permit pending.',
'[{"name":"Tina Reid","role":"Swindon BC","phone":"+441793001001","email":"t.reid@swindon.gov.uk"}]',
NOW()-'60 days'::interval,NOW()-'5 days'::interval),

('22222222-0000-0000-0000-000000000028','00000000-0000-0000-0000-000000000002','Edinburgh St Andrew Square — Phase 2','George Street, Edinburgh','EH2 2PF',55.9537,-3.1953,'Morag Fraser','+447800001028','m.fraser@pillar43.co.uk','+447800001028','Hotel, retail and rooftop dining. Underpinning of listed building, RC insertion frame, 204-bed hotel and 8 restaurants.',19200000.00,'2026-04-14','2028-06-30',true,'HES consent obtained Feb 2026. Archaeology watching brief required throughout.',
'[{"name":"Alistair Burns","role":"Edinburgh Council","phone":"+441312001001","email":"a.burns@edinburgh.gov.uk"},{"name":"Professor Joan Kyle","role":"HES Archaeology","phone":"+441312701002","email":"j.kyle@hes.scot"}]',
NOW()-'45 days'::interval,NOW()-'3 days'::interval);

-- ============================================================
-- PHASE 3: SITE MANAGERS (2 per site = 56 records)
-- Phones: +447801001001 through +447801001056
-- ============================================================

INSERT INTO site_managers (id,organization_id,site_id,name,phone,email,is_primary,is_active) VALUES
-- Site 001 Ancoats
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','Kevin Hartley','+447801001001','k.hartley@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','Louise Brady','+447801001002','l.brady@pillar43.co.uk',false,true),
-- Site 002 Salford Quays
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','Patricia Nolan','+447801001003','p.nolan@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','Shaun Doyle','+447801001004','s.doyle@pillar43.co.uk',false,true),
-- Site 003 Bolton
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003','Derek Sims','+447801001005','d.sims@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003','Wendy Holt','+447801001006','w.holt@pillar43.co.uk',false,true),
-- Site 004 Wirral Waters
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000004','Sandra Beech','+447801001007','s.beech@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000004','Norman Webb','+447801001008','n.webb@pillar43.co.uk',false,true),
-- Site 005 Liverpool Tobacco
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000005','Carl Jennings','+447801001009','c.jennings@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000005','Denise Shah','+447801001010','d.shah@pillar43.co.uk',false,true),
-- Site 006 Stockport
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000006','Phil Davenport','+447801001011','p.davenport@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000006','Cath Moran','+447801001012','c.moran@pillar43.co.uk',false,true),
-- Site 007 Wigan
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000007','Lesley Barker','+447801001013','l.barker@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000007','Russ Finch','+447801001014','r.finch@pillar43.co.uk',false,true),
-- Site 008 Leeds
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000008','Graham Ord','+447801001015','g.ord@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000008','Clare Nash','+447801001016','c.nash@pillar43.co.uk',false,true),
-- Site 009 Sheffield
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000009','Pete Horner','+447801001017','p.horner@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000009','Tracy Dunn','+447801001018','t.dunn@pillar43.co.uk',false,true),
-- Site 010 Bradford
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000010','Brendan Foley','+447801001019','b.foley@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000010','Anita Rao','+447801001020','a.rao@pillar43.co.uk',false,true),
-- Site 011 Hull
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000011','Natalie Kirk','+447801001021','n.kirk@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000011','Wayne Stone','+447801001022','w.stone@pillar43.co.uk',false,true),
-- Site 012 Birmingham HS2
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000012','Robert Adkins','+447801001023','r.adkins@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000012','Susan Patel','+447801001024','s.patel@pillar43.co.uk',false,true),
-- Site 013 Coventry
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000013','Annie Moss','+447801001025','a.moss@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000013','Geoff Lowe','+447801001026','g.lowe@pillar43.co.uk',false,true),
-- Site 014 Wolverhampton
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000014','Dave Allsop','+447801001027','d.allsop@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000014','Maxine Grant','+447801001028','m.grant@pillar43.co.uk',false,true),
-- Site 015 Leicester
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000015','Gill Carpenter','+447801001029','g.carpenter@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000015','Imran Hussain','+447801001030','i.hussain@pillar43.co.uk',false,true),
-- Site 016 Stratford
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000016','Marcus Webb','+447801001031','m.webb@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000016','Faye Collins','+447801001032','f.collins@pillar43.co.uk',false,true),
-- Site 017 Nine Elms
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000017','Veronica Salt','+447801001033','v.salt@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000017','Len Kovacs','+447801001034','l.kovacs@pillar43.co.uk',false,true),
-- Site 018 Croydon
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000018','Mark Easton','+447801001035','m.easton@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000018','Amanda Fry','+447801001036','a.fry@pillar43.co.uk',false,true),
-- Site 019 M25 J28
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000019','Colin Fraser','+447801001037','c.fraser@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000019','Mandy Okafor','+447801001038','m.okafor@pillar43.co.uk',false,true),
-- Site 020 Canary Wharf
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000020','Irene Park','+447801001039','i.park@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000020','Glen Morris','+447801001040','g.morris@pillar43.co.uk',false,true),
-- Site 021 Bristol
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000021','Steve Nuttall','+447801001041','s.nuttall@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000021','Penny Drake','+447801001042','p.drake@pillar43.co.uk',false,true),
-- Site 022 Glasgow
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000022','Angus MacDonald','+447801001043','a.macdonald@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000022','Kirsty Bell','+447801001044','k.bell@pillar43.co.uk',false,true),
-- Site 023 Huddersfield (completed)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000023','Janet Booth','+447801001045','j.booth@pillar43.co.uk',true,false),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000023','Alan Vickers','+447801001046','a.vickers@pillar43.co.uk',false,false),
-- Site 024 Nottingham (completed)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000024','Chris Bland','+447801001047','c.bland@pillar43.co.uk',true,false),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000024','Bev Tanner','+447801001048','b.tanner@pillar43.co.uk',false,false),
-- Site 025 Lewisham (completed)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000025','Rod Carr','+447801001049','r.carr@pillar43.co.uk',true,false),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000025','Lynn Osei','+447801001050','l.osei@pillar43.co.uk',false,false),
-- Site 026 Bath (completed)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000026','Elaine Cross','+447801001051','e.cross@pillar43.co.uk',true,false),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000026','Terry Bowen','+447801001052','t.bowen@pillar43.co.uk',false,false),
-- Site 027 Swindon (upcoming)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000027','Darren Cole','+447801001053','d.cole@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000027','Steph Kwan','+447801001054','s.kwan@pillar43.co.uk',false,true),
-- Site 028 Edinburgh (upcoming)
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000028','Morag Fraser','+447801001055','m.fraser@pillar43.co.uk',true,true),
(gen_random_uuid(),'00000000-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000028','Calum Reid','+447801001056','c.reid@pillar43.co.uk',false,true);

-- ============================================================
-- PHASE 4: AGENCIES (5 — some operatives sourced via agency)
-- ============================================================

INSERT INTO agencies (id,organization_id,name,contact_name,contact_email,contact_phone,notes) VALUES
('33333333-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Northern Labour Solutions Ltd','Barry Holt','b.holt@northernlabour.co.uk','+441612441001','Primary NW agency. Specialises in groundworkers and scaffolders.'),
('33333333-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Capital Build Staffing','Nadia Okonkwo','n.okonkwo@capitalbuild.co.uk','+442071441001','London-based. Plant operators and concrete specialists.'),
('33333333-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Midlands Trade Recruitment','Steve Prior','s.prior@midlandstrade.co.uk','+441212441001','Bricklayers, rebar and demolition across the Midlands.'),
('33333333-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Yorkshire Workforce Co.','Carol Tanner','c.tanner@yorkshirewf.co.uk','+441132441001','Reliable generalist agency, good compliance record.'),
('33333333-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','Celtic Construction Staffing','Eoin Murphy','e.murphy@celticstaff.co.uk','+441413441001','Scotland and NW. Strong on plant and demolition operatives.');

-- ============================================================
-- PHASE 5: OPERATIVES (1,200 — DO block with loop)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID; v_u2 UUID; v_u3 UUID;

  -- Fixed trade UUIDs
  t_gw   UUID := '11111111-0000-0000-0000-000000000001';
  t_lab  UUID := '11111111-0000-0000-0000-000000000002';
  t_sca  UUID := '11111111-0000-0000-0000-000000000003';
  t_con  UUID := '11111111-0000-0000-0000-000000000004';
  t_sf   UUID := '11111111-0000-0000-0000-000000000005';
  t_p360 UUID := '11111111-0000-0000-0000-000000000006';
  t_pftd UUID := '11111111-0000-0000-0000-000000000007';
  t_bri  UUID := '11111111-0000-0000-0000-000000000008';
  t_dem  UUID := '11111111-0000-0000-0000-000000000009';
  t_sm   UUID := '11111111-0000-0000-0000-000000000010';
  t_qs   UUID := '11111111-0000-0000-0000-000000000011';
  t_hs   UUID := '11111111-0000-0000-0000-000000000012';

  -- Agency IDs for some operatives
  ag1 UUID := '33333333-0000-0000-0000-000000000001';
  ag2 UUID := '33333333-0000-0000-0000-000000000002';
  ag3 UUID := '33333333-0000-0000-0000-000000000003';
  ag4 UUID := '33333333-0000-0000-0000-000000000004';
  ag5 UUID := '33333333-0000-0000-0000-000000000005';

  mf TEXT[] := ARRAY['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles',
    'Christopher','Daniel','Matthew','Andrew','Mark','Paul','George','Kevin','Brian','Gary',
    'Steven','Patrick','Anthony','Peter','Simon','Jonathan','Nicholas','Timothy','Martin','Alan',
    'Graham','Neil','Philip','Russell','Terry','Barry','Wayne','Darren','Craig','Scott',
    'Jason','Lee','Dean','Ryan','Kyle','Luke','Aaron','Jack','Harry','Oliver',
    'Piotr','Krzysztof','Tomasz','Marcin','Mihai','Alexandru','Florin','Adrian','Sean','Declan'];

  ff TEXT[] := ARRAY['Sarah','Emma','Amy','Lauren','Jessica','Hannah','Charlotte','Laura','Melissa','Rebecca',
    'Victoria','Helen','Claire','Rachel','Lisa','Karen','Susan','Tracey','Joanne','Michelle',
    'Nicola','Dawn','Kelly','Samantha','Hayley','Natalie','Gemma','Donna','Amanda','Julie',
    'Marta','Anna','Katarzyna','Agnieszka','Maria','Ioana','Alina','Niamh','Aoife','Siobhan'];

  ln TEXT[] := ARRAY['Smith','Jones','Williams','Taylor','Brown','Davies','Evans','Wilson','Thomas','Roberts',
    'Johnson','Lewis','Walker','Robinson','White','Thompson','Harris','Martin','Clarke','Jackson',
    'Wood','Turner','Moore','Baker','Hall','Cooper','Hill','Ward','Hughes','Phillips',
    'Morgan','Harrison','Young','Green','Adams','King','Wright','Scott','Mitchell','Campbell',
    'Anderson','Shaw','Murray','Miller','Butler','Dixon','Graham','Pearce','Hunt','Price',
    'Kowalski','Nowak','Wieczorek','Lewandowski','Dabrowski','Kozlowski','Jankowski','Mazur','Wiśnewski','Kaminski',
    'Popa','Ionescu','Gheorghe','Dumitrescu','Stan','Munteanu','Florea','Popescu','Constantin','Dinu',
    'Murphy','OBrien','Kelly','Walsh','Ryan','Byrne','Doyle','McCarthy','OConnor','Brennan',
    'Patel','Singh','Kumar','Ali','Ahmed','Rahman','Hussain','Sheikh','Khan','Begum',
    'Henderson','Barnes','Cole','Ellis','Freeman','Fox','Mason','Watkins','Bailey','Chapman'];

  dm  TEXT[] := ARRAY['gmail.com','hotmail.co.uk','yahoo.co.uk','outlook.com','live.co.uk','hotmail.com'];
  nat TEXT[] := ARRAY['British','British','British','British','British','British','British',
    'Irish','Irish','Polish','Polish','Polish','Romanian','Romanian',
    'Lithuanian','Latvian','Bulgarian','Indian','Pakistani'];
  ni_pfx TEXT[] := ARRAY['AB','AK','BL','CE','DT','EB','FJ','GH','HB','JM',
    'KN','LA','MB','NE','PG','QA','RA','SC','TF','UB'];

  nw_cit TEXT[] := ARRAY['Manchester','Salford','Bolton','Wigan','Warrington','Bury','Oldham','Stockport','Rochdale','Leigh','Birkenhead','Liverpool','Widnes','Runcorn'];
  yk_cit TEXT[] := ARRAY['Leeds','Sheffield','Bradford','Hull','Huddersfield','Halifax','Barnsley','Doncaster','Rotherham','Wakefield','Harrogate','York','Castleford','Pontefract'];
  mi_cit TEXT[] := ARRAY['Birmingham','Coventry','Wolverhampton','Derby','Nottingham','Leicester','Stoke-on-Trent','Walsall','Dudley','West Bromwich','Halesowen','Redditch','Burton upon Trent','Tamworth'];
  se_cit TEXT[] := ARRAY['London','Croydon','Bromley','Romford','Ilford','Barking','Enfield','Harrow','Wembley','Stratford','Brentwood','Dartford','Grays','Basildon','Chelmsford'];
  sw_cit TEXT[] := ARRAY['Bristol','Bath','Swindon','Exeter','Cheltenham','Gloucester','Taunton','Yeovil','Weston-super-Mare','Newport','Cardiff','Barry','Bridgend','Cwmbran'];
  sc_cit TEXT[] := ARRAY['Glasgow','Edinburgh','Motherwell','Hamilton','Paisley','Clydebank','Rutherglen','Coatbridge','Dumbarton','Greenock','Stirling','Falkirk'];

  nw_pco TEXT[] := ARRAY['M1 1AE','M3 3HP','M8 9NU','BL1 2AA','WN3 4DP','WA1 1QR','SK1 3BS','OL1 1JE','BL3 6PH','M34 5GH','CH41 5DR','L1 4AQ','WA8 6SJ','WA7 4NT'];
  yk_pco TEXT[] := ARRAY['LS1 4BR','S1 2PP','BD1 1JX','HX1 2AD','HD1 3EA','WF1 1QS','DN1 3AJ','S60 1HG','LS27 9EQ','HU1 2AR','HG1 1QT','YO1 6BP','WF10 3DH','WF8 4HP'];
  mi_pco TEXT[] := ARRAY['B1 1BB','CV1 1HH','WV1 1RR','DE1 1GG','NG1 1FF','LE1 7GH','WS1 2BL','B31 4AR','CV6 7FG','NG9 2HJ','B63 3JX','B98 8LN','DE13 0AT','B77 1RQ'];
  se_pco TEXT[] := ARRAY['E1 6RF','SE1 7PB','N1 9GU','W1T 3JH','CR0 1HE','BR1 1LY','RM1 3DQ','IG1 1NB','E15 1FS','CM14 4RF','DA1 2HG','RM17 6SL','SS14 1GN','CM1 1QH'];
  sw_pco TEXT[] := ARRAY['BS1 5TR','BA1 1HQ','SN1 1PD','EX1 1GE','GL1 1DY','TA1 1HE','BS16 4SH','BA2 4BG','BS23 1LP','NP20 1YA','CF10 1DY','CF62 7BT','CF31 1EZ','NP44 3AE'];
  sc_pco TEXT[] := ARRAY['G1 3SN','EH1 1YZ','ML1 4AA','G71 8BX','PA1 2AH','G81 2JR','G73 2PQ','ML5 3AH','G82 1PF','PA15 1LX','FK7 7QA','FK1 1AT'];

  nw_cou TEXT[] := ARRAY['Greater Manchester','Greater Manchester','Greater Manchester','Greater Manchester','Cheshire','Greater Manchester','Greater Manchester','Greater Manchester','Greater Manchester','Greater Manchester','Merseyside','Merseyside','Cheshire','Cheshire'];

  str TEXT[] := ARRAY['High Street','Church Lane','Station Road','Manor Road','Victoria Road','Queens Road','Kings Road','Park Avenue','Green Lane','Mill Lane','Bridge Street','Chestnut Avenue','Maple Drive','Oak Close','Pine Street','Elm Road','Cedar Way','Birch Lane','Willow Court','Beech Grove','Ash Road','Poplar Close','Hawthorn Drive','Holly Lane','Sycamore Avenue','Springfield Road','The Crescent','Tudor Close','Windsor Drive','Albert Road','George Street','Jubilee Close','Coronation Drive','Saxon Way','Roman Close'];

  -- Loop vars
  i     INTEGER;
  v_op  UUID;
  v_f   TEXT; v_l TEXT; v_is_m BOOLEAN;
  v_ph  TEXT; v_em TEXT; v_ni TEXT;
  v_so  TEXT; v_ac TEXT; v_dob DATE;
  v_nat TEXT; v_cit TEXT; v_pco TEXT; v_cou TEXT;
  v_reg INTEGER;
  v_tid UUID; v_ltype labour_type;
  v_dr  DECIMAL; v_cr DECIMAL; v_exp INTEGER;
  v_grd operative_grade;
  v_ctp cscs_card_type; v_cno TEXT; v_cex DATE;
  v_rtw TEXT; v_rex DATE; v_rtv BOOLEAN;
  v_sta operative_status; v_rem reemploy_status;
  v_tier INTEGER;
  v_cby UUID; v_dcs INTEGER;
  v_eng engagement_method;
  v_ent operative_entry_source;
  v_sd  DATE; v_ag UUID;
  v_wlang TEXT;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  FOR i IN 1..1200 LOOP
    v_op   := gen_random_uuid();
    v_is_m := (i % 4 != 0);  -- 75% male

    -- Names (different modulos to break patterns)
    IF v_is_m THEN v_f := mf[((i*7-1) % 60)+1];
    ELSE            v_f := ff[((i*11-1) % 40)+1];
    END IF;
    v_l := ln[((i*13-1) % 100)+1];

    -- Guaranteed-unique phone (+447400001002 .. +447400002201)
    v_ph := '+447400' || LPAD((1001+i)::TEXT, 6, '0');

    -- Email (i suffix guarantees uniqueness)
    v_em := lower(regexp_replace(v_f,'[^a-zA-Z]','','g')) || '.' ||
            lower(regexp_replace(v_l,'[^a-zA-Z]','','g')) || i::TEXT || '@' ||
            dm[((i*3-1) % 6)+1];

    -- NI number AB100001A format (guaranteed unique via i)
    v_ni := ni_pfx[((i-1) % 20)+1] || LPAD((100000+i)::TEXT,6,'0') || chr(65+((i-1)%4));

    -- DOB: ages 22–58
    v_dob := CURRENT_DATE - ( (((i*127+8000) % 13140) + 8030) )::INTEGER;

    -- Nationality
    v_nat := nat[((i*5-1) % 19)+1];

    -- Region (proportional to sites)
    IF    i <=  300 THEN v_reg := 1;
    ELSIF i <=  510 THEN v_reg := 2;
    ELSIF i <=  720 THEN v_reg := 3;
    ELSIF i <=  980 THEN v_reg := 4;
    ELSIF i <= 1100 THEN v_reg := 5;
    ELSE                 v_reg := 6;
    END IF;

    CASE v_reg
      WHEN 1 THEN v_cit := nw_cit[((i*5-1)%14)+1]; v_pco := nw_pco[((i*5-1)%14)+1]; v_cou := nw_cou[((i*5-1)%14)+1];
      WHEN 2 THEN v_cit := yk_cit[((i*5-1)%14)+1]; v_pco := yk_pco[((i*5-1)%14)+1]; v_cou := 'West Yorkshire';
      WHEN 3 THEN v_cit := mi_cit[((i*5-1)%14)+1]; v_pco := mi_pco[((i*5-1)%14)+1]; v_cou := 'West Midlands';
      WHEN 4 THEN v_cit := se_cit[((i*5-1)%15)+1]; v_pco := se_pco[((i*5-1)%14)+1]; v_cou := 'Greater London';
      WHEN 5 THEN v_cit := sw_cit[((i*5-1)%14)+1]; v_pco := sw_pco[((i*5-1)%14)+1]; v_cou := 'Avon';
      ELSE         v_cit := sc_cit[((i*5-1)%12)+1]; v_pco := sc_pco[((i*5-1)%12)+1]; v_cou := 'Lanarkshire';
    END CASE;

    -- Trade + labour_type + day_rate
    CASE
      WHEN i <=  280 THEN v_tid:=t_gw;   v_ltype:='blue_collar';  v_dr:=180+((i*7)%3)*5;
      WHEN i <=  500 THEN v_tid:=t_lab;  v_ltype:='blue_collar';  v_dr:=150+((i*7)%3)*5;
      WHEN i <=  620 THEN v_tid:=t_sca;  v_ltype:='blue_collar';  v_dr:=190+((i*7)%3)*5;
      WHEN i <=  710 THEN v_tid:=t_con;  v_ltype:='blue_collar';  v_dr:=170+((i*7)%3)*5;
      WHEN i <=  790 THEN v_tid:=t_sf;   v_ltype:='blue_collar';  v_dr:=185+((i*7)%3)*5;
      WHEN i <=  880 THEN v_tid:=t_p360; v_ltype:='blue_collar';  v_dr:=215+((i*7)%3)*5;
      WHEN i <=  940 THEN v_tid:=t_pftd; v_ltype:='blue_collar';  v_dr:=195+((i*7)%3)*5;
      WHEN i <= 1040 THEN v_tid:=t_bri;  v_ltype:='blue_collar';  v_dr:=190+((i*7)%3)*5;
      WHEN i <= 1120 THEN v_tid:=t_dem;  v_ltype:='blue_collar';  v_dr:=180+((i*7)%3)*5;
      WHEN i <= 1160 THEN v_tid:=t_sm;   v_ltype:='white_collar'; v_dr:=340+((i*7)%4)*15;
      WHEN i <= 1180 THEN v_tid:=t_qs;   v_ltype:='white_collar'; v_dr:=390+((i*7)%4)*15;
      ELSE                 v_tid:=t_hs;   v_ltype:='white_collar'; v_dr:=315+((i*7)%4)*15;
    END CASE;
    v_cr := ROUND((v_dr * 1.35)::DECIMAL, 2);

    -- Status
    CASE
      WHEN i <=  280 THEN v_sta := 'working';
      WHEN i <=  620 THEN v_sta := 'available';
      WHEN i <=  770 THEN v_sta := 'verified';
      WHEN i <=  890 THEN v_sta := 'pending_docs';
      WHEN i <= 1000 THEN v_sta := 'unavailable';
      WHEN i <= 1060 THEN v_sta := 'qualifying';
      WHEN i <= 1140 THEN v_sta := 'prospect';
      ELSE                 v_sta := 'blocked';
    END CASE;

    -- Data completeness tier
    IF    i <=  840 THEN v_tier := 1;
    ELSIF i <=  984 THEN v_tier := 2;
    ELSIF i <= 1080 THEN v_tier := 3;
    ELSIF i <= 1140 THEN v_tier := 4;
    ELSE                 v_tier := 5;
    END IF;

    -- Reemploy
    IF    v_sta = 'blocked' THEN v_rem := 'do_not_rehire';
    ELSIF i % 20 = 0        THEN v_rem := 'caution';
    ELSE                         v_rem := 'active';
    END IF;

    -- CSCS
    IF v_tier IN (1,2,4) THEN
      v_ctp := CASE ((i*3-1)%4) WHEN 0 THEN 'green'::cscs_card_type WHEN 1 THEN 'blue'::cscs_card_type WHEN 2 THEN 'blue'::cscs_card_type ELSE 'gold'::cscs_card_type END;
      v_cno := 'P43' || LPAD((1000000+i)::TEXT,7,'0');
      v_cex := CURRENT_DATE + (((i*97)%1000)+90)::INTEGER;
      v_rtv := true;
    ELSIF v_tier = 3 THEN
      v_ctp := 'blue'::cscs_card_type;
      v_cno := 'P43' || LPAD((1000000+i)::TEXT,7,'0');
      v_cex := CURRENT_DATE - (((i*13)%540)+30)::INTEGER;  -- expired
      v_rtv := true;
    ELSE
      v_ctp := NULL; v_cno := NULL; v_cex := NULL; v_rtv := false;
    END IF;

    -- RTW
    IF v_tier IN (1,2,3) THEN
      v_rtw := CASE ((i*5-1)%4) WHEN 0 THEN 'british_citizen' WHEN 1 THEN 'british_citizen' WHEN 2 THEN 'biometric_residence_permit' ELSE 'eu_settled_status' END;
      v_rex := CASE WHEN v_rtw='british_citizen' THEN CURRENT_DATE+(((i*79)%1800)+365)::INTEGER ELSE CURRENT_DATE+(((i*79)%900)+180)::INTEGER END;
    ELSIF v_tier = 4 THEN
      v_rtw := 'biometric_residence_permit';
      v_rex := CURRENT_DATE+(((i*7)%90)-30)::INTEGER;
    ELSE
      v_rtw := NULL; v_rex := NULL;
    END IF;

    -- Grade
    v_grd := CASE ((i*7-1)%11)
      WHEN 0  THEN 'skilled'::operative_grade
      WHEN 1  THEN 'highly_skilled'::operative_grade
      WHEN 2  THEN 'skilled'::operative_grade
      WHEN 3  THEN 'highly_skilled'::operative_grade
      WHEN 4  THEN 'exceptional_skill'::operative_grade
      WHEN 5  THEN 'specialist_skill'::operative_grade
      WHEN 6  THEN 'semi_skilled'::operative_grade
      WHEN 7  THEN 'engineer'::operative_grade
      WHEN 8  THEN 'manager'::operative_grade
      WHEN 9  THEN 'senior_manager'::operative_grade
      ELSE         'skilled'::operative_grade
    END;

    v_exp := ((i*3-1)%20)+1;
    v_so  := LPAD((200001+i)::TEXT,6,'0');
    v_ac  := LPAD((10000000+i)::TEXT,8,'0');
    v_cby := CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    v_dcs := CASE v_tier WHEN 1 THEN 20+((i*3)%5) WHEN 2 THEN 14+((i*3)%5) WHEN 3 THEN 15+((i*3)%5) WHEN 4 THEN 12+((i*3)%7) ELSE 3+((i*3)%6) END;

    v_eng := CASE ((i*7-1)%5) WHEN 0 THEN 'cis_sole_trader'::engagement_method WHEN 1 THEN 'cis_sole_trader'::engagement_method WHEN 2 THEN 'self_employed'::engagement_method WHEN 3 THEN 'limited_company'::engagement_method ELSE 'direct_paye'::engagement_method END;
    v_ent := CASE ((i*3-1)%5) WHEN 0 THEN 'manual'::operative_entry_source WHEN 1 THEN 'manual'::operative_entry_source WHEN 2 THEN 'sophie'::operative_entry_source WHEN 3 THEN 'import'::operative_entry_source ELSE 'referral'::operative_entry_source END;

    IF v_sta IN ('working','available','verified') THEN v_sd := CURRENT_DATE-(((i*47)%500)+30)::INTEGER; ELSE v_sd := NULL; END IF;

    v_ag := CASE (i%25) WHEN 0 THEN ag1 WHEN 5 THEN ag2 WHEN 10 THEN ag3 WHEN 15 THEN ag4 WHEN 20 THEN ag5 ELSE NULL END;
    v_wlang := CASE WHEN v_nat IN ('Polish','Romanian','Lithuanian','Latvian','Bulgarian') THEN 'en,pl' ELSE 'en' END;

    INSERT INTO operatives (
      id,organization_id,reference_number,
      first_name,last_name,phone,email,
      date_of_birth,address_line1,city,county,postcode,
      nationality,ni_number,
      trade_category_id,labour_type,day_rate,charge_rate,
      experience_years,grade,
      cscs_card_type,cscs_card_number,cscs_expiry,
      rtw_verified,rtw_type,rtw_expiry,
      status,reemploy_status,caution_reason,
      bank_sort_code,bank_account_number,
      next_of_kin_name,next_of_kin_phone,
      wtd_opt_out,languages,preferred_language,
      source,entry_source,engagement_method,
      data_completeness_score,
      has_verified_rtw,has_verified_photo_id,
      start_date,agency_id,
      created_by,created_at,updated_at
    ) VALUES (
      v_op,v_org,'P43-'||LPAD(i::TEXT,4,'0'),
      v_f,v_l,v_ph,
      CASE WHEN v_tier<5 THEN v_em ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_dob ELSE NULL END,
      CASE WHEN v_tier<5 THEN (((i*11)%147+1)::TEXT||' '||str[((i*17-1)%35)+1]) ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_cit ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_cou ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_pco ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_nat ELSE NULL END,
      CASE WHEN v_tier=1  THEN v_ni ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_tid ELSE NULL END,
      v_ltype,
      CASE WHEN v_tier<5 THEN v_dr ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_cr ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_exp ELSE NULL END,
      CASE WHEN v_tier<5 THEN v_grd ELSE NULL END,
      v_ctp,v_cno,v_cex,
      v_rtv,v_rtw,v_rex,
      v_sta,v_rem,
      CASE WHEN v_rem='caution' THEN 'Previous conduct issue — monitor closely' ELSE NULL END,
      CASE WHEN v_tier IN (1,3,4) THEN v_so ELSE NULL END,
      CASE WHEN v_tier IN (1,3,4) THEN v_ac ELSE NULL END,
      CASE WHEN v_tier=1 THEN (mf[((i*11-1)%60)+1]||' '||ln[((i*17-1)%100)+1]) ELSE NULL END,
      CASE WHEN v_tier=1 THEN ('+447500'||LPAD((1001+i)::TEXT,6,'0')) ELSE NULL END,
      (i%5=0),
      string_to_array(v_wlang,','),
      'en',
      'web_manual',v_ent,v_eng,
      v_dcs,
      v_rtv,
      CASE WHEN v_tier IN (1,2) THEN true ELSE false END,
      v_sd,v_ag,
      v_cby,
      NOW()-(((i*97)%548)+7)::INTEGER*INTERVAL'1 day',
      NOW()-(((i*37)%30))::INTEGER*INTERVAL'1 day'
    );
  END LOOP;
END $$;

-- ============================================================
-- PHASE 6: DOCUMENTS (for tier 1+2+3+4 operatives)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1 UUID; v_u2 UUID; v_u3 UUID;
  r     RECORD;
  i     INTEGER := 0;
  v_vby UUID;
  v_vat TIMESTAMPTZ;
  v_sta document_status;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  FOR r IN
    SELECT id, data_completeness_score, rtw_type, rtw_expiry, cscs_expiry,
           has_verified_rtw, status AS op_status
    FROM operatives
    WHERE organization_id = v_org
    ORDER BY reference_number
  LOOP
    i := i + 1;
    v_vby := CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    v_vat := NOW() - (((i*53)%400)+10)::INTEGER * INTERVAL '1 day';

    -- Tier 1+2: full documents verified
    IF r.data_completeness_score >= 14 AND r.rtw_type IS NOT NULL THEN

      -- RTW
      v_sta := CASE ((i*7)%10) WHEN 9 THEN 'expired'::document_status ELSE 'verified'::document_status END;
      INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,verified_by,verified_at,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.id,'right_to_work',v_sta,r.rtw_expiry,v_vby,v_vat,v_vat-INTERVAL'10 days',v_vat);

      -- Photo ID
      v_sta := CASE ((i*11)%10) WHEN 9 THEN 'rejected'::document_status WHEN 8 THEN 'pending'::document_status ELSE 'verified'::document_status END;
      INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,verified_by,verified_at,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.id,'photo_id',v_sta,CURRENT_DATE+(((i*79)%1800)+365)::INTEGER,
             CASE WHEN v_sta='verified' THEN v_vby ELSE NULL END,
             CASE WHEN v_sta='verified' THEN v_vat ELSE NULL END,v_vat-INTERVAL'8 days',v_vat);

      -- CSCS card (if expiry set)
      IF r.cscs_expiry IS NOT NULL THEN
        v_sta := CASE WHEN r.cscs_expiry < CURRENT_DATE THEN 'expired'::document_status ELSE 'verified'::document_status END;
        INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,verified_by,verified_at,created_at,updated_at)
        VALUES(gen_random_uuid(),v_org,r.id,'cscs_card',v_sta,r.cscs_expiry,v_vby,v_vat,v_vat-INTERVAL'12 days',v_vat);
      END IF;

      -- First aid (80% of tier 1/2)
      IF i % 5 != 0 THEN
        INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,verified_by,verified_at,created_at,updated_at)
        VALUES(gen_random_uuid(),v_org,r.id,'first_aid','verified'::document_status,
               CURRENT_DATE+(((i*61)%700)+180)::INTEGER,v_vby,v_vat,v_vat-INTERVAL'15 days',v_vat);
      END IF;

      -- Asbestos awareness (65%)
      IF i % 3 != 0 THEN
        INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,verified_by,verified_at,created_at,updated_at)
        VALUES(gen_random_uuid(),v_org,r.id,'asbestos_awareness','verified'::document_status,
               CURRENT_DATE+(((i*83)%700)+180)::INTEGER,v_vby,v_vat,v_vat-INTERVAL'20 days',v_vat);
      END IF;

    -- Tier 3: CSCS expired only
    ELSIF r.data_completeness_score BETWEEN 15 AND 19 AND r.cscs_expiry IS NOT NULL AND r.cscs_expiry < CURRENT_DATE THEN
      INSERT INTO documents(id,organization_id,operative_id,document_type,status,expiry_date,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.id,'cscs_card','expired'::document_status,r.cscs_expiry,v_vat-INTERVAL'30 days',v_vat);

    -- Tier 4: RTW pending
    ELSIF r.data_completeness_score BETWEEN 12 AND 18 AND r.rtw_type IS NOT NULL THEN
      INSERT INTO documents(id,organization_id,operative_id,document_type,status,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.id,'right_to_work','pending'::document_status,v_vat-INTERVAL'5 days',v_vat);
    END IF;

  END LOOP;
END $$;

-- ============================================================
-- PHASE 7: OPERATIVE_CSCS_CARDS + OPERATIVE_TRADES
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  r     RECORD;
  i     INTEGER := 0;
  v_sl  trade_skill_level;
BEGIN
  FOR r IN
    SELECT id, cscs_card_type, cscs_card_number, cscs_expiry, trade_category_id,
           data_completeness_score
    FROM operatives
    WHERE organization_id = v_org
    ORDER BY reference_number
  LOOP
    i := i + 1;

    -- CSCS card record
    IF r.cscs_card_number IS NOT NULL AND r.cscs_card_type IS NOT NULL THEN
      INSERT INTO operative_cscs_cards(id,operative_id,organization_id,card_type,card_number,expiry_date,is_primary,created_at)
      VALUES(gen_random_uuid(),r.id,v_org,r.cscs_card_type,r.cscs_card_number,r.cscs_expiry,true,
             NOW()-(((i*73)%300))::INTEGER*INTERVAL'1 day');
    END IF;

    -- Operative trades
    IF r.trade_category_id IS NOT NULL THEN
      v_sl := CASE ((i*5-1)%5)
        WHEN 0 THEN 'competent'::trade_skill_level
        WHEN 1 THEN 'skilled'::trade_skill_level
        WHEN 2 THEN 'skilled'::trade_skill_level
        WHEN 3 THEN 'advanced'::trade_skill_level
        ELSE        'expert'::trade_skill_level
      END;
      INSERT INTO operative_trades(id,operative_id,organization_id,trade_category_id,skill_level,is_primary,created_at)
      VALUES(gen_random_uuid(),r.id,v_org,r.trade_category_id,v_sl,true,
             NOW()-(((i*61)%400))::INTEGER*INTERVAL'1 day');
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PHASE 8: LABOUR REQUESTS + ALLOCATIONS
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID; v_u2 UUID; v_u3 UUID;

  -- Active site IDs
  active_sites UUID[] := ARRAY[
    '22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004',
    '22222222-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000006',
    '22222222-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000008',
    '22222222-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000010',
    '22222222-0000-0000-0000-000000000011','22222222-0000-0000-0000-000000000012',
    '22222222-0000-0000-0000-000000000013','22222222-0000-0000-0000-000000000014',
    '22222222-0000-0000-0000-000000000015','22222222-0000-0000-0000-000000000016',
    '22222222-0000-0000-0000-000000000017','22222222-0000-0000-0000-000000000018',
    '22222222-0000-0000-0000-000000000019','22222222-0000-0000-0000-000000000020',
    '22222222-0000-0000-0000-000000000021','22222222-0000-0000-0000-000000000022'];

  completed_sites UUID[] := ARRAY[
    '22222222-0000-0000-0000-000000000023','22222222-0000-0000-0000-000000000024',
    '22222222-0000-0000-0000-000000000025','22222222-0000-0000-0000-000000000026'];

  -- Trade IDs
  t_gw   UUID := '11111111-0000-0000-0000-000000000001';
  t_lab  UUID := '11111111-0000-0000-0000-000000000002';
  t_sca  UUID := '11111111-0000-0000-0000-000000000003';
  t_con  UUID := '11111111-0000-0000-0000-000000000004';
  t_sf   UUID := '11111111-0000-0000-0000-000000000005';
  t_p360 UUID := '11111111-0000-0000-0000-000000000006';
  t_bri  UUID := '11111111-0000-0000-0000-000000000008';
  t_dem  UUID := '11111111-0000-0000-0000-000000000009';
  t_sm   UUID := '11111111-0000-0000-0000-000000000010';

  trade_pool UUID[];

  s_idx INTEGER; j INTEGER; k INTEGER;
  v_site UUID; v_req UUID; v_req_id UUID;
  v_tid  UUID; v_hc INTEGER; v_dr DECIMAL;
  v_sd DATE; v_ed DATE; v_rst request_status;
  r     RECORD;
  alloc_i INTEGER := 0;
  v_cby UUID;
  v_alloc_sd DATE; v_alloc_ed DATE;
  v_alloc_status allocation_status;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  trade_pool := ARRAY[t_gw,t_lab,t_sca,t_con,t_sf,t_p360,t_bri,t_dem,t_sm];

  -- ── Labour requests: 4-6 per active site ──────────────────────
  FOR s_idx IN 1..22 LOOP
    v_site := active_sites[s_idx];
    FOR j IN 1..( 4 + (s_idx % 3) ) LOOP
      v_tid := trade_pool[((s_idx*3+j-1) % 9)+1];
      v_hc  := 2 + ((s_idx*j) % 8);
      v_dr  := 160 + ((s_idx*j*7) % 80);
      v_sd  := CURRENT_DATE - (((s_idx*j*11) % 120) + 10)::INTEGER;
      v_ed  := v_sd + (((s_idx*j*13) % 90) + 30)::INTEGER;
      v_rst := CASE ((s_idx+j) % 4) WHEN 0 THEN 'fulfilled'::request_status WHEN 1 THEN 'searching'::request_status WHEN 2 THEN 'partial'::request_status ELSE 'fulfilled'::request_status END;
      INSERT INTO labour_requests(id,organization_id,site_id,trade_category_id,headcount_required,headcount_filled,start_date,end_date,day_rate,status,requested_by,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,v_site,v_tid,v_hc,
             CASE WHEN v_rst='fulfilled' THEN v_hc WHEN v_rst='partial' THEN v_hc/2 ELSE 0 END,
             v_sd,v_ed,v_dr,v_rst,
             CASE (j%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END,
             v_sd::TIMESTAMPTZ - INTERVAL '3 days',v_sd::TIMESTAMPTZ - INTERVAL '1 day');
    END LOOP;
  END LOOP;

  -- Labour requests for completed sites (historical, all fulfilled)
  FOR s_idx IN 1..4 LOOP
    v_site := completed_sites[s_idx];
    FOR j IN 1..4 LOOP
      v_tid := trade_pool[((s_idx*5+j-1) % 9)+1];
      v_hc  := 3 + ((s_idx*j) % 6);
      v_sd  := CURRENT_DATE - (((s_idx*j*17) % 360) + 180)::INTEGER;
      v_ed  := v_sd + 60 + ((s_idx*j*7) % 60)::INTEGER;
      INSERT INTO labour_requests(id,organization_id,site_id,trade_category_id,headcount_required,headcount_filled,start_date,end_date,day_rate,status,requested_by,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,v_site,v_tid,v_hc,v_hc,v_sd,v_ed,155+((s_idx*j*7)%80),'fulfilled'::request_status,
             CASE (j%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END,
             v_sd::TIMESTAMPTZ-INTERVAL'3 days',v_sd::TIMESTAMPTZ-INTERVAL'1 day');
    END LOOP;
  END LOOP;

  -- ── Allocations: working operatives → active allocations ──────
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status='working'
    ORDER BY reference_number
  LOOP
    alloc_i := alloc_i + 1;
    v_site := active_sites[((alloc_i-1) % 22)+1];
    v_alloc_sd := CURRENT_DATE - (((alloc_i*7)%30)+5)::INTEGER;
    v_alloc_ed := CURRENT_DATE + (((alloc_i*13)%60)+14)::INTEGER;
    v_cby := CASE (alloc_i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,actual_start_date,agreed_day_rate,charge_rate,status,induction_completed,allocated_by,created_at,updated_at)
    VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,v_alloc_sd,
           r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),'active'::allocation_status,true,v_cby,
           v_alloc_sd::TIMESTAMPTZ-INTERVAL'1 day',NOW());
  END LOOP;

  -- ── Allocations: verified → confirmed (offer accepted, not started) ───
  alloc_i := 0;
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status='verified'
    ORDER BY reference_number
  LOOP
    alloc_i := alloc_i + 1;
    v_site := active_sites[((alloc_i-1) % 22)+1];
    v_alloc_sd := CURRENT_DATE + (((alloc_i*7)%14)+3)::INTEGER;
    v_alloc_ed := v_alloc_sd + (((alloc_i*11)%45)+14)::INTEGER;
    v_cby := CASE (alloc_i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,agreed_day_rate,charge_rate,status,offer_sent_at,offer_responded_at,induction_completed,allocated_by,created_at,updated_at)
    VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,
           r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),'confirmed'::allocation_status,
           NOW()-INTERVAL'2 days',NOW()-INTERVAL'1 day',false,v_cby,
           NOW()-INTERVAL'3 days',NOW()-INTERVAL'1 day');
  END LOOP;

  -- ── Allocations: pending offers (subset of pending_docs operatives) ───
  alloc_i := 0;
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status='pending_docs'
    ORDER BY reference_number LIMIT 80
  LOOP
    alloc_i := alloc_i + 1;
    v_site := active_sites[((alloc_i-1) % 22)+1];
    v_alloc_sd := CURRENT_DATE + (((alloc_i*3)%7)+1)::INTEGER;
    v_alloc_ed := v_alloc_sd + (((alloc_i*11)%30)+14)::INTEGER;
    INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,agreed_day_rate,charge_rate,status,offer_sent_at,offer_expires_at,allocated_by,created_at,updated_at)
    VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,
           r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),'pending'::allocation_status,
           NOW()-INTERVAL'4 hours',NOW()+INTERVAL'26 hours',v_u1,
           NOW()-INTERVAL'5 hours',NOW()-INTERVAL'4 hours');
  END LOOP;

  -- ── Historical completed allocations: available operatives (1-3 each) ───
  alloc_i := 0;
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status='available'
    ORDER BY reference_number
  LOOP
    alloc_i := alloc_i + 1;
    FOR k IN 1..(1+(alloc_i%3)) LOOP
      v_site := active_sites[((alloc_i*k-1) % 22)+1];
      v_alloc_sd := CURRENT_DATE-(((alloc_i*k*11)%365)+30)::INTEGER;
      v_alloc_ed := v_alloc_sd+(((alloc_i*k*7)%60)+21)::INTEGER;
      v_cby := CASE ((alloc_i+k)%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
      INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,actual_start_date,actual_end_date,agreed_day_rate,charge_rate,status,induction_completed,allocated_by,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,v_alloc_sd,v_alloc_ed,
             r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),'completed'::allocation_status,true,v_cby,
             v_alloc_sd::TIMESTAMPTZ-INTERVAL'2 days',v_alloc_ed::TIMESTAMPTZ);
    END LOOP;
  END LOOP;

  -- ── Completed allocations for completed sites ─────────────────
  alloc_i := 0;
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status IN ('available','unavailable')
    ORDER BY reference_number LIMIT 200
  LOOP
    alloc_i := alloc_i + 1;
    v_site := completed_sites[((alloc_i-1) % 4)+1];
    v_alloc_sd := CURRENT_DATE-(((alloc_i*13)%360)+120)::INTEGER;
    v_alloc_ed := v_alloc_sd+(((alloc_i*7)%60)+21)::INTEGER;
    v_cby := CASE (alloc_i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,actual_start_date,actual_end_date,agreed_day_rate,charge_rate,status,induction_completed,allocated_by,created_at,updated_at)
    VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,v_alloc_sd,v_alloc_ed,
           r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),'completed'::allocation_status,true,v_cby,
           v_alloc_sd::TIMESTAMPTZ-INTERVAL'2 days',v_alloc_ed::TIMESTAMPTZ);
  END LOOP;

  -- ── No-shows and terminated (blocked operatives) ──────────────
  alloc_i := 0;
  FOR r IN
    SELECT id, day_rate FROM operatives
    WHERE organization_id=v_org AND status='blocked'
    ORDER BY reference_number
  LOOP
    alloc_i := alloc_i + 1;
    v_site := active_sites[((alloc_i-1) % 22)+1];
    v_alloc_sd := CURRENT_DATE-(((alloc_i*17)%180)+30)::INTEGER;
    v_alloc_ed := v_alloc_sd+(((alloc_i*7)%30)+7)::INTEGER;
    v_alloc_status := CASE (alloc_i%3) WHEN 0 THEN 'no_show'::allocation_status WHEN 1 THEN 'terminated'::allocation_status ELSE 'terminated'::allocation_status END;
    INSERT INTO allocations(id,organization_id,operative_id,site_id,start_date,end_date,agreed_day_rate,charge_rate,status,allocated_by,notes,created_at,updated_at)
    VALUES(gen_random_uuid(),v_org,r.id,v_site,v_alloc_sd,v_alloc_ed,
           r.day_rate,ROUND((r.day_rate*1.35)::DECIMAL,2),v_alloc_status,v_u1,
           CASE WHEN v_alloc_status='no_show' THEN 'Operative failed to report for duty. NCR raised.' ELSE 'Terminated early due to conduct issue.' END,
           v_alloc_sd::TIMESTAMPTZ-INTERVAL'1 day',v_alloc_sd::TIMESTAMPTZ+INTERVAL'1 day');
  END LOOP;

END $$;

-- ============================================================
-- PHASE 9: PERFORMANCE REVIEWS (RAP — all completed allocations)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID; v_u2 UUID; v_u3 UUID;
  r     RECORD;
  i     INTEGER := 0;
  v_rel INTEGER; v_att INTEGER; v_per INTEGER; v_saf INTEGER;
  v_rvr UUID; v_sm_name TEXT; v_sm_phone TEXT;
  sm_names  TEXT[] := ARRAY['Kevin Hartley','Patricia Nolan','Derek Sims','Sandra Beech','Carl Jennings','Graham Ord','Pete Horner','Marcus Webb','Veronica Salt','Angus MacDonald','Robert Adkins','Annie Moss','Gill Carpenter','Steve Nuttall','Natalie Kirk'];
  sm_phones TEXT[] := ARRAY['+447801001001','+447801001003','+447801001005','+447801001007','+447801001009','+447801001015','+447801001017','+447801001031','+447801001033','+447801001043','+447801001023','+447801001025','+447801001029','+447801001041','+447801001021'];
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  FOR r IN
    SELECT a.id AS alloc_id, a.operative_id, a.end_date
    FROM allocations a
    WHERE a.organization_id=v_org AND a.status='completed'
    ORDER BY a.created_at
  LOOP
    i := i + 1;

    -- Bell curve: 40% green (4-5), 45% amber (3-3.9), 15% red (1-2.9)
    IF i % 10 < 4 THEN          -- green
      v_rel := 4+(i%2); v_att := 4+(i%2); v_per := 4+(i%2); v_saf := 4+(i%2);
    ELSIF i % 10 < 9 THEN       -- amber
      v_rel := 3+(i%2); v_att := 3; v_per := 3+(i%2); v_saf := 3;
    ELSE                         -- red
      v_rel := 1+(i%3); v_att := 2; v_per := 1+(i%2); v_saf := 2;
    END IF;

    v_rvr     := CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    v_sm_name  := sm_names[((i-1)%15)+1];
    v_sm_phone := sm_phones[((i-1)%15)+1];

    INSERT INTO performance_reviews(
      id,organization_id,operative_id,allocation_id,
      reviewer_id,site_manager_name,site_manager_phone,
      reliability_score,attitude_score,performance_score,safety_score,
      comment,submitted_via,created_at
    ) VALUES (
      gen_random_uuid(),v_org,r.operative_id,r.alloc_id,
      v_rvr,v_sm_name,v_sm_phone,
      v_rel,v_att,v_per,v_saf,
      CASE WHEN v_rel <= 2 OR v_att <= 2 OR v_per <= 2
           THEN CASE ((i*7)%5)
             WHEN 0 THEN 'Did not meet expectations on site. Attitude poor towards supervisor instructions.'
             WHEN 1 THEN 'Punctuality issues throughout assignment. Warned twice on site.'
             WHEN 2 THEN 'Substandard workmanship noted by site manager. Required rework.'
             WHEN 3 THEN 'Conduct issue — reported to labour manager. See NCR.'
             ELSE        'Safety concern raised. Did not follow PPE protocol on multiple occasions.'
           END
           ELSE NULL END,
      CASE (i%3) WHEN 0 THEN 'web' WHEN 1 THEN 'whatsapp' ELSE 'web' END,
      COALESCE(r.end_date::TIMESTAMPTZ, NOW()) + INTERVAL '1 day' - (((i*3)%5))::INTEGER * INTERVAL '1 hour'
    );
  END LOOP;
END $$;

-- ============================================================
-- PHASE 10: TIMESHEETS (first 400 completed allocations)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID; v_u2 UUID; v_u3 UUID;
  r     RECORD;
  i     INTEGER := 0;
  j     INTEGER;
  v_ts  UUID;
  v_week DATE; v_weeks INTEGER;
  v_hours DECIMAL; v_gross DECIMAL;
  v_tstat timesheet_status;
  v_sby UUID; v_aby UUID;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  FOR r IN
    SELECT a.id, a.operative_id, a.start_date, a.end_date, a.agreed_day_rate
    FROM allocations a
    WHERE a.organization_id=v_org AND a.status='completed'
      AND a.start_date IS NOT NULL AND a.end_date IS NOT NULL
    ORDER BY a.created_at
    LIMIT 400
  LOOP
    i := i + 1;
    v_weeks := LEAST(GREATEST(((r.end_date - r.start_date) / 7), 1), 12);
    v_sby := CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END;
    v_aby := CASE (i%3) WHEN 0 THEN v_u2 WHEN 1 THEN v_u1 ELSE v_u3 END;

    FOR j IN 1..v_weeks LOOP
      -- Week start = Monday of that week
      v_week := r.start_date + ((j-1)*7)::INTEGER;
      v_week := v_week - EXTRACT(DOW FROM v_week)::INTEGER + 1;
      IF v_week < '2024-01-01' THEN CONTINUE; END IF;

      v_hours := 37.5 + ((i*j*3)%25)*0.5;  -- 37.5 to 50h
      v_gross := ROUND((v_hours / 7.5 * r.agreed_day_rate)::DECIMAL, 2);

      v_tstat := CASE ((i+j)%5)
        WHEN 0 THEN 'locked'::timesheet_status
        WHEN 1 THEN 'submitted'::timesheet_status
        ELSE        'approved'::timesheet_status
      END;

      -- Insert timesheet, capture UUID, skip duplicate weeks
      v_ts := NULL;
      INSERT INTO timesheets(id,organization_id,operative_id,week_start,total_hours,total_days,gross_pay,day_rate_used,status,submitted_by,submitted_at,approved_by,approved_at,created_at,updated_at)
      VALUES(gen_random_uuid(),v_org,r.operative_id,v_week,v_hours,5,v_gross,r.agreed_day_rate,v_tstat,
             v_sby, (v_week+5)::TIMESTAMPTZ,
             CASE WHEN v_tstat IN ('approved','locked') THEN v_aby ELSE NULL END,
             CASE WHEN v_tstat IN ('approved','locked') THEN (v_week+7)::TIMESTAMPTZ ELSE NULL END,
             v_week::TIMESTAMPTZ, (v_week+7)::TIMESTAMPTZ)
      ON CONFLICT (operative_id, week_start) DO NOTHING
      RETURNING id INTO v_ts;

      IF v_ts IS NULL THEN CONTINUE; END IF;  -- duplicate week, skip entries

      -- Timesheet entries (Mon-Fri)
      INSERT INTO timesheet_entries(id,timesheet_id,entry_date,hours_worked,day_rate,is_manual)
      SELECT gen_random_uuid(), v_ts, v_week+s, 7.5, r.agreed_day_rate, false
      FROM generate_series(0,4) s;

    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- PHASE 11: NON-CONFORMANCE INCIDENTS (NCRs)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID; v_u2 UUID; v_u3 UUID;
  r     RECORD;
  i     INTEGER := 0;
  v_type ncr_type; v_sev ncr_severity;
  v_site UUID;
  active_sites UUID[] := ARRAY[
    '22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004',
    '22222222-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000006',
    '22222222-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000008',
    '22222222-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000010'];
  ncr_descs TEXT[] := ARRAY[
    'Operative failed to report to site on scheduled start date. No contact made until following day.',
    'Left site without authorisation at 14:30. Reason given — personal emergency, no notification to supervisor.',
    'Arrived 2 hours after scheduled start on three consecutive days. Verbal warning issued.',
    'PPE non-compliance observed — operative working without hard hat in designated zone.',
    'Conduct issue involving aggressive language directed at site manager. Witnessed by two operatives.',
    'Workmanship below required standard. RC pour required remediation. Signed off by QS.',
    'Refusal to follow supervisor instruction regarding safe working procedure. Recorded via CCTV.',
    'Appeared to be under the influence of alcohol on site. Breathalyser declined. Removed immediately.',
    'Walked off site mid-shift following dispute. Did not complete handover or notify supervisor.',
    'Failed mandatory induction refresh. Refused to attend rescheduled session.'];
  wit_names TEXT[] := ARRAY['Kevin Hartley','Graham Ord','Marcus Webb','Robert Adkins','Pete Horner','Carl Jennings','Angus MacDonald','Steve Nuttall','Patricia Nolan','Derek Sims'];
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  SELECT id INTO v_u2 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_2}}';
  SELECT id INTO v_u3 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_3}}';

  -- NCRs for blocked operatives (all severities)
  FOR r IN
    SELECT o.id AS op_id, a.id AS alloc_id, a.site_id
    FROM operatives o
    LEFT JOIN allocations a ON a.operative_id=o.id AND a.status IN ('no_show','terminated')
    WHERE o.organization_id=v_org AND o.status='blocked'
    ORDER BY o.reference_number
  LOOP
    i := i + 1;
    v_site := COALESCE(r.site_id, active_sites[((i-1)%10)+1]);

    v_type := CASE (i%9)
      WHEN 0 THEN 'no_show'::ncr_type WHEN 1 THEN 'walk_off'::ncr_type
      WHEN 2 THEN 'late_arrival'::ncr_type WHEN 3 THEN 'safety_breach'::ncr_type
      WHEN 4 THEN 'drugs_alcohol'::ncr_type WHEN 5 THEN 'conduct_issue'::ncr_type
      WHEN 6 THEN 'poor_attitude'::ncr_type WHEN 7 THEN 'poor_workmanship'::ncr_type
      ELSE 'safety_breach'::ncr_type
    END;
    -- 10% critical (auto-blocks), 30% major, 60% minor for blocked ops
    v_sev := CASE (i%10) WHEN 0 THEN 'critical'::ncr_severity WHEN 1 THEN 'critical'::ncr_severity WHEN 2 THEN 'major'::ncr_severity WHEN 3 THEN 'major'::ncr_severity WHEN 4 THEN 'major'::ncr_severity ELSE 'minor'::ncr_severity END;

    INSERT INTO non_conformance_incidents(
      id,organization_id,operative_id,allocation_id,site_id,
      incident_type,severity,incident_date,description,
      witness_name,reported_by,reported_via,
      resolved,resolved_by,resolved_at,resolution_notes,created_at
    ) VALUES (
      gen_random_uuid(),v_org,r.op_id,r.alloc_id,v_site,
      v_type,v_sev,
      CURRENT_DATE-(((i*17)%180)+7)::INTEGER,
      ncr_descs[((i-1)%10)+1],
      wit_names[((i-1)%10)+1],
      CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END,
      'web',
      (v_sev='minor'),
      CASE WHEN v_sev='minor' THEN v_u1 ELSE NULL END,
      CASE WHEN v_sev='minor' THEN (NOW()-(((i*7)%30))::INTEGER*INTERVAL'1 day') ELSE NULL END,
      CASE WHEN v_sev='minor' THEN 'Verbal warning issued. Operative advised of company policy. No further action.' ELSE NULL END,
      NOW()-(((i*17)%180)+5)::INTEGER*INTERVAL'1 day'
    );
  END LOOP;

  -- Additional NCRs for available operatives (minor/major only, non-blocking)
  i := 0;
  FOR r IN
    SELECT o.id AS op_id, a.site_id
    FROM operatives o
    JOIN allocations a ON a.operative_id=o.id AND a.status='completed'
    WHERE o.organization_id=v_org AND o.status='available'
    ORDER BY o.reference_number LIMIT 60
  LOOP
    i := i + 1;
    v_type := CASE (i%5) WHEN 0 THEN 'late_arrival'::ncr_type WHEN 1 THEN 'poor_attitude'::ncr_type WHEN 2 THEN 'no_show'::ncr_type WHEN 3 THEN 'conduct_issue'::ncr_type ELSE 'poor_workmanship'::ncr_type END;
    v_sev  := CASE (i%3) WHEN 0 THEN 'major'::ncr_severity ELSE 'minor'::ncr_severity END;
    INSERT INTO non_conformance_incidents(id,organization_id,operative_id,site_id,incident_type,severity,incident_date,description,reported_by,reported_via,resolved,resolved_by,resolved_at,resolution_notes,created_at)
    VALUES(gen_random_uuid(),v_org,r.op_id,r.site_id,v_type,v_sev,
           CURRENT_DATE-(((i*23)%200)+14)::INTEGER,
           ncr_descs[((i-1)%10)+1],
           CASE (i%3) WHEN 0 THEN v_u1 WHEN 1 THEN v_u2 ELSE v_u3 END,'web',
           true,v_u2,NOW()-(((i*5)%20))::INTEGER*INTERVAL'1 day',
           'Matter resolved. Operative reminded of site expectations. No further action required.',
           NOW()-(((i*23)%200)+12)::INTEGER*INTERVAL'1 day');
  END LOOP;
END $$;

-- ============================================================
-- PHASE 12: MESSAGE THREADS + MESSAGES (WhatsApp inbox)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  r     RECORD;
  i     INTEGER := 0;
  v_tid UUID;
  v_now TIMESTAMPTZ;
  v_msg_out TEXT[] := ARRAY[
    'Hi {{name}}, this is Amber from Pillar 43 Construction. We have a position available that matches your profile. Are you available for work?',
    'Hi {{name}}, we have an urgent requirement at one of our sites in your area. Day rate is competitive. Can you start Monday?',
    'Hi {{name}}, just following up on the job offer we sent yesterday. Have you had a chance to consider it?',
    'Hi {{name}}, could you please confirm your availability for next week? We have a client waiting.',
    'Hi {{name}}, your CSCS card details need updating on your profile. Could you send us a photo of your current card?',
    'Hi {{name}}, great news — your documents have been verified. You are now ready for allocation. We will be in touch shortly.',
    'Hi {{name}}, please confirm receipt of this message. We need to update your bank details for payroll.',
    'Hi {{name}}, your right-to-work document is due to expire soon. Please upload a renewed copy at your earliest convenience.'];
  v_msg_in TEXT[] := ARRAY[
    'Yes sounds good, what site?',
    'Monday works for me. What time do I need to be there?',
    'Yes I am available. Can you tell me more about the role?',
    'Confirmed, I will be there. Is PPE provided?',
    'OK I will send the photo now.',
    'Great, looking forward to it.',
    'Done, I have updated my details.',
    'I have uploaded the new document.',
    'Can you let me know the pay rate?',
    'Yes available Monday through Friday.'];
BEGIN
  FOR r IN
    SELECT o.id, o.first_name, o.phone
    FROM operatives o
    WHERE o.organization_id=v_org AND o.status IN ('working','available','verified','pending_docs')
    ORDER BY o.reference_number
    LIMIT 900
  LOOP
    i := i + 1;
    v_now := NOW() - (((i*7)%60))::INTEGER * INTERVAL '1 day';

    INSERT INTO message_threads(id,organization_id,operative_id,phone_number,last_message,last_message_at,unread_count,created_at)
    VALUES(gen_random_uuid(),v_org,r.id,r.phone,
           'Yes sounds good, what site?',
           v_now + INTERVAL '2 hours',
           CASE WHEN i%8=0 THEN 1 ELSE 0 END,
           v_now - INTERVAL '1 hour')
    ON CONFLICT (phone_number, organization_id) DO NOTHING
    RETURNING id INTO v_tid;

    IF v_tid IS NULL THEN CONTINUE; END IF;

    -- Outbound message 1
    INSERT INTO messages(id,organization_id,thread_id,operative_id,channel,direction,body,status,created_at)
    VALUES(gen_random_uuid(),v_org,v_tid,r.id,'whatsapp','outbound',
           replace(v_msg_out[((i-1)%8)+1],'{{name}}',r.first_name),
           'delivered', v_now);

    -- Inbound reply
    INSERT INTO messages(id,organization_id,thread_id,operative_id,channel,direction,body,status,created_at)
    VALUES(gen_random_uuid(),v_org,v_tid,r.id,'whatsapp','inbound',
           v_msg_in[((i-1)%10)+1],
           'received', v_now + INTERVAL '45 minutes');

    -- Second outbound (for 60% of threads)
    IF i % 5 != 0 THEN
      INSERT INTO messages(id,organization_id,thread_id,operative_id,channel,direction,body,status,created_at)
      VALUES(gen_random_uuid(),v_org,v_tid,r.id,'whatsapp','outbound',
             replace(v_msg_out[((i*3)%8)+1],'{{name}}',r.first_name),
             'delivered', v_now + INTERVAL '90 minutes');
    END IF;

    -- Third inbound (for 40%)
    IF i % 5 < 2 THEN
      INSERT INTO messages(id,organization_id,thread_id,operative_id,channel,direction,body,status,created_at)
      VALUES(gen_random_uuid(),v_org,v_tid,r.id,'whatsapp','inbound',
             v_msg_in[((i*5)%10)+1],
             'received', v_now + INTERVAL '2 hours');
    END IF;

  END LOOP;
END $$;

-- ============================================================
-- PHASE 13: WORK HISTORY (operative profile page)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  r     RECORD;
  i     INTEGER := 0;
  employers TEXT[] := ARRAY[
    'Balfour Beatty','Kier Group','Galliford Try','Morgan Sindall','Vinci Construction',
    'Wates Group','Mace Group','Sir Robert McAlpine','Laing O''Rourke','Willmott Dixon',
    'McLaughlin & Harvey','BAM Nuttall','Bowmer & Kirkland','Robertson Group','Tilbury Douglas',
    'Seddon Group','Esh Construction','Engie UK','Wates Construction','Bouygues UK',
    'Self-employed','Carmichael UK','PCL Construction','Costain Group','Skanska UK'];
  job_titles TEXT[] := ARRAY[
    'Groundworker','Senior Groundworker','Drainage Operative','Excavator Operator','General Labourer',
    'Scaffolder','Concrete Finisher','Steel Fixer','Bricklayer','Demolition Operative',
    'Site Operative','Plant Operator','Labourer','Banksman','Shuttering Carpenter',
    'Kerb Layer','Pipelayer','Traffic Marshal','Pavior','Site Manager'];
BEGIN
  FOR r IN
    SELECT o.id, o.experience_years, o.start_date
    FROM operatives o
    WHERE o.organization_id=v_org AND o.data_completeness_score >= 14
    ORDER BY o.reference_number
    LIMIT 800
  LOOP
    i := i + 1;
    -- Previous role (before Pillar 43)
    INSERT INTO work_history(id,operative_id,organization_id,job_title,employer,description,start_date,end_date,source,created_at)
    VALUES(gen_random_uuid(),r.id,v_org,
           job_titles[((i*7-1)%20)+1],
           employers[((i*3-1)%25)+1],
           'Groundworks, drainage and civil engineering works on a range of commercial and residential projects.',
           COALESCE(r.start_date, CURRENT_DATE) - (((i*47)%1000)+365)::INTEGER,
           COALESCE(r.start_date, CURRENT_DATE) - (((i*7)%30)+1)::INTEGER,
           'manual', NOW()-(((i*31)%200))::INTEGER*INTERVAL'1 day');

    -- Earlier role (50% of operatives)
    IF i % 2 = 0 THEN
      INSERT INTO work_history(id,operative_id,organization_id,job_title,employer,start_date,end_date,source,created_at)
      VALUES(gen_random_uuid(),r.id,v_org,
             job_titles[((i*11-1)%20)+1],
             employers[((i*5-1)%25)+1],
             COALESCE(r.start_date, CURRENT_DATE) - (((i*47)%1000)+730)::INTEGER,
             COALESCE(r.start_date, CURRENT_DATE) - (((i*47)%1000)+380)::INTEGER,
             'manual', NOW()-(((i*31)%200))::INTEGER*INTERVAL'1 day');
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PHASE 14: OPERATIVE PAY RATES (pay history tab)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID;
  r     RECORD;
  i     INTEGER := 0;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';
  FOR r IN
    SELECT o.id, o.day_rate, o.start_date
    FROM operatives o
    WHERE o.organization_id=v_org AND o.day_rate IS NOT NULL
    ORDER BY o.reference_number LIMIT 700
  LOOP
    i := i + 1;
    -- Current rate
    INSERT INTO operative_pay_rates(id,operative_id,organization_id,day_rate,rate_type,grade,effective_date,rationale,changed_by,created_at)
    VALUES(gen_random_uuid(),r.id,v_org,r.day_rate,'day_rate','Standard',
           COALESCE(r.start_date, CURRENT_DATE - (((i*31)%200)+30)::INTEGER),
           'Rate agreed at onboarding based on trade and experience.',
           v_u1, NOW()-(((i*31)%200))::INTEGER*INTERVAL'1 day');

    -- Previous rate (40% had a pay rise)
    IF i % 5 < 2 THEN
      INSERT INTO operative_pay_rates(id,operative_id,organization_id,day_rate,rate_type,grade,effective_date,rationale,changed_by,created_at)
      VALUES(gen_random_uuid(),r.id,v_org,ROUND((r.day_rate * 0.94)::DECIMAL,2),'day_rate','Standard',
             COALESCE(r.start_date, CURRENT_DATE) - (((i*31)%200)+200)::INTEGER,
             'Initial rate. Revised after 3-month review.',
             v_u1, NOW()-(((i*31)%200)+200)::INTEGER*INTERVAL'1 day');
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PHASE 15: NOTIFICATIONS (activity feed / notification bell)
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  i     INTEGER;
  notif_types TEXT[] := ARRAY['new_operative','doc_uploaded','doc_verified','doc_rejected','allocation_confirmed','offer_accepted','offer_declined','ncr_raised','rap_submitted','operative_blocked','timesheet_submitted','timesheet_approved'];
  notif_titles TEXT[] := ARRAY['New operative registered','Document uploaded for review','Document verified','Document rejected','Allocation confirmed','Job offer accepted','Job offer declined','NCR raised','RAP review submitted','Operative blocked','Timesheet submitted','Timesheet approved'];
  notif_bodies TEXT[] := ARRAY[
    'A new operative has registered via WhatsApp and is awaiting qualification.',
    'An operative has uploaded a document that requires your review.',
    'A document has been verified and the operative profile updated.',
    'A document has been rejected. The operative has been notified.',
    'An operative has confirmed their allocation and will start as scheduled.',
    'An operative has accepted the job offer. Allocation is now confirmed.',
    'An operative has declined the job offer. The next candidate has been notified.',
    'A non-conformance report has been raised and requires review.',
    'A site manager has submitted a RAP performance review.',
    'An operative has been blocked following a critical NCR.',
    'A timesheet has been submitted and is awaiting approval.',
    'A timesheet has been approved and is ready for payroll.'];
BEGIN
  FOR i IN 1..150 LOOP
    INSERT INTO notifications(id,organization_id,type,title,body,severity,read,read_at,created_at)
    VALUES(
      gen_random_uuid(),v_org,
      notif_types[((i-1)%12)+1],
      notif_titles[((i-1)%12)+1],
      notif_bodies[((i-1)%12)+1],
      CASE (i%5) WHEN 0 THEN 'critical' WHEN 1 THEN 'warning' ELSE 'info' END,
      (i > 20),
      CASE WHEN i > 20 THEN NOW()-(((i*3)%10))::INTEGER*INTERVAL'1 hour' ELSE NULL END,
      NOW()-(((i*7)%60))::INTEGER*INTERVAL'1 hour'
    );
  END LOOP;
END $$;

-- ============================================================
-- PHASE 16: WORKFLOW RUNS + TARGETS + EVENTS
-- ============================================================

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000002';
  v_u1  UUID;
  r     RECORD;
  i     INTEGER := 0;
  v_run UUID;
  v_wf_types TEXT[] := ARRAY['document_chase','data_collection','job_offer','profile_completion','re_engagement'];
  v_wf_status workflow_run_status;
BEGIN
  SELECT id INTO v_u1 FROM users WHERE auth_user_id = '{{AUTH_USER_ID_1}}';

  FOR i IN 1..25 LOOP
    v_run := gen_random_uuid();
    v_wf_status := CASE (i%4) WHEN 0 THEN 'active'::workflow_run_status WHEN 1 THEN 'completed'::workflow_run_status WHEN 2 THEN 'completed'::workflow_run_status ELSE 'completed'::workflow_run_status END;

    INSERT INTO workflow_runs(
      id,organization_id,workflow_type,status,triggered_by,triggered_by_user,
      channel,follow_up_hours,max_follow_ups,
      total_targets,targets_contacted,targets_responded,targets_completed,targets_failed,
      created_at,updated_at,completed_at
    ) VALUES (
      v_run,v_org,
      v_wf_types[((i-1)%5)+1],
      v_wf_status,
      CASE (i%2) WHEN 0 THEN 'rex' ELSE 'user' END,
      v_u1,'whatsapp',24,2,
      10+((i*3)%15), 10+((i*3)%15),
      7+((i*3)%12), 6+((i*3)%10), 1+(i%3),
      NOW()-(((i*3)%30))::INTEGER*INTERVAL'1 day',
      NOW()-(((i*3)%30)-1)::INTEGER*INTERVAL'1 day',
      CASE WHEN v_wf_status='completed' THEN NOW()-(((i*3)%30)-2)::INTEGER*INTERVAL'1 day' ELSE NULL END
    );

    -- Add targets (5 per run from pending_docs operatives)
    FOR r IN
      SELECT o.id FROM operatives o
      WHERE o.organization_id=v_org AND o.status='pending_docs'
      ORDER BY o.reference_number OFFSET ((i-1)*5) LIMIT 5
    LOOP
      INSERT INTO workflow_targets(id,workflow_run_id,operative_id,status,messages_sent,last_contacted_at,response_text,response_at,created_at,updated_at)
      VALUES(gen_random_uuid(),v_run,r.id,
             CASE (i%5) WHEN 0 THEN 'pending'::workflow_target_status WHEN 1 THEN 'completed'::workflow_target_status WHEN 2 THEN 'responded'::workflow_target_status ELSE 'contacted'::workflow_target_status END,
             2+(i%2),NOW()-(((i*3)%15))::INTEGER*INTERVAL'1 day',
             CASE WHEN i%5 IN (1,2) THEN 'OK will do' ELSE NULL END,
             CASE WHEN i%5 IN (1,2) THEN NOW()-(((i*3)%15)-1)::INTEGER*INTERVAL'1 day' ELSE NULL END,
             NOW()-(((i*3)%30))::INTEGER*INTERVAL'1 day',
             NOW()-(((i*3)%30)-1)::INTEGER*INTERVAL'1 day')
      ON CONFLICT (workflow_run_id, operative_id) DO NOTHING;
    END LOOP;

  END LOOP;
END $$;

-- ============================================================
-- ALL DONE — Pillar 43 Construction seed complete
-- 1,200 operatives | 28 sites | full allocations | timesheets
-- Login: demo@demo.com / demo123
-- ============================================================
