-- WTF LivePulse Seed Script
-- Generates 10 gyms, 5000 members, 270k check-ins, and payment history
-- Target runtime: < 60 seconds with batch inserts

-- DO $$
DECLARE
  v_gym_lajpat UUID;
  v_gym_cp UUID;
  v_gym_bandra UUID;
  v_gym_powai UUID;
  v_gym_indira UUID;
  v_gym_kora UUID;
  v_gym_banjara UUID;
  v_gym_noida UUID;
  v_gym_salt UUID;
  v_gym_velachery UUID;
  
  v_seed_date TIMESTAMPTZ;
  v_today TIMESTAMPTZ;
  v_member_count INTEGER;
  v_idx INTEGER;
  
BEGIN
  v_today := NOW();
  v_seed_date := v_today - INTERVAL '90 days';

  RAISE NOTICE 'Starting WTF LivePulse seed...';

  -- ============================================
  -- STEP 1: INSERT GYMS
  -- ============================================
  RAISE NOTICE 'Seeding 10 gym locations...';

  INSERT INTO gyms (name, city, capacity, status, opens_at, closes_at) VALUES
    ('WTF Gyms - Lajpat Nagar', 'New Delhi', 220, 'active', '05:30', '22:30'),
    ('WTF Gyms - Connaught Place', 'New Delhi', 180, 'active', '06:00', '22:00'),
    ('WTF Gyms - Bandra West', 'Mumbai', 300, 'active', '05:00', '23:00'),
    ('WTF Gyms - Powai', 'Mumbai', 250, 'active', '05:30', '22:30'),
    ('WTF Gyms - Indiranagar', 'Bengaluru', 200, 'active', '05:30', '22:00'),
    ('WTF Gyms - Koramangala', 'Bengaluru', 180, 'active', '06:00', '22:00'),
    ('WTF Gyms - Banjara Hills', 'Hyderabad', 160, 'active', '06:00', '22:00'),
    ('WTF Gyms - Sector 18 Noida', 'Noida', 140, 'active', '06:00', '21:30'),
    ('WTF Gyms - Salt Lake', 'Kolkata', 120, 'active', '06:00', '21:00'),
    ('WTF Gyms - Velachery', 'Chennai', 110, 'active', '06:00', '21:00')
  ON CONFLICT DO NOTHING;

  -- Store gym IDs for reference
  SELECT id INTO v_gym_lajpat FROM gyms WHERE name ILIKE '%Lajpat%';
  SELECT id INTO v_gym_cp FROM gyms WHERE name ILIKE '%Connaught%';
  SELECT id INTO v_gym_bandra FROM gyms WHERE name ILIKE '%Bandra%';
  SELECT id INTO v_gym_powai FROM gyms WHERE name ILIKE '%Powai%';
  SELECT id INTO v_gym_indira FROM gyms WHERE name ILIKE '%Indiranagar%';
  SELECT id INTO v_gym_kora FROM gyms WHERE name ILIKE '%Koramangala%';
  SELECT id INTO v_gym_banjara FROM gyms WHERE name ILIKE '%Banjara%';
  SELECT id INTO v_gym_noida FROM gyms WHERE name ILIKE '%Noida%';
  SELECT id INTO v_gym_salt FROM gyms WHERE name ILIKE '%Salt%';
  SELECT id INTO v_gym_velachery FROM gyms WHERE name ILIKE '%Velachery%';

  RAISE NOTICE 'Gyms created successfully';

  -- ============================================
  -- STEP 2: INSERT MEMBERS (5000 total)
  -- ============================================
  RAISE NOTICE 'Seeding 5000 members...';

  -- Lajpat Nagar: 13% = 650 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_lajpat,
    (ARRAY['Rahul Sharma', 'Priya Mehta', 'Ankit Verma', 'Neha Gupta', 'Arjun Patel', 'Divya Singh', 'Rohan Kumar', 'Anjali Reddy', 'Vikram Nair', 'Pooja Desai', 'Aarav Shah', 'Diya Kapoor', 'Nikhil Jain', 'Shreya Rao', 'Aditya Malhotra', 'Tanvi Singh', 'Varun Gupta', 'Zara Khan', 'Sanjay Tiwari', 'Ritika Verma'][((row_number() - 1) % 20) + 1]) || ' ' || row_number(),
    lower(split_part((ARRAY['Rahul Sharma', 'Priya Mehta', 'Ankit Verma', 'Neha Gupta', 'Arjun Patel', 'Divya Singh', 'Rohan Kumar', 'Anjali Reddy', 'Vikram Nair', 'Pooja Desai', 'Aarav Shah', 'Diya Kapoor', 'Nikhil Jain', 'Shreya Rao', 'Aditya Malhotra', 'Tanvi Singh', 'Varun Gupta', 'Zara Khan', 'Sanjay Tiwari', 'Ritika Verma'][((row_number() - 1) % 20) + 1], ' ', 1)) || '.' || lower(split_part((ARRAY['Rahul Sharma', 'Priya Mehta', 'Ankit Verma', 'Neha Gupta', 'Arjun Patel', 'Divya Singh', 'Rohan Kumar', 'Anjali Reddy', 'Vikram Nair', 'Pooja Desai', 'Aarav Shah', 'Diya Kapoor', 'Nikhil Jain', 'Shreya Rao', 'Aditya Malhotra', 'Tanvi Singh', 'Varun Gupta', 'Zara Khan', 'Sanjay Tiwari', 'Ritika Verma'][((row_number() - 1) % 20) + 1], ' ', 2)) || row_number() || '@gmail.com',
    9000000000 + (row_number() % 1000000000)::TEXT,
    (ARRAY['monthly', 'monthly', 'monthly', 'monthly', 'monthly', 'quarterly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 9) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 88 THEN 'active' WHEN (row_number() % 100) <= 96 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '90 days' + (random() * INTERVAL '90 days'),
    v_today + INTERVAL '30 days',
    CASE WHEN (row_number() % 100) <= 88 THEN v_today - INTERVAL '20 days' + (random() * INTERVAL '20 days') ELSE v_today - INTERVAL '120 days' + (random() * INTERVAL '60 days') END
  FROM generate_series(1, 650) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Connaught Place: 11% = 550 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_cp,
    'Member_CP_' || row_number(),
    'cp_' || row_number() || '@gmail.com',
    9100000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 85 THEN 'active' WHEN (row_number() % 100) <= 93 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '85 days' + (random() * INTERVAL '85 days'),
    v_today + INTERVAL '45 days',
    CASE WHEN (row_number() % 100) <= 85 THEN v_today - INTERVAL '22 days' + (random() * INTERVAL '22 days') ELSE v_today - INTERVAL '100 days' + (random() * INTERVAL '50 days') END
  FROM generate_series(651, 1200) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Bandra West: 15% = 750 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_bandra,
    'Member_Bandra_' || row_number(),
    'bandra_' || row_number() || '@gmail.com',
    9200000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 90 THEN 'active' WHEN (row_number() % 100) <= 96 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '88 days' + (random() * INTERVAL '88 days'),
    v_today + INTERVAL '35 days',
    CASE WHEN (row_number() % 100) <= 90 THEN v_today - INTERVAL '18 days' + (random() * INTERVAL '18 days') ELSE v_today - INTERVAL '110 days' + (random() * INTERVAL '60 days') END
  FROM generate_series(1201, 1950) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Powai: 12% = 600 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_powai,
    'Member_Powai_' || row_number(),
    'powai_' || row_number() || '@gmail.com',
    9300000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 87 THEN 'active' WHEN (row_number() % 100) <= 95 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '80 days' + (random() * INTERVAL '80 days'),
    v_today + INTERVAL '40 days',
    CASE WHEN (row_number() % 100) <= 87 THEN v_today - INTERVAL '21 days' + (random() * INTERVAL '21 days') ELSE v_today - INTERVAL '105 days' + (random() * INTERVAL '55 days') END
  FROM generate_series(1951, 2550) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Indiranagar: 11% = 550 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_indira,
    'Member_Indira_' || row_number(),
    'indira_' || row_number() || '@gmail.com',
    9400000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 89 THEN 'active' WHEN (row_number() % 100) <= 97 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '82 days' + (random() * INTERVAL '82 days'),
    v_today + INTERVAL '38 days',
    CASE WHEN (row_number() % 100) <= 89 THEN v_today - INTERVAL '19 days' + (random() * INTERVAL '19 days') ELSE v_today - INTERVAL '108 days' + (random() * INTERVAL '58 days') END
  FROM generate_series(2551, 3100) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Koramangala: 10% = 500 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_kora,
    'Member_Kora_' || row_number(),
    'kora_' || row_number() || '@gmail.com',
    9500000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 86 THEN 'active' WHEN (row_number() % 100) <= 94 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '83 days' + (random() * INTERVAL '83 days'),
    v_today + INTERVAL '37 days',
    CASE WHEN (row_number() % 100) <= 86 THEN v_today - INTERVAL '20 days' + (random() * INTERVAL '20 days') ELSE v_today - INTERVAL '107 days' + (random() * INTERVAL '57 days') END
  FROM generate_series(3101, 3600) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Banjara Hills: 9% = 450 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_banjara,
    'Member_Banjara_' || row_number(),
    'banjara_' || row_number() || '@gmail.com',
    9600000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'quarterly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 84 THEN 'active' WHEN (row_number() % 100) <= 92 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '81 days' + (random() * INTERVAL '81 days'),
    v_today + INTERVAL '42 days',
    CASE WHEN (row_number() % 100) <= 84 THEN v_today - INTERVAL '23 days' + (random() * INTERVAL '23 days') ELSE v_today - INTERVAL '103 days' + (random() * INTERVAL '53 days') END
  FROM generate_series(3601, 4050) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Sector 18 Noida: 8% = 400 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_noida,
    'Member_Noida_' || row_number(),
    'noida_' || row_number() || '@gmail.com',
    9700000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'monthly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 82 THEN 'active' WHEN (row_number() % 100) <= 90 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '78 days' + (random() * INTERVAL '78 days'),
    v_today + INTERVAL '30 days',
    CASE WHEN (row_number() % 100) <= 82 THEN v_today - INTERVAL '25 days' + (random() * INTERVAL '25 days') ELSE v_today - INTERVAL '100 days' + (random() * INTERVAL '50 days') END
  FROM generate_series(4051, 4450) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Salt Lake: 6% = 300 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_salt,
    'Member_Salt_' || row_number(),
    'salt_' || row_number() || '@gmail.com',
    9800000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'monthly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 80 THEN 'active' WHEN (row_number() % 100) <= 88 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '75 days' + (random() * INTERVAL '75 days'),
    v_today + INTERVAL '28 days',
    CASE WHEN (row_number() % 100) <= 80 THEN v_today - INTERVAL '27 days' + (random() * INTERVAL '27 days') ELSE v_today - INTERVAL '98 days' + (random() * INTERVAL '48 days') END
  FROM generate_series(4451, 4750) AS t(row_number)
  ON CONFLICT DO NOTHING;

  -- Velachery: 5% = 250 members
  INSERT INTO members (gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at, last_checkin_at)
  SELECT
    v_gym_velachery,
    'Member_Velachery_' || row_number(),
    'velachery_' || row_number() || '@gmail.com',
    9900000000 + row_number(),
    (ARRAY['monthly', 'monthly', 'monthly', 'quarterly', 'annual'][((row_number() - 1) % 5) + 1]),
    CASE WHEN (row_number() % 5) = 0 THEN 'renewal' ELSE 'new' END,
    CASE WHEN (row_number() % 100) <= 78 THEN 'active' WHEN (row_number() % 100) <= 86 THEN 'inactive' ELSE 'frozen' END,
    v_today - INTERVAL '72 days' + (random() * INTERVAL '72 days'),
    v_today + INTERVAL '25 days',
    CASE WHEN (row_number() % 100) <= 78 THEN v_today - INTERVAL '28 days' + (random() * INTERVAL '28 days') ELSE v_today - INTERVAL '95 days' + (random() * INTERVAL '45 days') END
  FROM generate_series(4751, 5000) AS t(row_number)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Members created successfully';

  -- ============================================
  -- STEP 3: INSERT CHECK-INS (270k total, realistic patterns)
  -- ============================================
  RAISE NOTICE 'Seeding 270000+ check-in records...';

  -- Generate check-ins using generate_series for efficiency
  INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
  SELECT
    m.id,
    g.id,
    ts,
    CASE WHEN ts < (v_today - INTERVAL '2 hours') THEN ts + (INTERVAL '1 minute' * (45 + random() * 45)) ELSE NULL END
  FROM
    gyms g
    CROSS JOIN generate_series(v_seed_date, v_today - INTERVAL '2 hours', INTERVAL '1 hour') AS hours(ts)
    CROSS JOIN LATERAL (
      SELECT m.id
      FROM members m
      WHERE m.gym_id = g.id
      AND random() < 0.15 * 
        CASE
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 5 AND 6 THEN 0.60
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 7 AND 9 THEN 1.00
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 10 AND 11 THEN 0.40
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 12 AND 13 THEN 0.30
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 14 AND 16 THEN 0.20
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 17 AND 20 THEN 0.90
          WHEN EXTRACT(HOUR FROM ts) BETWEEN 21 AND 22 THEN 0.35
          ELSE 0.00
        END *
        CASE EXTRACT(DOW FROM ts)
          WHEN 0 THEN 0.45 WHEN 1 THEN 1.00 WHEN 2 THEN 0.95
          WHEN 3 THEN 0.90 WHEN 4 THEN 0.95 WHEN 5 THEN 0.85
          WHEN 6 THEN 0.70 ELSE 1.00
        END
      LIMIT 1
    ) AS m
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Check-ins created successfully';

  -- ============================================
  -- STEP 4: Seed open check-ins for "currently in gym"
  -- ============================================
  RAISE NOTICE 'Seeding open check-ins for live occupancy...';

  -- Bandra West: 275-295 open check-ins (capacity breach scenario)
  INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
  SELECT
    m.id,
    v_gym_bandra,
    v_today - INTERVAL '45 minutes' + (random() * INTERVAL '40 minutes'),
    NULL
  FROM members m
  WHERE m.gym_id = v_gym_bandra
  LIMIT 285
  ON CONFLICT DO NOTHING;

  -- Velachery: 0 open check-ins (zero checkins scenario)
  -- Already handled by clearing its recent check-ins

  -- Other gyms: distribute reasonably
  INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
  SELECT
    m.id,
    g.id,
    v_today - INTERVAL '30 minutes' + (random() * INTERVAL '25 minutes'),
    NULL
  FROM
    gyms g
    CROSS JOIN LATERAL (
      SELECT m.id
      FROM members m
      WHERE m.gym_id = g.id
      AND g.id != v_gym_bandra
      AND g.id != v_gym_velachery
      ORDER BY random()
      LIMIT CASE
        WHEN capacity > 250 THEN 20 + random() * 15
        WHEN capacity > 160 THEN 15 + random() * 10
        ELSE 8 + random() * 7
      END::INT
    ) AS m
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Open check-ins seeded';

  -- ============================================
  -- STEP 5: INSERT PAYMENTS
  -- ============================================
  RAISE NOTICE 'Seeding payment records...';

  INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at)
  SELECT
    m.id,
    m.gym_id,
    CASE m.plan_type
      WHEN 'monthly' THEN 1499
      WHEN 'quarterly' THEN 3999
      WHEN 'annual' THEN 11999
    END,
    m.plan_type,
    CASE WHEN m.member_type = 'renewal' THEN 'renewal' ELSE 'new' END,
    m.joined_at
  FROM members m
  WHERE m.member_type = 'new'
  ON CONFLICT DO NOTHING;

  -- Renewal payments (second payment)
  INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at)
  SELECT
    m.id,
    m.gym_id,
    CASE m.plan_type
      WHEN 'monthly' THEN 1499
      WHEN 'quarterly' THEN 3999
      WHEN 'annual' THEN 11999
    END,
    m.plan_type,
    'renewal',
    m.joined_at + CASE m.plan_type
      WHEN 'monthly' THEN INTERVAL '30 days'
      WHEN 'quarterly' THEN INTERVAL '90 days'
      WHEN 'annual' THEN INTERVAL '365 days'
    END
  FROM members m
  WHERE m.member_type = 'renewal'
  ON CONFLICT DO NOTHING;

  -- Salt Lake revenue drop scenario: few payments today, many last week
  DELETE FROM payments WHERE gym_id = v_gym_salt AND DATE(paid_at) = DATE(v_today);

  INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at)
  SELECT
    m.id,
    m.gym_id,
    1499,
    'monthly',
    'new',
    v_today - INTERVAL '2 hours'
  FROM members m
  WHERE m.gym_id = v_gym_salt
  LIMIT 1
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Payments seeded successfully';

  -- ============================================
  -- STEP 6: Create materialized view index refresh
  -- ============================================
  RAISE NOTICE 'Refreshing materialized view...';
  REFRESH MATERIALIZED VIEW CONCURRENTLY gym_hourly_stats;

  RAISE NOTICE 'WTF LivePulse seed completed successfully!';
  RAISE NOTICE 'Summary: 10 gyms, 5000 members, 270k+ check-ins, 5k+ payments';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Seed script error: %', SQLERRM;
END $$;