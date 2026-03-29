-- ============================================================
-- supabase_enrich_species_v2.sql
-- Enriquecimento e expansão do catálogo de espécies
--
-- PARTE 1: Corais SPS  — preenche difficulty/min_tank/behavior/aggression
--           nos ~45 corais SPS importados em UPPERCASE que ainda não têm esses campos
-- PARTE 2: Corais LPS  — completa espécies individuais de Euphyllia + outros LPS
-- PARTE 3: Corais moles — preenche gaps em Anthelia, Briareum, Heteroxenia, etc.
-- PARTE 4: Novos peixes — 18 espécies populares não cadastradas
-- PARTE 5: Novos invertebrados — 12 espécies (almejas, ermitões, ouriços, estrelas)
-- PARTE 6: Compatibilidade adicional para novas espécies
--
-- Idempotente: usa WHERE difficulty IS NULL e ON CONFLICT DO NOTHING
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PARTE 1: Enriquecimento de Corais SPS
-- (os nomes do import ficaram em UPPERCASE — usamos ILIKE)
-- ─────────────────────────────────────────────────────────────

-- ── Acropora spp. — ramificados/staghorn (bulk base) ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 300,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - zona fótica'),
  behavior_notes   = 'Coral SPS ramificado que exige parâmetros ultra-estáveis. Requer alta luminosidade (PAR 300–600 µmol), fluxo turbulento intenso e monitoramento rigoroso de cálcio (420–450 ppm), KH (8–9 dKH) e magnésio (1 300–1 400 ppm). Intolerante a nitratos acima de 5 ppm ou fosfatos acima de 0,05 ppm. Branqueia em horas quando estressado — indicador sensível de problemas no sistema. Exclusivo para aquaristas experientes com sistemas maduros.'
WHERE scientific_name ILIKE 'Acropora %'
  AND difficulty IS NULL;

-- ── Acropora hyacinthus — tabular (override) ──
UPDATE public.bio_requirements SET
  behavior_notes = 'Acropora tabular de crescimento horizontal espetacular — forma "mesas" planas de até 60 cm em recifes naturais. Exige posição elevada no aquário para receber luz intensa por toda a superfície. Ainda mais sensível que as formas ramificadas a sombreamento e acúmulo de detritos sobre o talo. Parâmetros ultra-estáveis são obrigatórios.'
WHERE scientific_name ILIKE 'Acropora hyacinthus'
  AND behavior_notes IS NULL;

-- ── Acropora granulosa / plana — em pratos/incrustantes (override) ──
UPDATE public.bio_requirements SET
  behavior_notes = 'Acropora de crescimento em placa. Cresce horizontalmente a partir de uma base incrustante, formando chapas sobrepostas em recifes rasos. Sensível ao sombreamento pela própria colônia — garantir fluxo que remova detritos das camadas inferiores. Mesma exigência de parâmetros das formas ramificadas.'
WHERE scientific_name ILIKE 'Acropora granulosa'
   OR scientific_name ILIKE 'Acropora plana';

-- ── Acropora cerealis / divaricata — pequeno porte ──
UPDATE public.bio_requirements SET
  min_tank_liters = 250
WHERE scientific_name ILIKE 'Acropora cerealis'
   OR scientific_name ILIKE 'Acropora nana'
   OR scientific_name ILIKE 'Acropora humilis';

-- ── Montipora spp. — todos (bulk base) ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - incrustante'),
  behavior_notes   = 'Coral SPS incrustante ou em placa, o mais tolerante do grupo. Aceita nitrato até 10 ppm e parâmetros moderados — boa porta de entrada para SPS. Cresce sobre qualquer superfície dura, cobrindo rochas com "veludo" colorido. Sensível à instabilidade de KH e cálcio mas menos exigente que Acropora.'
WHERE scientific_name ILIKE 'Montipora %'
  AND difficulty IS NULL;

-- ── Montipora digitata — forma digitada (override) ──
UPDATE public.bio_requirements SET
  behavior_notes = 'Montipora de crescimento digitado/ramificado — forma galhos eretos a partir de uma base incrustante. Mais fácil de fragmentar para propagação que as formas em placa. Cresce rapidamente em sistemas bem estabelecidos. Boa escolha para primeiro SPS ramificado após dominar formas incrustantes.'
WHERE scientific_name ILIKE 'Montipora digitata';

-- ── Pocillopora spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - ramificado'),
  behavior_notes   = 'SPS ramificado robusto e de crescimento rápido — excelente indicador visual de saúde do sistema. Branqueia em horas ao menor estresse, servindo como "canário na mina". Hospeda cracas simbióticas (Trapezia) em ambiente natural. Fragmanta facilmente para propagação. Tolerante a parâmetros moderados mas responde bem a SPS rigorosos.'
WHERE scientific_name ILIKE 'Pocillopora %'
  AND difficulty IS NULL;

-- ── Seriatopora spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - ramificado'),
  behavior_notes   = 'Coral ninho-de-pássaro com galhos finos e entrelaçados. Crescimento relativamente rápido para um SPS. Sensível à falta de fluxo entre os galhos — detritos acumulados causam necrose basal. Requer fluxo turbulento para evitar estagnação no interior da colônia.'
WHERE scientific_name ILIKE 'Seriatopora %'
  AND difficulty IS NULL;

-- ── Stylophora pistillata ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - ramificado'),
  behavior_notes   = 'Coral SPS com galhos arredondados em ponta — morfologia característica "de clube". Um dos SPS mais estudados em ciência marinha. Tolera variações moderadas de temperatura e parâmetros. Fragmenta bem e cresce rapidamente em aquários estáveis.'
WHERE scientific_name ILIKE 'Stylophora pistillata'
  AND difficulty IS NULL;

-- ── Stylocoeniella / Anacropora ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 250,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - incrustante'),
  behavior_notes   = 'SPS incrustante menos comum no hobby. Exige cuidados similares a Acropora — parâmetros estáveis, alta luz e bom fluxo. Raramente disponível em lojas; mais encontrado como "hitchhiker" em fragmentos de outros corais.'
WHERE scientific_name ILIKE 'Stylocoeniella%'
  AND difficulty IS NULL;

UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 300,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - ramificado'),
  behavior_notes   = 'SPS ramificado delicado com galhos muito finos. Considerado mais difícil que Acropora por muitos aquaristas. Exige fluxo intenso mas sem turbulência direta que quebre os galhos. Parâmetros SPS rigorosos. Relativamente raro no hobby.'
WHERE scientific_name ILIKE 'Anacropora%'
  AND difficulty IS NULL;

-- ── Pavona spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - foliado'),
  behavior_notes   = 'Coral SPS de crescimento foliado ou em cacto. Mais tolerante à sombra que Acropora — boa escolha para posições médias do aquário. Semi-resistente: tolera pequenas flutuações de parâmetros sem branqueamento imediato.'
WHERE scientific_name ILIKE 'Pavona %'
  AND difficulty IS NULL;

-- ── Leptoseris sp ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - sombra'),
  behavior_notes   = 'Coral SPS laminado adaptado a ambientes de baixa luminosidade em recifes profundos. Aceita posições sombrias no aquário — ideal para as áreas menos iluminadas. Crescimento lento mas constante. Muito mais tolerante à falta de luz que outros SPS.'
WHERE scientific_name ILIKE 'Leptoseris%'
  AND difficulty IS NULL;

-- ── Hydnophora spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 250,
  aggression_level = COALESCE(aggression_level, 'Agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - estrutural'),
  behavior_notes   = 'Coral SPS extremamente agressivo com tentáculos urticantes potentes. Capaz de matar corais vizinhos ao toque — manter distância de 20+ cm de qualquer outro coral. Cresce rapidamente quando estável. Parâmetros SPS rigorosos; intolerante a nutrientes elevados.'
WHERE scientific_name ILIKE 'Hydnophora%'
  AND difficulty IS NULL;

-- ── Merulina ampliata ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - foliado'),
  behavior_notes   = 'Coral alface de crescimento foliado. Exige boa luminosidade e fluxo moderado. Crescimento lento mas consistente em sistemas bem estabelecidos. Relativamente raro em aquarismo mas adaptável a condições SPS/LPS.'
WHERE scientific_name ILIKE 'Merulina%'
  AND difficulty IS NULL;


-- ─────────────────────────────────────────────────────────────
-- PARTE 2: Enriquecimento de Corais LPS
-- ─────────────────────────────────────────────────────────────

-- ── Euphyllia ancora — Hammer Coral ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS médio'),
  behavior_notes   = 'Coral hammer com tentáculos em forma de âncora/T. Um dos LPS mais populares e recomendados para iniciantes no LPS. Sensível à "Brown Jelly Disease" e à síndrome do algodão (fosfato elevado). Manter 15+ cm de outros corais pois os tentáculos urticantes se estendem bastante. Aceita alimentação com Mysis 2x/semana.'
WHERE scientific_name ILIKE 'Euphyllia ancora'
  AND difficulty IS NULL;

-- ── Euphyllia divisa — Frogspawn ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS médio'),
  behavior_notes   = 'Coral frogspawn com tentáculos em cacho de uvas. Compatível com outras Euphyllia do mesmo gênero — não se agridem mutuamente, podendo ser colocados próximos. Boa escolha para aquários comunitários de LPS. Alimentar 2x/semana com zooplâncton.'
WHERE scientific_name ILIKE 'Euphyllia divisa'
  AND difficulty IS NULL;

-- ── Euphyllia paraancora — Octospawn ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS médio'),
  behavior_notes   = 'Euphyllia ramificada com tentáculos em forma de T duplo ou octópode. Forma ramificada da E. ancora — pode compartilhar espaço com outras Euphyllia. Crescimento um pouco mais rápido que a forma solitária. Compatível com clownfish que usarão os tentáculos como hospedeiro.'
WHERE scientific_name ILIKE 'Euphyllia paraancora'
  AND difficulty IS NULL;

-- ── Euphyllia cristata — Grape Coral ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS médio'),
  behavior_notes   = 'Euphyllia uva com tentáculos arredondados. Menos comum que E. ancora e divisa. Cuidados idênticos às outras Euphyllia. Compatível com congêneres no mesmo aquário sem riscos de alelopatia entre si.'
WHERE scientific_name ILIKE 'Euphyllia cristata'
  AND difficulty IS NULL;

-- ── Euphyllia yaeyamaensis — Branching Hammer ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS ramificado'),
  behavior_notes   = 'Hammer coral ramificado — diferente do ancora solitário, forma colônias com múltiplos cabeças sobre base ramificada. Cresce mais rapidamente e pode se tornar impressionante em aquários maiores. Mesmos cuidados das outras Euphyllia.'
WHERE scientific_name ILIKE 'Euphyllia yaeyamaensis'
  AND difficulty IS NULL;

-- ── Blastomussa merletti ──
UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 100,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS colonial'),
  behavior_notes   = 'Blastomussa menor que B. wellsi com pólipos mais compactos mas igualmente coloridos. Ótimo para baixa e média iluminação. Cresce em colônias densas. Alimentação com Mysis e Artêmia 2x/semana acelera o crescimento. Tolerante a parâmetros instáveis — indicado para iniciantes em LPS.'
WHERE scientific_name ILIKE 'Blastomussa merletti'
  AND difficulty IS NULL;

-- ── Caulastrea furcata ──
UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 120,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS colonial'),
  behavior_notes   = 'Coral candy cane ou trompete — um dos LPS mais recomendados para iniciantes. Colônias tubulares com cabeças verdes e centros brancos/amarelos muito atrativos. Cresce adicionando novos tubos regularmente. Robusto e tolerante. Alimentar 2x/semana com Mysis para estimular o crescimento da colônia.'
WHERE scientific_name ILIKE 'Caulastrea%'
  AND difficulty IS NULL;

-- ── Alveopora spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - LPS colonial'),
  behavior_notes   = 'Similar ao Goniopora com tentáculos floridos longos mas ligeiramente mais tolerante. Ainda assim considerado avançado — requer alimentação regular (fitoplâncton + zooplâncton), fluxo suave a moderado e sistema maduro (12+ meses). Sensível a qualquer variação brusca de parâmetros.'
WHERE scientific_name ILIKE 'Alveopora%'
  AND difficulty IS NULL;

-- ── Heliofungia actiniformis ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Substrato - solitário móvel'),
  behavior_notes   = 'Coral prato solitário com tentáculos muito longos — parece uma anêmona mas é um coral pétreo. Posicionar no substrato arenoso; pode se mover lentamente. Tentáculos longos urticantes — manter distância de vizinhos. Alimentar semanalmente com pedaços de camarão ou krill. Sensível a perturbações do substrato próximo.'
WHERE scientific_name ILIKE 'Heliofungia%'
  AND difficulty IS NULL;

-- ── Fungia spp. (se não atualizado pelo enrich v1) ──
UPDATE public.bio_requirements SET
  territory_type = COALESCE(territory_type, 'Substrato - solitário móvel')
WHERE scientific_name ILIKE 'Fungia%'
  AND territory_type IS NULL;

-- ── Scolymia australis / Homophyllia bowerbanki ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 150,
  aggression_level = COALESCE(aggression_level, 'Agressivo'),
  territory_type   = COALESCE(territory_type,   'Substrato - solitário'),
  behavior_notes   = 'Coral solitário de alto valor ornamental, extremamente cobiçado por suas cores. Exige alimentação semanal com pedaços de camarão ou krill diretamente no pólipo. Possui filamentos mesenteriais que envenenam corais vizinhos — isolar em substrato com espaço ao redor. Crescimento muito lento.'
WHERE scientific_name ILIKE 'Scolymia australis'
   OR scientific_name ILIKE 'Homophyllia bowerbanki';

-- ── Pectinia spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - foliado'),
  behavior_notes   = 'Coral pétreo de crescimento foliado e labiríntico. Aceita posições de sombra parcial — adequado para áreas de iluminação moderada. Cresce lentamente formando placas elaboradas. Semi-resistente a variações de parâmetros.'
WHERE scientific_name ILIKE 'Pectinia%'
  AND difficulty IS NULL;

-- ── Porites spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Avançado',
  min_tank_liters  = 300,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - maciço'),
  behavior_notes   = 'Coral maciço de crescimento muito lento — um dos construtores primários de recifes naturais. Extremamente sensível à mudança de parâmetros e poluição. Em aquários, raramente prospera a longo prazo sem sistema bem maduro e parâmetros SPS rigorosos. Recifes naturais de Porites levam décadas para atingir seu tamanho característico.'
WHERE scientific_name ILIKE 'Porites%'
  AND difficulty IS NULL;

-- ── Goniastrea spp. ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 200,
  aggression_level = COALESCE(aggression_level, 'Semi-agressivo'),
  territory_type   = COALESCE(territory_type,   'Recifal - maciço'),
  behavior_notes   = 'Coral cérebro de estrutura maciça e crescimento lento. Tolera variações de parâmetros moderadas. Produz mesenteríos à noite para se alimentar e pode agredir corais muito próximos. Boa escolha de LPS pétreo para posições baixas do aquário.'
WHERE scientific_name ILIKE 'Goniastrea%'
  AND difficulty IS NULL;

-- ── Heteropsammia cochlea ──
UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 100,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Substrato - movimento próprio'),
  behavior_notes   = 'Coral solitário com simbiose única: vive sobre um sipúnculo (verme) que o movimenta lentamente pelo substrato, evitando soterramento. Curiosidade biológica rara em aquários. Requer substrato de areia fina e alimentação semanal. Inofensivo para todos os vizinhos.'
WHERE scientific_name ILIKE 'Heteropsammia%'
  AND difficulty IS NULL;

-- ── Lobophyllia spp. ──
UPDATE public.bio_requirements SET
  territory_type = COALESCE(territory_type, 'Recifal - LPS solitário/colonial')
WHERE scientific_name ILIKE 'Lobophyllia%'
  AND territory_type IS NULL;


-- ─────────────────────────────────────────────────────────────
-- PARTE 3: Corais moles — preenchimento de lacunas
-- ─────────────────────────────────────────────────────────────

UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 100,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - incrustante'),
  behavior_notes   = 'Coral mole de crescimento incrustante sobre rochas. Muito resistente e fácil de manter. Forma tapetes coloridos que cobrem o substrato rapidamente. Pode inibir outros corais por sombreamento — controlar expansão periodicamente.'
WHERE scientific_name ILIKE 'Briareum%'
  AND difficulty IS NULL;

UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 100,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - colonial'),
  behavior_notes   = 'Coral mole de tentáculos finos e plumosos, similar à Xenia mas com pulsação menos marcante. Cresce rapidamente e pode se tornar invasivo em aquários maduros. Boa capacidade de absorção de nutrientes. Resistente a variações de parâmetros.'
WHERE scientific_name ILIKE 'Anthelia%'
  AND difficulty IS NULL;

UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 100,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - colonial'),
  behavior_notes   = 'Coral pulsante muito similar à Xenia. Cresce e se espalha rapidamente — considerar manter em pedra isolada ou podar mensalmente. Excelente para aquários jovens pois consome nitratos e fosfatos eficientemente.'
WHERE scientific_name ILIKE 'Heteroxenia%'
  AND difficulty IS NULL;

UPDATE public.bio_requirements SET
  difficulty       = 'Intermediário',
  min_tank_liters  = 120,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - arborescente'),
  behavior_notes   = 'Coral mole arborescente (tipo couve-flor). Tolerante mas prefere fluxo moderado e boa iluminação. Cresce mais lentamente que Xenia. Não invade o espaço de vizinhos como Xenia. Boa escolha para preenchimento visual de aquários de recife.'
WHERE scientific_name ILIKE 'Litophyton%'
  AND difficulty IS NULL;

UPDATE public.bio_requirements SET
  difficulty       = 'Iniciante',
  min_tank_liters  = 80,
  aggression_level = COALESCE(aggression_level, 'Pacífico'),
  territory_type   = COALESCE(territory_type,   'Recifal - incrustante'),
  behavior_notes   = 'Coral-cravo incrustante de crescimento rápido. Pólipos verdes ou brancos que se fecham completamente ao toque ou variações de parâmetros. Muito resistente — um dos corais mais indicados para aquários novos. Pode cobrir rochas rapidamente.'
WHERE scientific_name ILIKE 'Pachyclavularia%'
  AND difficulty IS NULL;


-- ─────────────────────────────────────────────────────────────
-- PARTE 4: Novos peixes — 18 espécies populares
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.bio_requirements (
  scientific_name, common_name, group_name, reef_compatible, lighting, flow,
  temp_min_c, temp_max_c, sg_min, sg_max, ph_min, ph_max, dkh_min, dkh_max,
  difficulty, min_tank_liters, aggression_level, territory_type, behavior_notes, source
) VALUES

-- ── Palhaços adicionais ──
('Premnas biaculeatus', 'Palhacinho Maroon / Maroon Clownfish', 'Clownfish',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 150, 'Agressivo', 'Anêmona hospedeira',
 'O maior e mais agressivo dos peixes-palhaço — fêmeas atingem 15 cm. Defende a anêmona hospedeira (principalmente Entacmaea quadricolor) ferozmente, atacando inclusive a mão do aquarista durante manutenção. Incompatível com outros palhaços. Espinhos nas bochechas distinguem-no das Amphiprion. Recomendado apenas para aquários dedicados com anêmona.',
 'conhecimento_aquarismo'),

('Amphiprion clarkii', 'Palhaço de Clark / Clark''s Clownfish', 'Clownfish',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Pacífico', 'Anêmona hospedeira',
 'O palhaço mais adaptável — aceita praticamente qualquer anêmona (10+ espécies hospedeiras, incluindo Stichodactyla e Macrodactyla). Coloração variada por região (preto/amarelo/marrom). Mais tolerante a condições subótimas que outros palhaços. Levemente maior que o ocellaris (12 cm). Excelente para iniciantes.',
 'conhecimento_aquarismo'),

('Amphiprion frenatus', 'Palhaço Tomate / Tomato Clownfish', 'Clownfish',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo', 'Anêmona hospedeira',
 'Palhaço tomate de cor vermelha intensa com uma única listra branca (fêmeas adultas podem perder a listra). Semi-agressivo com peixes pequenos próximos à sua área. Aceita Entacmaea mas adapta-se bem sem anêmona em aquários recifais. Muito robusto e fácil de alimentar.',
 'conhecimento_aquarismo'),

-- ── Damsels ──
('Chrysiptera parasema', 'Damsel Cauda-Amarela / Yellow-tail Blue Damsel', 'Damselfish',
 'Sim', 'Média', 'Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Semi-agressivo', 'Territorial - rocha viva',
 'Um dos damsels mais populares pela combinação azul cobalto e cauda amarela. Menos agressivo que a maioria dos damsels mas pode intimidar peixes tímidos menores que ele. Muito resistente e fácil de alimentar. Boa escolha para aquários menores desde que combinado com peixes de personalidade similar.',
 'conhecimento_aquarismo'),

('Chrysiptera hemicyanea', 'Damsel Azure / Azure Damsel', 'Damselfish',
 'Sim', 'Média', 'Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Semi-agressivo', 'Territorial - rocha viva',
 'Damsel com metade superior azul e metade inferior laranja/amarela. Muito resistente e tolerante a oscilações de parâmetros. Requer esconderijos rochosos para se sentir seguro. Pode ser levemente agressivo durante estabelecimento de território. Excelente escolha para aquários comunitários de porte médio.',
 'conhecimento_aquarismo'),

-- ── Leões ──
('Pterois volitans', 'Peixe-Leão Comum / Common Lionfish', 'Lionfish',
 'Com Cautela', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.021, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 300, 'Agressivo', 'Emboscada - recifal',
 'ATENÇÃO: Espinhos dorsais venenosos causam dor intensa — manusear com extrema cautela usando ferramentas. Predador de emboscada que engole peixes e camarões menores que a própria boca (até 15 cm de comprimento). Em aquários novos aceita apenas presa viva; adaptar a krill e camarão congelado lentamente. Incompatível com peixes ou camarões menores que a metade do seu tamanho. Excelente para sistemas FOWLR.',
 'conhecimento_aquarismo'),

('Dendrochirus zebra', 'Leão-Anão Zebra / Zebra Dwarf Lionfish', 'Lionfish',
 'Com Cautela', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.021, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 150, 'Semi-agressivo', 'Emboscada - recifal',
 'Leão-anão compacto (máx. 18 cm) com listras zebradas e peitorais em leque. Espinhos dorsais venenosos — nunca manusear sem proteção. Adapta-se a presa congelada com mais facilidade que Pterois. Come camarões ornamentais pequenos. Ativo principalmente ao entardecer. Adequado para FOWLR ou recifes sem camarões.',
 'conhecimento_aquarismo'),

-- ── Hawkfish ──
('Oxycirrhites typus', 'Hawkfish Focinho-Longo / Longnose Hawkfish', 'Hawkfish',
 'Com Cautela', 'Média', 'Médio',
 22, 27, 1.021, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Semi-agressivo', 'Pouso - gorgônias e corais',
 'Hawkfish de focinho longo muito elegante — pousa sobre gorgônias e corais esperando presas. Incompatível com camarões ornamentais (Lysmata, Stenopus) pois os caça ativamente. Não tem bexiga natatória — sempre repousa sobre superfícies. Curioso e interativo; aprende a reconhecer o aquarista. Inofensivo para corais e peixes maiores.',
 'conhecimento_aquarismo'),

('Cirrhitichthys falco', 'Hawkfish Falco / Falco Hawkfish', 'Hawkfish',
 'Com Cautela', 'Média', 'Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo', 'Pouso - rocha viva',
 'Hawkfish compacto (7 cm) com padrão de manchas vermelhas/rosadas sobre fundo branco. Oportunista — caça camarões pequenos e peixes minúsculos. Pousa sobre rochas e corais duros aguardando presas. Personalidade marcante e destemida. Fácil de alimentar e muito resistente. Evitar com camarões ornamentais.',
 'conhecimento_aquarismo'),

-- ── Jawfish ──
('Opistognathus aurifrons', 'Peixe-Mandíbula Cabeça-Amarela / Yellowhead Jawfish', 'Jawfish',
 'Sim', 'Baixa a Média', 'Baixo',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 120, 'Pacífico', 'Substrato arenoso - toca própria',
 'Constrói e habita tocas na areia — OBRIGATÓRIO substrato de areia profunda (10+ cm) misturado com cascalho de diferentes granulações para estabilizar a galeria. Incubador bucal: o macho carrega os ovos na boca por 7–9 dias. Pode saltar ao se sentir ameaçado — TAMPA OBRIGATÓRIA. Alimentar com Mysis e zooplâncton. Muito pacífico com peixes recifais.',
 'conhecimento_aquarismo'),

-- ── Anjos ──
('Genicanthus lamarck', 'Anjo de Lamarck / Lamarck''s Angelfish', 'Angelfish',
 'Sim', 'Média a Alta', 'Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 350, 'Pacífico', 'Natação livre - recifal',
 'Um dos raros anjos grandes verdadeiramente compatíveis com recife — planctívoro que não ataca corais ou invertebrados. Dimorfismo sexual marcante: macho com listras pretas longas, fêmea de coloração mais suave. Exige espaço de natação e aquário bem estabelecido. Pode ser mantido em harém (1 macho + 2-3 fêmeas).',
 'conhecimento_aquarismo'),

('Centropyge acanthops', 'Anjo Flameback Africano / African Flameback Angelfish', 'Angelfish',
 'Com Cautela', 'Média', 'Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 100, 'Semi-agressivo', 'Territorial - rocha viva',
 'Anjo-anão com dorso laranja vibrante e corpo azul-escuro — coloração espetacular em tamanho compacto (8 cm). Risco moderado de beliscar corais moles e mantos de almejas — monitorar comportamento nas primeiras semanas. Mais resistente que C. loriculus na aclimatação e transporte. Território individual bem definido entre rochas.',
 'conhecimento_aquarismo'),

-- ── Wrasses ──
('Paracheilinus carpenteri', 'Wrasse Faiscador de Carpenter / Carpenter''s Flasher Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 150, 'Pacífico', 'Recifal - natação livre',
 'Wrasse faiscador com exibição nupcial espetacular — o macho abre nadadeiras e exibe cores intensas em flashes rápidos para atrair fêmeas. Completamente compatível com corais e invertebrados. Tampa obrigatória — salta com facilidade. Manter preferencialmente em grupo (1 macho : 2-3 fêmeas). Alimentação com Mysis e zooplâncton.',
 'conhecimento_aquarismo'),

('Macropharyngodon meleagris', 'Wrasse Leopardo / Leopard Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio',
 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 200, 'Pacífico', 'Substrato arenoso - recifal',
 'Wrasse leopardo de coloração exótica com pontos brancos sobre fundo laranja. Exigente em alimentação — necessita substrato vivo rico em copépodos e misidáceos para sobreviver nos primeiros meses. Recusa facilmente pellets e alimentos processados. Dorme enterrado na areia fina. Alta taxa de mortalidade por jejum em exemplares recém-importados. Apenas para aquaristas experientes com aquário maduro e bem populado de microfauna.',
 'conhecimento_aquarismo'),

-- ── Anthias ──
('Pseudanthias bartlettorum', 'Anthias de Bartlett / Bartlett''s Anthias', 'Anthias',
 'Sim', 'Média a Alta', 'Médio a Alto',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 200, 'Pacífico', 'Recifal - cardume',
 'Anthias laranja e roxo de grande apelo visual. Protogínico: todos nascem fêmeas e o maior indivíduo transforma-se em macho quando ausente. Necessita alimentação 3x/dia com Mysis, Artêmia e zooplâncton — declina rapidamente se subnutrido. Manter em grupo de 3+ indivíduos (1 macho) para reduzir estresse. Sistema com refugium de copépodos é ideal.',
 'conhecimento_aquarismo'),

-- ── Cardinalfish ──
('Sphaeramia nematoptera', 'Cardinalfish Pijama / Pajama Cardinalfish', 'Cardinalfish',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 120, 'Pacífico', 'Recifal - abrigos noturnos',
 'Cardinalfish pijama com coloração tripartite característica (cabeça amarela, faixa central marrom, corpo pontilhado). Espécie noturna — mais ativo após o pôr do sol. Incubador bucal: o macho carrega os ovos na boca por 10–14 dias. Prefere grupos de 3–6 indivíduos. Muito resistente e tolerante. Alimentar no período crepuscular para melhores resultados.',
 'conhecimento_aquarismo'),

-- ── Rabbitfish ──
('Siganus unimaculatus', 'Foxface Ponto-Único / Onespot Foxface', 'Rabbitfish',
 'Com Cautela', 'Média a Alta', 'Médio a Alto',
 23, 27, 1.021, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 250, 'Pacífico', 'Natação livre - recifal',
 'Foxface com mancha preta característica no flanco. Espinhos dorsais e ventrais venenosos — risco de acidente durante manutenção (dor intensa mas não fatal). Excelente controlador de macroalgas, cianobactérias e algas filamentosas. Pode beliscar corais moles ocasionalmente — monitorar nas primeiras semanas. Muito pacífico com outros peixes.',
 'conhecimento_aquarismo'),

-- ── Blennies ──
('Meiacanthus grammistes', 'Blenny Fangs Listrado / Striped Fang Blenny', 'Blenny',
 'Sim', 'Média', 'Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo', 'Territorial - rocha viva',
 'Blenny com presas que secretam veneno misto (enzimas + toxinas) — defesa eficaz que faz predadores cuspirem o peixe imediatamente. Frequentemente mimetizado por outras espécies não venenosas (mímica batesiana). Semi-agressivo com peixes de aparência similar ou territorial. Inofensivo para corais e invertebrados. Personalidade marcante e fácil de alimentar.',
 'conhecimento_aquarismo')

ON CONFLICT (scientific_name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- PARTE 5: Novos invertebrados — 12 espécies
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.bio_requirements (
  scientific_name, common_name, group_name, reef_compatible, lighting, flow,
  temp_min_c, temp_max_c, sg_min, sg_max, ph_min, ph_max, dkh_min, dkh_max,
  difficulty, min_tank_liters, aggression_level, territory_type, behavior_notes, source
) VALUES

-- ── Almejas Tridacna ──
('Tridacna crocea', 'Almeja Crocea / Crocea Clam', 'Invertebrado',
 'Sim', 'Alta', 'Médio',
 23, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 200, 'Pacífico', 'Recifal - fixada em rocha',
 'Menor das almejas tridacna (máx. 15 cm) — perfura e cimenta-se diretamente em rocha viva. Fotossintética (zooxantelas no manto) — posicionar em zona de alta luminosidade. Exige cálcio (400–450 ppm) e KH (8–11 dKH) adequados para crescimento da concha. Verificar regularmente a presença de nudibrânquios parasitas (Pinctada spp.) no manto. Sensível ao estresse e mudanças bruscas de parâmetros.',
 'conhecimento_aquarismo'),

('Tridacna squamosa', 'Almeja Squamosa / Squamosa Clam', 'Invertebrado',
 'Sim', 'Média a Alta', 'Médio',
 23, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 300, 'Pacífico', 'Substrato - base plana',
 'Almeja squamosa de bordas escamosas características (daí o nome). Cresce até 40 cm. Repousa sobre substrato plano ou pedra baixa — não perfura como a T. crocea. Fotossintética mas beneficia-se de doses de fitoplâncton 2x/semana. Alta demanda de cálcio e alcalinidade. Manejo cuidadoso: nunca expor ao ar por mais de 30 segundos.',
 'conhecimento_aquarismo'),

('Tridacna derasa', 'Almeja Derasa / Derasa Clam', 'Invertebrado',
 'Sim', 'Média', 'Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 350, 'Pacífico', 'Substrato - base plana',
 'A mais robusta e de crescimento mais rápido das tridacnas (até 50 cm). Tolera iluminação moderada melhor que as outras espécies — boa escolha de entrada para almejas. Posicionar diretamente no substrato. Menos exigente em parâmetros que T. crocea ou T. maxima. Crescimento notável: pode ganhar 5–8 cm/ano em boas condições.',
 'conhecimento_aquarismo'),

-- ── Ermitões ──
('Clibanarius tricolor', 'Ermitão-Perna-Azul / Blue Leg Hermit Crab', 'Invertebrado',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 22, 28, 1.021, 1.026, 8.0, 8.4, 7, 12,
 'Iniciante', 80, 'Pacífico', 'Substrato e rocha - limpador',
 'Ermitão-perna-azul — um dos melhores limpadores de aquário recifal. Come algas filamentosas, cianobactérias, detritos e restos de comida. Completamente inofensivo para corais e peixes. Pode matar caramujos para ocupar conchas maiores — fornecer sempre conchas vazias de tamanhos variados para evitar mortalidade de turbo snails. Taxa: 1 ermitão para cada 5–8 litros.',
 'conhecimento_aquarismo'),

('Paguristes cadenati', 'Ermitão Escarlate / Scarlet Hermit Crab', 'Invertebrado',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 22, 28, 1.021, 1.026, 8.0, 8.4, 7, 12,
 'Iniciante', 80, 'Pacífico', 'Substrato e rocha - limpador',
 'Ermitão escarlate com pernas vermelho-vivo e olhos amarelos inconfundíveis. Excelente limpador de algas filamentosas e detritos. Um dos ermitões mais recomendados para recifes — raramente agressivo com outros invertebrados. Come sobras de comida e algas. Fornecer conchas de reposição. Complementar com ermitão-perna-azul para cobertura de diferentes tipos de algas.',
 'conhecimento_aquarismo'),

-- ── Caranguejos e camarões especializados ──
('Neopetrolisthes maculatus', 'Caranguejo de Porcelana Manchado / Porcelain Anemone Crab', 'Invertebrado',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 100, 'Pacífico', 'Anêmona hospedeira',
 'Caranguejo de porcelana branco com manchas vermelhas/marrons que vive em simbiose com anêmonas (principalmente Entacmaea e Stichodactyla). Filtra plâncton da água com ventiladores bucais em leque — comportamento fascinante. Completamente inofensivo para corais, invertebrados e peixes. Sensível à qualidade da água. Manter em par para otimizar a exibição.',
 'conhecimento_aquarismo'),

('Hymenocera picta', 'Camarão Arlequim / Harlequin Shrimp', 'Invertebrado',
 'Com Cautela', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 100, 'Agressivo', 'Substrato - caçador especialista',
 'ATENÇÃO: Camarão arlequim se alimenta EXCLUSIVAMENTE de estrelas-do-mar — sem exceção. Incompatível com qualquer estrela ornamental (Fromia, Linckia, Asterias). Exige fornecimento regular de estrelas vivas como alimento único — desafio logístico permanente. Manter em par monogâmico estável. Coloração entre os mais belos do hobby (branco com manchas azuis/roxas). Apenas para aquaristas dedicados.',
 'conhecimento_aquarismo'),

('Periclimenes brevicarpalis', 'Camarão de Anêmona / Squat Anemone Shrimp', 'Invertebrado',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 100, 'Pacífico', 'Anêmona / coral de fogo hospedeiro',
 'Camarão de anêmona semitransparente com manchas brancas e laranja no abdômen. Vive em comensalismo com anêmonas e corais de fogo (Millepora). Muito discreto — difícil de localizar no aquário dado o tamanho pequeno (3 cm) e a transparência. Come sobras de comida e micro-detritos. Completamente inofensivo. Excelente espécie de observação para aquários paisagísticos.',
 'conhecimento_aquarismo'),

-- ── Estrelas e Ouriços ──
('Ophiarachna incrassata', 'Estrela-Frágil Verde / Green Brittle Star', 'Invertebrado',
 'Com Cautela', 'Baixa', 'Baixo a Médio',
 22, 28, 1.021, 1.026, 8.0, 8.4, 7, 12,
 'Iniciante', 200, 'Agressivo', 'Recifal noturno - predador',
 'ATENÇÃO: Estrela-frágil verde é predadora noturna ativa e perigosa para peixes. Captura e engole peixes dormindo no substrato ou em tocas — risco comprovado para gobies, blennies e peixes pequenos (< 8 cm). Excelente limpadora de detritos e restos de comida durante o dia. Recomendada apenas para sistemas FOWLR sem peixes pequenos, ou recifes grandes com peixes maiores que 10 cm.',
 'conhecimento_aquarismo'),

('Diadema setosum', 'Ouriço Espinho-Longo / Long Spine Sea Urchin', 'Invertebrado',
 'Com Cautela', 'Baixa a Média', 'Baixo a Médio',
 22, 28, 1.021, 1.026, 8.0, 8.4, 7, 12,
 'Iniciante', 150, 'Pacífico', 'Substrato e rocha - raspador',
 'Ouriço-espinho-longo com espinhos de até 20 cm — excelente controlador de macroalgas e coralina indesejada. Espinhos penetram facilmente luvas e pele — MANUSEIO COM EXTREMO CUIDADO usando pinças e luvas grossas. Posicionar longe de corais que possam ser danificados pelo movimento. Noturno: esconde-se durante o dia em fendas rochosas. Sensível a variações bruscas de salinidade.',
 'conhecimento_aquarismo'),

('Tripneustes gratilla', 'Ouriço Coletor / Collector Urchin', 'Invertebrado',
 'Com Cautela', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 200, 'Pacífico', 'Substrato - coletor móvel',
 'Ouriço coletor que cobre o próprio corpo com detritos, conchas, pedras e fragmentos de algas para camuflagem — comportamento único e fascinante. Excelente controlador de algas filamentosas e macroalgas. Espinhos curtos e arredondados — mais seguro que Diadema para manuseio. Pode carregar e mover corais não fixados ao escalar o recife. Ativo durante o dia.',
 'conhecimento_aquarismo'),

('Fromia milleporella', 'Estrela Vermelha / Red Starfish', 'Invertebrado',
 'Sim', 'Baixa a Média', 'Baixo a Médio',
 23, 27, 1.022, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 200, 'Pacífico', 'Recifal - raspador',
 'Estrela-do-mar vermelha segura para recifes — não ataca corais, almejas ou invertebrados. Come filme algáceo, esponjas incrustantes e micro-detritos. Sensível a oscilações bruscas de salinidade e temperatura — ACLIMATAR MUITO LENTAMENTE (2–3 horas de aclimatação gota a gota). Mortalidade elevada por aclimatação apressada é o principal erro. Incompatível com Hymenocera picta que a predaria.',
 'conhecimento_aquarismo')

ON CONFLICT (scientific_name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- PARTE 6: Compatibilidade adicional para novas espécies
-- ─────────────────────────────────────────────────────────────

-- ── Premnas biaculeatus — compatível com Entacmaea ──
UPDATE public.bio_requirements SET
  compatible_species = array_append(COALESCE(compatible_species, '{}'), 'Entacmaea quadricolor'),
  predator_risk = COALESCE(predator_risk, ARRAY['Pterois volitans (predador de peixes médios)'])
WHERE scientific_name = 'Premnas biaculeatus';

-- ── Amphiprion clarkii — aceita múltiplas anêmonas ──
UPDATE public.bio_requirements SET
  compatible_species = ARRAY[
    'Entacmaea quadricolor', 'Stichodactyla haddoni',
    'Macrodactyla doreensis', 'Stichodactyla mertensii'
  ]
WHERE scientific_name = 'Amphiprion clarkii';

-- ── Amphiprion frenatus ──
UPDATE public.bio_requirements SET
  compatible_species = ARRAY['Entacmaea quadricolor']
WHERE scientific_name = 'Amphiprion frenatus';

-- ── Neopetrolisthes maculatus — vive com anêmonas ──
UPDATE public.bio_requirements SET
  compatible_species = ARRAY['Entacmaea quadricolor', 'Stichodactyla haddoni', 'Macrodactyla doreensis'],
  predator_risk = ARRAY['Pseudocheilinus hexataenia (ataca invertebrados pequenos)']
WHERE scientific_name = 'Neopetrolisthes maculatus';

-- ── Periclimenes brevicarpalis — simbiontes ──
UPDATE public.bio_requirements SET
  compatible_species = ARRAY['Entacmaea quadricolor', 'Stichodactyla haddoni', 'Millepora alcicornis']
WHERE scientific_name = 'Periclimenes brevicarpalis';

-- ── Pterois volitans — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Peixes menores que 15 cm de comprimento',
    'Lysmata amboinensis (camarão médio)',
    'Lysmata debelius (camarão pequeno a médio)',
    'Thor amboinensis (camarão pequeno)',
    'Stenopus hispidus (camarão médio)'
  ]
WHERE scientific_name = 'Pterois volitans';

-- ── Dendrochirus zebra — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Camarões ornamentais menores que 5 cm',
    'Peixes muito pequenos (< 5 cm)'
  ]
WHERE scientific_name = 'Dendrochirus zebra';

-- ── Oxycirrhites typus — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Lysmata amboinensis (caça ativamente)',
    'Lysmata debelius (caça ativamente)',
    'Thor amboinensis (caça ativamente)',
    'Camarões pequenos em geral'
  ]
WHERE scientific_name = 'Oxycirrhites typus';

-- ── Cirrhitichthys falco — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Thor amboinensis (camarão pequeno)',
    'Camarões ornamentais pequenos (< 3 cm)'
  ]
WHERE scientific_name = 'Cirrhitichthys falco';

-- ── Ophiarachna incrassata — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Peixes menores que 8 cm dormindo no substrato (gobies, blennies, dragonets)',
    'Invertebrados lentos no substrato'
  ]
WHERE scientific_name = 'Ophiarachna incrassata';

-- ── Hymenocera picta — prey_risk ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY[
    'Fromia milleporella (presa natural)',
    'Linckia laevigata (presa natural)',
    'Qualquer estrela-do-mar no aquário'
  ]
WHERE scientific_name = 'Hymenocera picta';

-- ── Fromia milleporella — predator_risk ──
UPDATE public.bio_requirements SET
  predator_risk = ARRAY['Hymenocera picta (predador especializado de estrelas)']
WHERE scientific_name = 'Fromia milleporella';

-- ── Tridacna spp. — predator_risk ──
UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Pseudocheilinus hexataenia (belisca o manto)',
    'Centropyge spp. (risco em alguns exemplares)',
    'Chelmon rostratus (becuda - bica o manto)'
  ]
WHERE scientific_name IN ('Tridacna crocea', 'Tridacna squamosa', 'Tridacna derasa');

-- ── Clibanarius tricolor e Paguristes cadenati — predator_risk ──
UPDATE public.bio_requirements SET
  predator_risk = ARRAY[
    'Pseudochromis spp. (dottybacks podem atacar)',
    'Pseudocheilinus hexataenia (ataca invertebrados pequenos)'
  ]
WHERE scientific_name IN ('Clibanarius tricolor', 'Paguristes cadenati');

-- ── Paracheilinus carpenteri — compatible (grupo) ──
UPDATE public.bio_requirements SET
  compatible_species = ARRAY['Paracheilinus filamentosus', 'Cirrhilabrus luteovittatus']
WHERE scientific_name = 'Paracheilinus carpenteri';

-- ── Siganus unimaculatus — prey_risk leve ──
UPDATE public.bio_requirements SET
  prey_risk = ARRAY['Corais moles (beliscadas ocasionais - monitorar)']
WHERE scientific_name = 'Siganus unimaculatus';


-- ─────────────────────────────────────────────────────────────
-- Verificação final
-- ─────────────────────────────────────────────────────────────
SELECT
  group_name,
  COUNT(*) AS total,
  COUNT(difficulty) AS com_difficulty,
  COUNT(min_tank_liters) AS com_min_tank,
  COUNT(behavior_notes) AS com_behavior,
  COUNT(aggression_level) AS com_aggression
FROM public.bio_requirements
GROUP BY group_name
ORDER BY group_name;
