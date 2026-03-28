-- supabase_compatibility_data.sql
-- Passo 3: Popula compatible_species, predator_risk, prey_risk, territory_type
-- e corrige aggression_level para corais com sweeper tentacles / fogo
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================


-- ============================================================
-- PARTE 1: Corrigir aggression_level em corais agressivos
-- ============================================================

-- Corais AGRESSIVOS (sweeper tentacles longos ou fogo)
UPDATE public.bio_requirements SET
  aggression_level = 'Agressivo',
  territory_type   = 'Território de contato (sweeper tentacles longos)'
WHERE scientific_name = 'Galaxea fascicularis';

UPDATE public.bio_requirements SET
  aggression_level = 'Agressivo',
  territory_type   = 'Território de contato (sweeper tentacles)'
WHERE scientific_name = 'Hydnophora spp.';

UPDATE public.bio_requirements SET
  aggression_level = 'Agressivo',
  territory_type   = 'Território de contato (fogo — cnidócitos potentes)'
WHERE scientific_name = 'Millepora spp.';

-- Corais SEMI-AGRESSIVOS (sweeper tentacles ou veneno)
UPDATE public.bio_requirements SET
  aggression_level = 'Semi-agressivo',
  territory_type   = 'Território de contato (sweeper tentacles)'
WHERE scientific_name IN (
  'Euphyllia spp.',
  'Euphyllia glabrescens',
  'Catalaphyllia jardinei',
  'Nemenzophyllia turbida'
);

-- LPS solitários — semi-agressivos por contato
UPDATE public.bio_requirements SET
  aggression_level = 'Semi-agressivo',
  territory_type   = 'Recifal / LPS solitário'
WHERE scientific_name IN (
  'Fungia spp.',
  'Trachyphyllia geoffroyi',
  'Scolymia spp.',
  'Lobophyllia spp.',
  'Acanthastrea spp.',
  'Micromussa lordhowensis',
  'Echinophyllia spp.',
  'Leptastrea spp.',
  'Favia spp.',
  'Favites spp.',
  'Cyphastrea spp.',
  'Blastomussa wellsi',
  'Leptoseris spp.',
  'Pectinia spp.',
  'Caulastrea spp.',
  'Duncanopsammia axifuga'
);

-- Palythoa: contém palitoxina, semi-agressivo
UPDATE public.bio_requirements SET
  aggression_level = 'Semi-agressivo',
  territory_type   = 'Recifal / zoanthídeo colonial (palitoxina)'
WHERE scientific_name = 'Palythoa spp.';


-- ============================================================
-- PARTE 2: Territory type — corais que eram NULL
-- ============================================================

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / zoanthídeo colonial'
WHERE scientific_name = 'Zoanthus spp.'
  AND territory_type IS NULL;

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / coralimorfo'
WHERE scientific_name IN (
  'Ricordea florida',
  'Ricordea yuma',
  'Corallimorpharia spp.'
) AND territory_type IS NULL;

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / SPS colonial'
WHERE scientific_name IN (
  'Acropora spp.',
  'Montipora spp.',
  'Pocillopora damicornis',
  'Seriatopora hystrix',
  'Stylophora pistillata',
  'Stylocoeniella spp.',
  'Psammocora spp.',
  'Pavona cactus',
  'Turbinaria peltata',
  'Turbinaria spp.'
) AND territory_type IS NULL;

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / softcoral colonial'
WHERE scientific_name IN (
  'Xenia spp.',
  'Anthelia spp.',
  'Clavularia spp.',
  'Sarcophyton spp.',
  'Sinularia spp.',
  'Capnella spp.',
  'Cladiella spp.',
  'Tubipora musica',
  'Dendronephthya spp.',
  'Pseudopterogorgia spp.',
  'Diodogorgia nodulifera'
) AND territory_type IS NULL;

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / LPS colonial'
WHERE scientific_name IN (
  'Porites spp.',
  'Goniopora spp.',
  'Goniopora de Blainville, 1830',
  'Alveopora spp.',
  'Alveopora Blainville, 1830',
  'Millepora spp.'
) AND territory_type IS NULL;


-- ============================================================
-- PARTE 3: Territory type — peixes e invertebrados
-- ============================================================

UPDATE public.bio_requirements SET
  territory_type = 'Anêmona hospedeira (territorial em torno dela)'
WHERE scientific_name IN (
  'Amphiprion ocellaris / Amphiprion percula',
  'Amphiprion percula'
);

UPDATE public.bio_requirements SET
  territory_type = 'Fundo arenoso / toca compartilhada'
WHERE scientific_name = 'Cryptocentrus cinctus';

UPDATE public.bio_requirements SET
  territory_type = 'Fundo arenoso / sifona o substrato'
WHERE scientific_name = 'Valenciennea puellaris';

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / natação livre'
WHERE scientific_name IN (
  'Zebrasoma flavescens',
  'Paracanthurus hepatus',
  'Ctenochaetus tominiensis'
);

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / substrato (toca)'
WHERE scientific_name IN (
  'Salarias fasciatus',
  'Halichoeres chrysus',
  'Gramma loreto'
);

UPDATE public.bio_requirements SET
  territory_type = 'Recifal / semi-territorial'
WHERE scientific_name IN (
  'Pseudocheilinus hexataenia',
  'Pterapogon kauderni'
);

UPDATE public.bio_requirements SET
  territory_type = 'Anêmona / corais macios'
WHERE scientific_name = 'Thor amboinensis';


-- ============================================================
-- PARTE 4: compatible_species
-- ============================================================

-- Amphiprion + anêmonas hospedeiras
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Entacmaea quadricolor',
    'Stichodactyla haddoni',
    'Macrodactyla doreensis'
  ]
WHERE scientific_name IN (
  'Amphiprion ocellaris / Amphiprion percula',
  'Amphiprion percula'
);

-- Anêmonas hospedam Amphiprion
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Amphiprion ocellaris',
    'Amphiprion percula'
  ]
WHERE scientific_name IN (
  'Entacmaea quadricolor',
  'Stichodactyla haddoni',
  'Macrodactyla doreensis'
);

-- Thor amboinensis (sexy shrimp) + anêmonas e coralimorfos
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Entacmaea quadricolor',
    'Ricordea florida',
    'Ricordea yuma',
    'Corallimorpharia spp.'
  ]
WHERE scientific_name = 'Thor amboinensis';

-- Tangs: gêneros diferentes convivem bem
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Ctenochaetus tominiensis',
    'Paracanthurus hepatus'
  ]
WHERE scientific_name = 'Zebrasoma flavescens';

UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Zebrasoma flavescens',
    'Ctenochaetus tominiensis'
  ]
WHERE scientific_name = 'Paracanthurus hepatus';

UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Zebrasoma flavescens',
    'Paracanthurus hepatus'
  ]
WHERE scientific_name = 'Ctenochaetus tominiensis';

-- Cryptocentrus (goby) + Alpheus (camarão pistola) — simbiose
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Alpheus randalli',
    'Alpheus spp. (camarão pistola)'
  ]
WHERE scientific_name = 'Cryptocentrus cinctus';

-- LPS pacíficos que combinam entre si
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Duncanopsammia axifuga',
    'Caulastrea spp.',
    'Micromussa lordhowensis'
  ]
WHERE scientific_name = 'Blastomussa wellsi';

UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Blastomussa wellsi',
    'Caulastrea spp.',
    'Blastomussa wellsi'
  ]
WHERE scientific_name = 'Duncanopsammia axifuga';

-- SPS compatíveis entre si
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Montipora spp.',
    'Pocillopora damicornis',
    'Seriatopora hystrix',
    'Stylophora pistillata'
  ]
WHERE scientific_name = 'Acropora spp.';

-- Softcorals entre si
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Anthelia spp.',
    'Capnella spp.',
    'Cladiella spp.',
    'Sinularia spp.'
  ]
WHERE scientific_name = 'Xenia spp.';

UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Xenia spp.',
    'Capnella spp.',
    'Cladiella spp.'
  ]
WHERE scientific_name = 'Sarcophyton spp.';

-- Ricordea entre si e com zoanthídeos
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Ricordea yuma',
    'Zoanthus spp.',
    'Corallimorpharia spp.'
  ]
WHERE scientific_name = 'Ricordea florida';

UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Ricordea florida',
    'Zoanthus spp.',
    'Corallimorpharia spp.'
  ]
WHERE scientific_name = 'Ricordea yuma';


-- ============================================================
-- PARTE 5: predator_risk (o que ameaça esta espécie)
-- ============================================================

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Peixes carnívoros grandes',
    'Triggerfishes (Balistidae)',
    'Groupers (Serranidae)'
  ]
WHERE scientific_name IN (
  'Amphiprion ocellaris / Amphiprion percula',
  'Amphiprion percula'
);

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Pseudocheilinus hexataenia',
    'Halichoeres chrysus',
    'Peixes carnívoros pequenos'
  ]
WHERE scientific_name = 'Thor amboinensis';

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Peixes carnívoros médios e grandes',
    'Groupers',
    'Lionfish (Pterois spp.)'
  ]
WHERE scientific_name = 'Pterapogon kauderni';

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Chaetodon spp. (peixes-borboleta)',
    'Acanthaster planci (estrela-da-coroa-de-espinhos)'
  ]
WHERE scientific_name IN (
  'Acropora spp.',
  'Pocillopora damicornis',
  'Seriatopora hystrix',
  'Stylophora pistillata',
  'Montipora spp.'
);

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Chaetodon spp. (peixes-borboleta)',
    'Pomacanthus spp. (anjos grandes)'
  ]
WHERE scientific_name IN (
  'Entacmaea quadricolor',
  'Stichodactyla haddoni',
  'Macrodactyla doreensis'
);

UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Chaetodon spp. (peixes-borboleta)',
    'Anjos-imperador (Pomacanthus imperator)'
  ]
WHERE scientific_name IN (
  'Euphyllia spp.',
  'Euphyllia glabrescens',
  'Trachyphyllia geoffroyi',
  'Blastomussa wellsi',
  'Micromussa lordhowensis'
);

-- Zoanthus: cuidado com nudibranches e algumas lesmas
UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Nudibranches (Aeolidiella stephanieae)',
    'Faecelina spp.'
  ]
WHERE scientific_name IN (
  'Zoanthus spp.',
  'Palythoa spp.'
);


-- ============================================================
-- PARTE 6: prey_risk (o que esta espécie caça ou pode prejudicar)
-- ============================================================

-- Six-line wrasse: come invertebrados pequenos
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Camarões ornamentais pequenos (Lysmata, Thor)',
    'Copépodes e anfípodes (limpa o refugo)',
    'Vermes poliquetas'
  ]
WHERE scientific_name = 'Pseudocheilinus hexataenia';

-- Yellow Coris Wrasse
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Camarões ornamentais pequenos',
    'Gastrópodes pequenos',
    'Vermes poliquetas',
    'Copépodes'
  ]
WHERE scientific_name = 'Halichoeres chrysus';

-- Salarias fasciatus: herbívoro, pode eventualmente bicar corais macios
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Pode bicar corais macios ocasionalmente',
    'Zoanthus spp. (raro)'
  ]
WHERE scientific_name = 'Salarias fasciatus';

-- Valenciennea puellaris: vasculha areia, pode soterrar corais de fundo
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Corais de fundo (soterramento por areia)',
    'Fungia spp.',
    'Trachyphyllia geoffroyi'
  ]
WHERE scientific_name = 'Valenciennea puellaris';

-- Tangs: briga territorial
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Outros Zebrasoma spp. (briga territorial)',
    'Acanthurus spp. (briga territorial)'
  ]
WHERE scientific_name = 'Zebrasoma flavescens';

UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Outros Acanthurus e Zebrasoma (briga em aquários pequenos)'
  ]
WHERE scientific_name = 'Paracanthurus hepatus';

-- Euphyllia: sweeper tentacles nocivos
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Corais LPS próximos (sweeper tentacles à noite)',
    'Zoanthus spp. próximos',
    'Corais SPS próximos'
  ]
WHERE scientific_name IN ('Euphyllia spp.', 'Euphyllia glabrescens');

-- Galaxea: sweeper tentacles muito longos (até 30 cm à noite)
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Todos os corais em raio de 15–30 cm à noite (sweeper tentacles)',
    'Zoanthus spp.',
    'Corais LPS e SPS próximos'
  ]
WHERE scientific_name = 'Galaxea fascicularis';

-- Millepora: fogo
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Corais em contato direto',
    'Peixes lentos ou sem proteção (cnidócitos)'
  ]
WHERE scientific_name = 'Millepora spp.';

-- Catalaphyllia: sweeper tentacles e nematócitos potentes
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Corais LPS próximos (sweeper tentacles potentes)',
    'Zoanthus spp. próximos'
  ]
WHERE scientific_name = 'Catalaphyllia jardinei';

-- Palythoa: palitoxina — risco ao manuseio
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Atenção ao manuseio: libera palitoxina (tóxica)',
    'Zoanthus spp. próximos (competição por espaço)'
  ]
WHERE scientific_name = 'Palythoa spp.';


-- ============================================================
-- Verificação final
-- ============================================================
-- Execute após para confirmar:
--
-- SELECT scientific_name, aggression_level, territory_type,
--        compatible_species, predator_risk, prey_risk
-- FROM public.bio_requirements
-- WHERE compatible_species IS NOT NULL
--    OR predator_risk IS NOT NULL
--    OR prey_risk IS NOT NULL
-- ORDER BY scientific_name;
