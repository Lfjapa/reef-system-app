export const parameterDefinitionsData = [
  { key: 'kh', label: 'KH', unit: 'dKH', min: 7, max: 9 },
  { key: 'calcio', label: 'Cálcio', unit: 'ppm', min: 420, max: 470 },
  { key: 'magnesio', label: 'Magnésio', unit: 'ppm', min: 1250, max: 1400 },
  { key: 'salinidade', label: 'Salinidade', unit: 'sg', min: 1.024, max: 1.026 },
  { key: 'temperatura', label: 'Temperatura', unit: '°C', min: 24, max: 26 },
  { key: 'ph', label: 'pH', unit: '', min: 7.9, max: 8.4 },
  { key: 'amonia', label: 'Amônia', unit: 'ppm', min: 0, max: 0.1 },
  { key: 'nitrito', label: 'Nitrito', unit: 'ppm', min: 0, max: 0.1 },
  { key: 'nitrato', label: 'Nitrato', unit: 'ppm', min: 2, max: 20 },
  { key: 'fosfato', label: 'Fosfato', unit: 'ppm', min: 0.01, max: 0.1 },
  { key: 'silicato', label: 'Silicato', unit: 'ppm', min: 0, max: 0.5 },
  { key: 'iodo', label: 'Iodo/Estrôncio/Potássio', unit: 'ppm' },
] satisfies Array<{
  key: string
  label: string
  unit: string
  min?: number
  max?: number
}>

export const defaultProtocolDefinitionsData = [
  { key: 'dose_ab_plus', label: 'Dosar AB+', days: [1, 3, 6], quantity: null, unit: 'ml' },
  {
    key: 'dose_caledonia',
    label: 'Dosar Caledonia Mineral Blend',
    days: [2, 5],
    quantity: null,
    unit: 'ml',
  },
  {
    key: 'dose_reef_energy_plus',
    label: 'Dosar Red Sea Reef Energy Plus',
    days: [1, 3, 6],
    quantity: null,
    unit: 'ml',
  },
  { key: 'test_kh', label: 'Testar KH', days: [6], quantity: null, unit: '' },
  { key: 'add_bacteria', label: 'Adicionar biologia/bactérias', days: [6], quantity: null, unit: '' },
  { key: 'tpa', label: 'TPA (troca parcial de água)', days: [6], quantity: null, unit: '%' },
] satisfies Array<{
  key: string
  label: string
  days: number[]
  quantity: number | null
  unit: string
}>

export const seedBioCatalogData = [
  {
    aliases: ['camarão bailarino', 'camarao bailarino', 'sexy shrimp'],
    type: 'invertebrado',
    scientificName: 'Thor amboinensis',
    position: 'base e rochas com anêmonas/corais',
    note: 'Invertebrado limpador; observar muda e comportamento',
  },
  {
    aliases: ['palhaço ocellaris', 'palhaco ocellaris', 'ocellaris'],
    type: 'peixe',
    scientificName: 'Amphiprion ocellaris',
    position: 'médio',
    note: 'Peixe territorial leve, bom para recife',
  },
  {
    aliases: ['diamond goby', 'goby diamond', 'goby'],
    type: 'peixe',
    scientificName: 'Valenciennea puellaris',
    position: 'fundo',
    note: 'Revira substrato; precisa de areia estável',
  },
  {
    aliases: ['torch coral', 'euphyllia glabrescens', 'torch'],
    type: 'coral',
    scientificName: 'Euphyllia glabrescens',
    position: 'meio',
    note: 'Luz média e fluxo moderado',
  },
  {
    aliases: ['mushroom coral', 'discosoma', 'mushroom'],
    type: 'coral',
    scientificName: 'Discosoma spp.',
    position: 'fundo',
    note: 'Coral resistente; prefere luz baixa a média',
  },
  {
    aliases: ['peixe-palhaço', 'peixe palhaco', 'ocellaris', 'percula'],
    type: 'peixe',
    scientificName: 'Amphiprion ocellaris / Amphiprion percula',
    position: 'meio / fundo',
    note: 'Pacífico, onívoro, clássico de recife',
  },
  {
    aliases: ['firefish', 'nemateleotris magnifica', 'nemateleotris decora'],
    type: 'peixe',
    scientificName: 'Nemateleotris magnifica / Nemateleotris decora',
    position: 'meio',
    note: 'Tímido e saltador; usar tampa',
  },
  {
    aliases: ['royal gramma', 'gramma loreto', 'blackcap basslet'],
    type: 'peixe',
    scientificName: 'Gramma loreto / Gramma melacara',
    position: 'fundo / cavernas',
    note: 'Pacífico, territorial com a toca',
  },
  {
    aliases: ['pseudochromis', 'dottyback', 'pictichromis'],
    type: 'peixe',
    scientificName: 'Pictichromis spp.',
    position: 'meio / fundo',
    note: 'Semi-agressivo, pode atacar camarões pequenos',
  },
  {
    aliases: ['cardinal banggai', 'banggai', 'pterapogon kauderni'],
    type: 'peixe',
    scientificName: 'Pterapogon kauderni',
    position: 'meio',
    note: 'Pacífico, ideal em casal',
  },
  {
    aliases: ['grammistes', 'peixe-sabão', 'peixe sabao', 'grammistes sexlineatus'],
    type: 'peixe',
    scientificName: 'Grammistes sexlineatus',
    position: 'fundo / cavernas',
    note: 'Predador; atenção à toxina em estresse severo',
  },
  {
    aliases: ['blue tang', 'dory', 'paracanthurus hepatus'],
    type: 'peixe',
    scientificName: 'Paracanthurus hepatus',
    position: 'todas as áreas',
    note: 'Cresce muito; exige aquário grande',
  },
  {
    aliases: ['yellow tang', 'purple tang', 'sailfin tang', 'zebrasoma'],
    type: 'peixe',
    scientificName: 'Zebrasoma spp.',
    position: 'todas as áreas',
    note: 'Herbívoro; semi-agressivo com outros tangs',
  },
  {
    aliases: ['kole tang', 'tomini tang', 'ctenochaetus'],
    type: 'peixe',
    scientificName: 'Ctenochaetus spp.',
    position: 'meio / fundo',
    note: 'Excelente controle de algas finas',
  },
  {
    aliases: ['watchman goby', 'yellow watchman', 'cryptocentrus'],
    type: 'peixe',
    scientificName: 'Cryptocentrus spp.',
    position: 'fundo',
    note: 'Pode fazer simbiose com camarão pistola',
  },
  {
    aliases: ['blenny', 'lawn mower', 'tailspot', 'ecsenius', 'salarias'],
    type: 'peixe',
    scientificName: 'Ecsenius spp. / Salarias fasciatus',
    position: 'fundo / rochas',
    note: 'Personalidade forte; ótimo para controle de algas',
  },
  {
    aliases: ['wrasse', 'six line', 'melanurus', 'fairy wrasse', 'flasher wrasse'],
    type: 'peixe',
    scientificName: 'Pseudocheilinus / Halichoeres / Cirrhilabrus',
    position: 'meio / topo',
    note: 'Pode pular; recomendado aquário tampado',
  },
  {
    aliases: ['foxface', 'siganus vulpinus'],
    type: 'peixe',
    scientificName: 'Siganus vulpinus',
    position: 'meio',
    note: 'Herbívoro, espinhos venenosos',
  },
  {
    aliases: ['mandarim', 'synchiropus splendidus', 'mandarin'],
    type: 'peixe',
    scientificName: 'Synchiropus splendidus',
    position: 'fundo',
    note: 'Difícil, depende de microfauna abundante',
  },
  {
    aliases: ['anthias', 'lyretail', 'pseudanthias squamipinnis'],
    type: 'peixe',
    scientificName: 'Pseudanthias squamipinnis',
    position: 'topo / meio',
    note: 'Peixe de cardume com alimentação frequente',
  },
  {
    aliases: ['camarão cleaner', 'camarao cleaner', 'lysmata amboinensis'],
    type: 'invertebrado',
    scientificName: 'Lysmata amboinensis',
    position: 'rochas',
    note: 'Limpador de peixes; pacífico',
  },
  {
    aliases: ['blood red shrimp', 'lysmata debelius', 'camarão blood'],
    type: 'invertebrado',
    scientificName: 'Lysmata debelius',
    position: 'rochas / cavernas',
    note: 'Mais tímido, principalmente noturno',
  },
  {
    aliases: ['peppermint shrimp', 'camarão peppermint', 'lysmata wurdemanni'],
    type: 'invertebrado',
    scientificName: 'Lysmata wurdemanni',
    position: 'rochas',
    note: 'Ajuda no controle de aiptasia',
  },
  {
    aliases: ['camarão boxer', 'coral banded shrimp', 'stenopus hispidus'],
    type: 'invertebrado',
    scientificName: 'Stenopus hispidus',
    position: 'cavernas',
    note: 'Territorial; pode atacar camarões menores',
  },
  {
    aliases: ['camarão pistola', 'alpheus'],
    type: 'invertebrado',
    scientificName: 'Alpheus spp.',
    position: 'substrato / tocas',
    note: 'Simbiose clássica com gobies watchman',
  },
  {
    aliases: ['caranguejo esmeralda', 'mithraculus sculptus', 'emerald crab'],
    type: 'invertebrado',
    scientificName: 'Mithraculus sculptus',
    position: 'rochas',
    note: 'Controle de valônia; monitorar comportamento',
  },
  {
    aliases: ['ermitão azul', 'ermitão vermelho', 'calcinus', 'paguristes'],
    type: 'invertebrado',
    scientificName: 'Calcinus elegans / Paguristes cadenati',
    position: 'substrato / rochas',
    note: 'Equipe de limpeza, pode disputar conchas',
  },
  {
    aliases: ['turbo snail', 'trochus', 'astrea', 'astraea', 'snail turbo'],
    type: 'invertebrado',
    scientificName: 'Turbo spp. / Trochus spp. / Astraea spp.',
    position: 'vidros / rochas',
    note: 'Excelente equipe de limpeza de algas',
  },
] satisfies Array<{
  aliases: string[]
  type: 'peixe' | 'coral' | 'invertebrado'
  scientificName: string
  position: string
  note: string
}>

export const defaultLightingPhasesData = [
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0001',
    name: 'Amanhecer',
    time: '08:30',
    uv: 60,
    white: 0,
    blue: 120,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0002',
    name: 'Subida',
    time: '10:30',
    uv: 150,
    white: 40,
    blue: 160,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0003',
    name: 'Pico (Suave)',
    time: '12:30',
    uv: 200,
    white: 130,
    blue: 120,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0004',
    name: 'Manutenção',
    time: '15:30',
    uv: 180,
    white: 80,
    blue: 150,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0005',
    name: 'Sunset (Neon)',
    time: '17:30',
    uv: 220,
    white: 10,
    blue: 200,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0006',
    name: 'Moonlight',
    time: '19:00',
    uv: 100,
    white: 0,
    blue: 80,
  },
  {
    id: '7f0e2d9b-3b1e-4d8c-9f5b-0d2d2a1a0007',
    name: 'Desligar',
    time: '19:30',
    uv: 0,
    white: 0,
    blue: 0,
  },
] satisfies Array<{
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}>

