-- ============================================================
-- Enriquecimento de bio_requirements
-- Adiciona: difficulty, min_tank_liters, behavior_notes, aggression_level
-- Insere: novas espécies de peixes e invertebrados
-- Execute no Supabase SQL Editor (idempotente)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PARTE 1: Enriquecer espécies já existentes
-- ─────────────────────────────────────────────────────────────

-- ── Peixes ──

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Forma par dominante. A fêmea maior pode ser agressiva com outros palhaços. Ideal em casal único. Vive em simbiose com anêmonas (Entacmaea, Stichodactyla), mas não é obrigatório.'
WHERE scientific_name = 'Amphiprion ocellaris';

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Similar ao ocellaris, com manchas pretas mais definidas. Forma par monogâmico — não introduzir segundo exemplar adulto. Aceita bem pellets e congelados.'
WHERE scientific_name = 'Amphiprion percula';

-- ── Corais moles ──

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Um dos corais mais resistentes para iniciantes. Cresce rapidamente e pode sombrear vizinhos. Prefere fluxo moderado e luz média. Tolerante a parâmetros instáveis.'
WHERE scientific_name IN ('Zoanthus spp.', 'Palythoa spp.');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Coral cogumelo — muito resistente e ideal para iniciantes. Prefere locais com pouca luz e fluxo baixo. Pode se reproduzir por fissão em aquários bem estabelecidos.'
WHERE scientific_name IN ('Corallimorpharia spp.', 'Ricordea florida', 'Ricordea yuma');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'Coral couro resistente. Pode fechar por dias durante troca de pele — comportamento normal. Libera terpenoides que inibem outros corais; use carvão ativo periodicamente.'
WHERE scientific_name IN ('Sarcophyton spp.', 'Sinularia spp.', 'Cladiella spp.', 'Capnella spp.');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Coral pulsante de crescimento rápido. Pode invadir todo o aquário em poucos meses. Mantê-lo em pedra isolada ou podar regularmente. Ótimo para absorção de nutrientes.'
WHERE scientific_name = 'Xenia spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Coral verde-estrela de crescimento rápido e invasivo. Pode cobrir todo o substrato e rochas. Ótimo para aquários de primeiro recife pela resistência.'
WHERE scientific_name = 'Clavularia spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'Coral órgão de tubos com esqueleto vermelho característico. Mais exigente que outros corais moles. Requer fluxo alto e boa iluminação. Cresce lentamente.'
WHERE scientific_name = 'Tubipora musica';

-- ── LPS ──

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 150, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral tocha/hammer/frogspawn com tentáculos longos e urticantes. Manter distância mínima de 15 cm de outros corais. Sensível a fosfato elevado (síndrome do algodão). Exige fluxo moderado e luz média.'
WHERE scientific_name IN ('Euphyllia glabrescens', 'Euphyllia spp.');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 150, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral cérebro robusto com mesenteríos longos. Pode agredir corais vizinhos durante a noite. Tolera boa variação de parâmetros. Alimentação com pellets 2x por semana melhora crescimento.'
WHERE scientific_name IN ('Favia spp.', 'Favites spp.');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 100, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Blastomussa com boca larga. Alimenta-se facilmente com Mysis e Artêmia. Bom para iniciantes em LPS. Cresce em colônias compactas e coloridas.'
WHERE scientific_name = 'Blastomussa wellsi';

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 150, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Micromussa (ex-Acanthastrea) de cores vibrantes. Muito valorizado no hobby. Alimenta-se de plâncton e microfauna. Requer espaçamento de outros LPS agressivos.'
WHERE scientific_name IN ('Acanthastrea spp.', 'Micromussa lordhowensis');

UPDATE public.bio_requirements SET
  difficulty = 'Iniciante', min_tank_liters = 150, aggression_level = 'Agressivo',
  behavior_notes = 'Coral boca-aberta extremamente agressivo. Possui filamentos mesenteriais muito longos que envenenam corais vizinhos. Manter em pedra isolada. Alimentação semanal acelera crescimento.'
WHERE scientific_name IN ('Lobophyllia spp.', 'Scolymia spp.');

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 200, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral cérebro aberto. Sensível à movimentação — posicionar no substrato e não mexer. Alimentar 2x por semana com Mysis. Indica saúde do aquário pela expansão dos tecidos.'
WHERE scientific_name = 'Trachyphyllia geoffroyi';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'Coral prato solitário que pode se mover lentamente pelo substrato. Requer areia ou substrato plano. Alimentar semanalmente. Sensível a parâmetros instáveis.'
WHERE scientific_name = 'Fungia spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'Coral duncan com pólipos longos. Fácil de alimentar. Forma colônias rapidamente. Boa escolha para iniciantes em LPS dado seu tamanho e comportamento.'
WHERE scientific_name = 'Duncanopsammia axifuga';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 200, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral caulastrea (candy cane). Robusto e colorido. Cresce em colônias densas. Tolera boa variação de parâmetros. Pode ser alimentado 2x por semana.'
WHERE scientific_name = 'Caulastrea spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Avançado', min_tank_liters = 200, aggression_level = 'Agressivo',
  behavior_notes = 'Galaxea com tentáculos urticantes extremamente longos (30+ cm à noite). Isolar em pedra própria. Exige boa circulação e iluminação forte. Crescimento rápido quando estável.'
WHERE scientific_name = 'Galaxea fascicularis';

UPDATE public.bio_requirements SET
  difficulty = 'Avançado', min_tank_liters = 150, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral goniopora com tentáculos floridos. Historicamente difícil — novas cepas captiveiras mais resistentes. Requer fluxo moderado e alimentação regular com fitoplâncton.'
WHERE scientific_name = 'Goniopora spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Avançado', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'Coral catáfila (elegância) sensível. Requer substrato macio — não colocar sobre rochas. Muito suscetível à síndrome de declínio do coral elegância. Parâmetros estáveis são essenciais.'
WHERE scientific_name = 'Catalaphyllia jardinei';

-- ── SPS ──

UPDATE public.bio_requirements SET
  difficulty = 'Avançado', min_tank_liters = 300, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Coral SPS mais exigente do hobby. Requer parâmetros ultra-estáveis (KH 7-8.5, Ca 420-450, Mg 1300+), luz intensa e fluxo alto. Altamente sensível a nitratos acima de 5 ppm e fosfatos acima de 0.05 ppm.'
WHERE scientific_name = 'Acropora spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 200, aggression_level = 'Pacífico',
  behavior_notes = 'SPS mais tolerante para iniciantes. Aceita parâmetros moderados (nitrato até 10 ppm). Cresce em forma de placa ou digitada dependendo do fluxo e luz. Boa escolha para primeiro SPS.'
WHERE scientific_name = 'Montipora spp.';

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 150, aggression_level = 'Pacífico',
  behavior_notes = 'SPS ramificado e resistente. Reproduz-se facilmente por fragmentação. Tolera parâmetros moderados. Cresce rapidamente em aquários bem estabelecidos com boa iluminação.'
WHERE scientific_name IN ('Pocillopora damicornis', 'Stylophora pistillata', 'Seriatopora hystrix');

-- ── Anêmonas ──

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 200, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Anêmona bola de bolha — a mais recomendada para aquários com palhaços. Pode mover-se e queimar corais vizinhos com tentáculos urticantes. Requer boa iluminação e aquário estabelecido (6+ meses).'
WHERE scientific_name = 'Entacmaea quadricolor';

UPDATE public.bio_requirements SET
  difficulty = 'Avançado', min_tank_liters = 300, aggression_level = 'Semi-agressivo',
  behavior_notes = 'Anêmona tapete — uma das maiores e mais urticantes. Pode ingerir peixes pequenos. Necessita excelente iluminação e substrato adequado. Apenas para aquaristas experientes.'
WHERE scientific_name IN ('Macrodactyla doreensis', 'Stichodactyla haddoni');

-- ── Invertebrados ──

UPDATE public.bio_requirements SET
  difficulty = 'Intermediário', min_tank_liters = 100, aggression_level = 'Pacífico',
  behavior_notes = 'Camarão bailarino com dança característica. Vive em associação com corais e anêmonas. Sensível à qualidade da água — indicador de estresse do aquário. Reproduz facilmente em cativeiro.'
WHERE scientific_name = 'Thor amboinensis';


-- ─────────────────────────────────────────────────────────────
-- PARTE 2: Inserir novos peixes não cadastrados
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.bio_requirements (
  scientific_name, common_name, group_name, reef_compatible, lighting, flow,
  temp_min_c, temp_max_c, sg_min, sg_max, ph_min, ph_max, dkh_min, dkh_max,
  difficulty, min_tank_liters, aggression_level, behavior_notes, source
) VALUES

-- Tangs / Cirurgiões
('Paracanthurus hepatus', 'Cirurgião-paleta / Blue Tang', 'Tang',
 'Sim', 'Alta', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 400, 'Semi-agressivo',
 'Suscetível a ich (Cryptocaryon). Exige aquário grande para nadar. Herbívoro — oferecer algas e nori diariamente. Semi-agressivo com outros tangs de corpo oval.',
 'conhecimento_aquarismo'),

('Zebrasoma flavescens', 'Tang Amarelo', 'Tang',
 'Sim', 'Alta', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 300, 'Semi-agressivo',
 'Excelente controle de algas filamentosas. Agressivo com outros tangs, especialmente do mesmo gênero. Adicionar por último ao aquário. Espinho caudal pode ferir ao manusear.',
 'conhecimento_aquarismo'),

('Zebrasoma xanthurum', 'Tang Roxo', 'Tang',
 'Sim', 'Alta', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 400, 'Agressivo',
 'Um dos tangs mais agressivos do gênero. Não manter com outros Zebrasoma. Exige aquário grande. Excelente controle de algas. Coloração roxa intensa indica boa saúde.',
 'conhecimento_aquarismo'),

('Naso lituratus', 'Tang Naso / Lipstick Tang', 'Tang',
 'Sim', 'Alta', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 500, 'Pacífico',
 'Um dos tangs mais pacíficos. Cresce bastante (30+ cm). Exige aquário longo para nadar. Come algas pardas e espinafre. Fácil de aclimatar comparado a outros tangs.',
 'conhecimento_aquarismo'),

('Acanthurus leucosternon', 'Tang Pó-de-azul / Powder Blue Tang', 'Tang',
 'Sim', 'Alta', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 400, 'Agressivo',
 'Coloração espetacular mas muito sensível a doenças. Alta taxa de mortalidade na aclimatação. Exige aquário bem estabelecido (1+ ano), parâmetros estáveis e boa alimentação com algas.',
 'conhecimento_aquarismo'),

('Ctenochaetus strigosus', 'Tang Kole', 'Tang',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 200, 'Pacífico',
 'O tang mais pacífico e fácil. Excelente para controle de cianobactérias e algas finas. Raramente briga com outros tangs. Boa primeira escolha de tang para iniciantes.',
 'conhecimento_aquarismo'),

('Ctenochaetus tominiensis', 'Tang Tomini', 'Tang',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 200, 'Pacífico',
 'Similar ao Kole tang. Coloração com detalhes dourados. Excelente herbívoro para controle de algas indesejadas. Tolera bem a convivência com outros tangs de gêneros diferentes.',
 'conhecimento_aquarismo'),

-- Gobies
('Valenciennea puellaris', 'Diamond Goby', 'Goby',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Pacífico',
 'Filtra areia constantemente — mantém o substrato oxigenado. Forma par monogâmico. Pode saltar se assustado — necessita tampa. Precisa de fundo de areia com pelo menos 5 cm.',
 'conhecimento_aquarismo'),

('Cryptocentrus cinctus', 'Yellow Watchman Goby', 'Goby',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo',
 'Forma simbiose clássica com camarão-pistola Alpheus. Cava tocas e pode deslocar decoração. Agressivo com outros gobies bentônicos. Aceita bem pellets e congelados.',
 'conhecimento_aquarismo'),

('Elacatinus oceanops', 'Neon Goby', 'Goby',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 75, 'Pacífico',
 'Limpa ectoparasitas de outros peixes — comportamento de limpeza natural. Pode reproduzir em aquários. Muito pequeno e pacífico. Ideal para aquários nano-reef.',
 'conhecimento_aquarismo'),

('Amblyeleotris wheeleri', 'Watchman Goby Wheeler', 'Goby',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Pacífico',
 'Simbiose com camarão-pistola. Mais tímido que o Yellow Watchman. Coloração em listras verticais. Necessita de fundo de areia para cavar tocas.',
 'conhecimento_aquarismo'),

-- Blennies
('Salarias fasciatus', 'Lawnmower Blenny', 'Blenny',
 'Sim', 'Baixa', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Semi-agressivo',
 'Excelente controle de algas finas e diatômáceas. Personalidade curiosa — descansa em locais elevados. Pode bicar corais moles por engano. Requer aquário com algas crescidas antes de introduzir.',
 'conhecimento_aquarismo'),

('Ecsenius bicolor', 'Bicolor Blenny', 'Blenny',
 'Sim', 'Baixa', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo',
 'Coloração bicolor laranja e azul. Habita cavidades nas rochas. Pode bicar corais de polipo grande. Come algas mas aceita pellets. Personalidade marcante.',
 'conhecimento_aquarismo'),

('Ecsenius midas', 'Midas Blenny', 'Blenny',
 'Sim', 'Baixa', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Pacífico',
 'Coloração dourada vibrante. Nada em coluna de água imitando anthias. Come zooplâncton — oferecer Mysis e copépodes. Mais pelágico que outros blennies.',
 'conhecimento_aquarismo'),

-- Wrasses
('Halichoeres chrysus', 'Yellow Coris Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Pacífico',
 'Um dos wrasses mais pacíficos e recomendados. Caça parasitas e pestes como monogeneas. Dorme enterrado na areia — necessita substrato adequado. Não incomodar durante aclimatação inicial.',
 'conhecimento_aquarismo'),

('Pseudocheilinus hexataenia', 'Six-Line Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Semi-agressivo',
 'Caçador eficaz de flatworms, pyramidellids e monogeneas. Pode intimidar peixes menores e tímidos. Introduzir por último no aquário. Pode pular — necessita tampa.',
 'conhecimento_aquarismo'),

('Cirrhilabrus luteovittatus', 'Fairy Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 200, 'Pacífico',
 'Fairy wrasse extremamente pacífico e colorido. Nada em coluna de água. Aceita bem pellets. Pode ser mantido em harém (1 macho + várias fêmeas). Pula se assustado.',
 'conhecimento_aquarismo'),

('Labroides dimidiatus', 'Cleaner Wrasse', 'Wrasse',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 200, 'Pacífico',
 'Remove parasitas de outros peixes. Dificuldade por depender de parasitas como fonte principal de alimento — mortalidade alta sem peixes hospedeiros. Prefira wrasses alternativos como Elacatinus.',
 'conhecimento_aquarismo'),

-- Basslets / Grammas
('Gramma loreto', 'Royal Gramma', 'Basslet',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Semi-agressivo',
 'Ótima opção para recifes. Ocupa tocas e cavidades. Territorial com outros basslets e peixes de coloração similar. Coloração roxa/amarela vibrante e estável. Come tudo.',
 'conhecimento_aquarismo'),

('Assessor macneilli', 'Blue Assessor', 'Basslet',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 150, 'Pacífico',
 'Nada de cabeça para baixo sob rochas — comportamento fascinante. Muito pacífico. Sensível a introdução direta — aclimatar lentamente. Prefere aquários com muito esconderijo.',
 'conhecimento_aquarismo'),

-- Cardinalfish
('Pterapogon kauderni', 'Cardeal Banggai', 'Cardinalfish',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 120, 'Semi-agressivo',
 'Espécie ameaçada na natureza — prefira exemplares criados em cativeiro. O macho incuba os ovos na boca. Em casal, o macho pode ser agressivo com outros cardiais. Come bem pellets.',
 'conhecimento_aquarismo'),

('Apogon leptacanthus', 'Threadfin Cardinalfish', 'Cardinalfish',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Pacífico',
 'Cardinalfish de cardume — manter em grupos de 5+. Muito pacífico. Ativo ao entardecer e à noite. Come Mysis, copépodes e pellets pequenos. Ótimo para recifes comunitários.',
 'conhecimento_aquarismo'),

-- Dottybacks
('Pictichromis paccagnellae', 'Royal Dottyback', 'Dottyback',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 100, 'Agressivo',
 'Coloração roxa/amarela similar ao Royal Gramma mas muito mais agressivo. Pode atacar camarões ornamentais e peixes menores. Introduzir por último e manter em aquário com muitos esconderijos.',
 'conhecimento_aquarismo'),

('Pseudochromis fridmani', 'Orchid Dottyback', 'Dottyback',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 100, 'Semi-agressivo',
 'Um dos dottybacks menos agressivos. Coloração violeta intensa. Come copépodes, Mysis e pellets. Pode coexistir com camarões grandes (cleaner, blood). Cria em cativeiro disponível.',
 'conhecimento_aquarismo'),

-- Chromis / Damsels
('Chromis viridis', 'Blue/Green Chromis', 'Damselfish',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 150, 'Pacífico',
 'Um dos poucos damsels verdadeiramente pacíficos. Manter em cardume de 5+ para reduzir agressão intraespecífica. Nada na coluna de água e cria movimento e vida no aquário.',
 'conhecimento_aquarismo'),

-- Firefish
('Nemateleotris magnifica', 'Firefish', 'Dartfish',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Pacífico',
 'Extremamente tímido — necessita de esconderijos. Saltador compulsivo: tampa obrigatória. Pode retrair para cavidades por dias após estresse. Aceita Mysis, copépodes e pellets pequenos.',
 'conhecimento_aquarismo'),

('Nemateleotris decora', 'Firefish Decora / Purple Firefish', 'Dartfish',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 100, 'Pacífico',
 'Similar ao Firefish clássico com coloração arroxeada. Igualmente tímido. Pode coexistir com N. magnifica se introduzidos juntos. Tampa obrigatória — saltador frequente.',
 'conhecimento_aquarismo'),

-- Mandarim
('Synchiropus splendidus', 'Peixe-mandarim', 'Dragonet',
 'Sim', 'Baixa', 'Baixo', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 200, 'Pacífico',
 'Alimentação especializada em copépodes vivos — raramente aceita alimento processado. Exige refugium bem populado ou adição semanal de copépodes. Mortalidade alta por inanição. Apenas para aquários maduros (+1 ano) com microfauna abundante.',
 'conhecimento_aquarismo'),

-- Anthias
('Pseudanthias squamipinnis', 'Lyretail Anthias', 'Anthias',
 'Sim', 'Média', 'Alto', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 300, 'Semi-agressivo',
 'Necessita alimentação 3-5x por dia com Mysis e copépodes. Manter em harém (1 macho + 3+ fêmeas). O macho dominante é muito territorial. Mortalidade alta se subalimentado.',
 'conhecimento_aquarismo'),

-- Foxface
('Siganus vulpinus', 'Foxface Rabbitfish', 'Rabbitfish',
 'Sim', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 250, 'Pacífico',
 'Espinhos dorsais e ventrais venenosos — manusear com cuidado. Excelente controle de algas macroscópicas e filamentosas. Pacífico com todos os peixes exceto outros rabbitfish. Muda de cor quando dorme (camuflagem).',
 'conhecimento_aquarismo'),

-- Angelfish
('Centropyge loriculus', 'Flame Angelfish', 'Angelfish',
 'Com Cautela', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 200, 'Semi-agressivo',
 'O mais popular dos anjos-anão. Pode bicar corais moles, zoanthids e mantas de tridacna — monitorar. Territorial com outros anjos-anão. Coloca-se por último no aquário estabelecido.',
 'conhecimento_aquarismo'),

('Centropyge bicolor', 'Bicolor Angelfish', 'Angelfish',
 'Com Cautela', 'Média', 'Médio', 24, 27, 1.020, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 200, 'Semi-agressivo',
 'Coloração amarela/azul marcante mas taxa de mortalidade alta na aclimatação. Requer aquário estabelecido com muito natural food (microalgas, copépodes). Propenso a ich e parasitas.',
 'conhecimento_aquarismo'),

-- ─────────────────────────────────────────────────────────────
-- PARTE 3: Inserir novos invertebrados
-- ─────────────────────────────────────────────────────────────

('Lysmata amboinensis', 'Camarão Cleaner', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Estabelece estações de limpeza — remove parasitas de peixes. Hermafrodita simultâneo: par pode reproduzir em aquário. Sensível a instabilidade de salinidade e iodo baixo. Muda periodicamente — oferecer esconderijo.',
 'conhecimento_aquarismo'),

('Lysmata debelius', 'Blood Red Shrimp', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Mais tímido que o cleaner — principalmente noturno. Prefere cavernas e sombras. Coloração vermelha intensa com pontos brancos. Limpa peixes mas menos ativamente que L. amboinensis.',
 'conhecimento_aquarismo'),

('Lysmata wurdemanni', 'Peppermint Shrimp', 'Invertebrado',
 'Com Cautela', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Principal predador biológico de Aiptasia. Manter grupo de 3-6 para controle eficaz. Pode comer pólipos de corais moles se mal alimentado — oferecer suplementação. Prefere ambiente escuro.',
 'conhecimento_aquarismo'),

('Stenopus hispidus', 'Coral Banded Shrimp', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 150, 'Agressivo',
 'Territorial — apenas um casal por aquário. Mata camarões ornamentais. Pode atacar peixes pequenos e tímidos. Em casal bem estabelecido, comportamento mais calmo. Pinças fortes — cuidado ao manusear.',
 'conhecimento_aquarismo'),

('Alpheus randalli', 'Camarão Pistola', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Simbiose clássica com gobies watchman. Praticamente cego — depende completamente do gobio para alertas de predadores. Som de estalido audível. Cava tocas que podem deslocar decoração.',
 'conhecimento_aquarismo'),

('Mithraculus sculptus', 'Caranguejo Esmeralda', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Semi-agressivo',
 'Especialista em controle de alga valônia (grape algae). Em aquários maduros pode começar a comer corais moles — monitorar. Ativo à noite. Pode disputar territorio com outros caranguejos.',
 'conhecimento_aquarismo'),

('Calcinus elegans', 'Ermitão Azul', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Equipe de limpeza essencial. Come detritos, algas e restos de alimento. Necessita conchas de reposição em vários tamanhos — sem conchas adequadas pode matar caracóis para roubar a concha. Muda de concha ao crescer.',
 'conhecimento_aquarismo'),

('Turbo fluctuosa', 'Caracol Turbo', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Excelente para controle de algas nos vidros e rochas. Pode tombar em substratos inclinados — reposicionar quando necessário. Sensível a quedas bruscas de salinidade e cobre. Morre rapidamente fora d''água.',
 'conhecimento_aquarismo'),

('Trochus spp.', 'Caracol Trochus', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Iniciante', 80, 'Pacífico',
 'Superior ao Turbo por conseguir se endireitar sozinho quando tombado. Come algas coralinas, diatômáceas e algas verdes. Pode reproduzir em aquários. Ótimo para controle de algas em vidros.',
 'conhecimento_aquarismo'),

('Tridacna maxima', 'Mariscos Tridacna / Giant Clam', 'Invertebrado',
 'Sim', 'Alta', 'Médio', 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 200, 'Pacífico',
 'Filtra fitoplâncton e usa zooxantelas para energia — exige iluminação muito intensa. Sensível a parâmetros instáveis, especialmente cálcio e KH. Pode fechar rapidamente em resposta a movimentos — comportamento normal. Não introduzir próximo a corais agressivos.',
 'conhecimento_aquarismo'),

('Linckia laevigata', 'Estrela-do-mar Azul', 'Invertebrado',
 'Sim', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Avançado', 300, 'Pacífico',
 'Muito sensível à aclimatação — mortalidade alta se feita rapidamente. Exige aquário maduro (1+ ano) com microfauna abundante. Indicador da saúde do sistema. Não tolera exposição ao ar por nenhum segundo.',
 'conhecimento_aquarismo'),

('Holothuria spp.', 'Pepino-do-mar', 'Invertebrado',
 'Com Cautela', null, null, 24, 27, 1.023, 1.026, 8.1, 8.4, 8, 12,
 'Intermediário', 200, 'Pacífico',
 'Excelente para bioturbação do substrato. Risco: se estressado ou morto, libera toxina (holothurina) que pode matar todos os peixes do aquário. Manter longe de bombas e overflows. Apenas em aquários grandes e estabelecidos.',
 'conhecimento_aquarismo')

ON CONFLICT (scientific_name) DO UPDATE SET
  difficulty      = COALESCE(EXCLUDED.difficulty,      bio_requirements.difficulty),
  min_tank_liters = COALESCE(EXCLUDED.min_tank_liters, bio_requirements.min_tank_liters),
  aggression_level= COALESCE(EXCLUDED.aggression_level,bio_requirements.aggression_level),
  behavior_notes  = COALESCE(EXCLUDED.behavior_notes,  bio_requirements.behavior_notes),
  common_name     = CASE WHEN bio_requirements.common_name = '' THEN EXCLUDED.common_name ELSE bio_requirements.common_name END,
  group_name      = CASE WHEN bio_requirements.group_name  = '' THEN EXCLUDED.group_name  ELSE bio_requirements.group_name  END,
  updated_at      = now();
