-- 0005_import_contacts.sql
-- Import contacts from CSV as items with phone and email cell values

DO $$
DECLARE
  board_id_val uuid := 'eeb8bc91-f7ad-414e-966a-a7c287d9a6b0';
  phone_column_id_val uuid := 'b5f2fde4-cae9-4279-a849-9eadf704556e';
  email_column_id_val uuid := '51002f09-23e8-4188-bce3-1e2c0e14829f';
  next_pos integer;
  item_id_val uuid;
  contact_name text;
  contact_phone text;
  contact_email text;
  contacts_data text[][] := ARRAY[
    ['Indrek Millert', '56876576', 'millertindrek@gmail.com'],
    ['Admin', '55555565', 'indrek@terma.ee'],
    ['Ahti Urb', '+3725041972', 'ahti.urb@gmail.com'],
    ['Alek Svistun', '56497312', 'aleks2702@gmail.com'],
    ['Andres Kaev', '+37256203104', 'cotcas@gmail.com'],
    ['Andrus Kuldkepp', '57430872', 'andrus.kuldkepp@gmail.com'],
    ['Anti Randalu', '5296171', 'anti.randalu@gmail.com'],
    ['Arno Sotter', '55618575', 'arnosotter@hotmail.com'],
    ['Artjom', '+37253475960', 'artjom01@gmail.com'],
    ['Ave Kruus', '51925050', 'kruusave@gmail.com'],
    ['Avishek Tarun', '53022130', 'avishek.tarun+st@gmail.com'],
    ['Deniss Juganson', '55502207', 'juganson@gmail.com'],
    ['Dmitri Potapov', '58379092', 'potapov.dmitri@gmail.com'],
    ['Eerik Staškevitš', '53417295', 'eerik.sta@gmail.com'],
    ['Eiko Lainjärv', '5555555', 'eiko@eikophoto.com'],
    ['Eveli Mäepalu', '+372 506 9374', 'evelimaepalu@gmail.com'],
    ['Fred Soome', '5274829', 'fred.soome@gmail.com'],
    ['Hannes Aavaste', '+37253063114', 'hannesa@gmail.com'],
    ['Hannes Aavaste', '+37253063114', 'h2nnesa@gmail.com'],
    ['Hannes Luht', '5653353', 'hannes.luht@gmail.com'],
    ['Igor', '58505078', 'igor.mekhed@gmail.com'],
    ['Ingrid', '53932212', 'aruingrid@gmail.com'],
    ['Ivar Põri', '5534923', 'ivarpori@gmail.com'],
    ['Jane Hõimoja', '5206857', 'janeniit@gmail.com'],
    ['Jenny', '53330102', 'karakulja2323@gmail.com'],
    ['kaarel eelma', '+37258050180', 'kaarel@eelma.com'],
    ['Karl Kask', '58554800', 'karlkask04@gmail.com'],
    ['Kristi', '', 'kristi.loog@gmail.com'],
    ['Kristi Kivisoo', '3725289907', 'kristi.kivisoo@gmail.com'],
    ['Külaline', '', 'pole@pole.ee'],
    ['Lauri Reilson', '', 'lauri_reilson@hotmail.com'],
    ['Lilian', '56647176', 'lilian.suvi@gmail.com'],
    ['Maiu Uusmaa', '+372 5814 1740', 'maiu.uusmaa@gmail.com'],
    ['Mare Svistun', '56454881', 'maresv@hot.ee'],
    ['Mare Svistun', '56454881', 'kuukiir612@gmail.com'],
    ['Maria Bušina', '+3725549107', 'maria_busina@hotmail.com'],
    ['Marion Lehes', '54564449', 'marionlehes2000@gmail.com'],
    ['Meelis', '5026156', '66wpn24b2v@privaterelay.appleid.com'],
    ['Meelis A', '', 'm33lis@gmail.com'],
    ['Meelis Ruustalu', '5026156', 'm.ruustalu@gmail.com'],
    ['Merit Illak', '55956142', 'merit.illak@gmail.com'],
    ['Merle Järv', '', 'jarvmerle@gmail.com'],
    ['Mihkel Urmet', '5106910', 'urmet@tempt.ee'],
    ['Minna Triin Kohv', '55634127', 'minnatriinkohv@gmail.com'],
    ['Nazmul Apu', '+37258529533', 'nazmul.apu.hasan@gmail.com'],
    ['Neeme', '', 'neeme.andreas.eller@gmail.com'],
    ['Olga Galimova', '55617978', 'olga.galimova@gmail.com'],
    ['Rale', '', 'ralevalss@gmail.com'],
    ['Rõõt', '57888888888888888', 'kampusr@gmail.com'],
    ['Ruslan', '58049439', 'alegopo333@gmail.com'],
    ['Sajeesh', '54420493', 'sajeesh94007@gmail.com'],
    ['Siim Habakukk', '53308483', 'siim.habakukk@gmail.com'],
    ['Simmo', '', 'sooaars@gmail.com'],
    ['Simona', '56508927', 'svissak@gmail.com'],
    ['Sten Sinkarev', '5663 5664', 'sten.sinkarev@gmail.com'],
    ['Taivo Reintal', '', 'taivo.reintal@gmail.com'],
    ['Thea Liis', '5011161', 'thealiis.pae@hotmail.com'],
    ['Toivo', '56651818', 'toivovallo@gmail.com'],
    ['Toivo Samel', '+3725016255', 'toivosamel@hot.ee'],
    ['Toomas Tomson', '58098091', 'toomas37@gmail.com'],
    ['Ülari Pärnoja', '56912763', 'ypdisain@gmail.com'],
    ['Üllar', '', 'ullar.matas@gmail.com'],
    ['Urmo', '5187712', 'urmo777@gmail.com'],
    ['Vijeesh K Vijayan', '53989024', 'vijeeshkv2020@gmail.com']
  ];
BEGIN
  -- Get next position
  SELECT COALESCE(MAX(position), -1) + 1 INTO next_pos
  FROM items
  WHERE board_id = board_id_val;

  -- Loop through contacts and insert
  FOR i IN 1..array_length(contacts_data, 1) LOOP
    contact_name := contacts_data[i][1];
    contact_phone := contacts_data[i][2];
    contact_email := contacts_data[i][3];
    
    -- Skip if name is empty
    IF contact_name IS NULL OR contact_name = '' THEN
      CONTINUE;
    END IF;

    -- Insert item
    INSERT INTO items (board_id, name, position)
    VALUES (board_id_val, contact_name, next_pos)
    RETURNING id INTO item_id_val;

    next_pos := next_pos + 1;

    -- Insert phone cell value if present
    IF contact_phone IS NOT NULL AND contact_phone != '' THEN
      INSERT INTO cell_values (item_id, column_id, value)
      VALUES (item_id_val, phone_column_id_val, to_jsonb(contact_phone))
      ON CONFLICT (item_id, column_id) DO UPDATE SET value = to_jsonb(contact_phone);
    END IF;

    -- Insert email cell value if present
    IF contact_email IS NOT NULL AND contact_email != '' THEN
      INSERT INTO cell_values (item_id, column_id, value)
      VALUES (item_id_val, email_column_id_val, to_jsonb(contact_email))
      ON CONFLICT (item_id, column_id) DO UPDATE SET value = to_jsonb(contact_email);
    END IF;
  END LOOP;
END $$;

