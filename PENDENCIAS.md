# Pendências — Reef System App

## SQL para executar no Supabase SQL Editor

Acesse: **https://supabase.com/dashboard → seu projeto → SQL Editor**

---

## ✅ Passo 1 — Concluído
`supabase_enrich_bio_requirements.sql` executado com sucesso.
- 71 espécies com `difficulty`, `min_tank_liters`, `aggression_level`, `behavior_notes` preenchidos.

---

## ✅ Passo 2 — Concluído
`supabase_bio_inventory_deep_dive.sql` executado com sucesso.
- View `v_bio_deep_dive` atualizada com todos os novos campos.

---

## 🔴 Passo 3 — Executar dados de compatibilidade

**Arquivo:** `supabase_compatibility_data.sql`

**O que faz:**
- Corrige `aggression_level` para corais com sweeper tentacles ou fogo (Galaxea = Agressivo, Euphyllia = Semi-agressivo, Millepora = Agressivo, etc.)
- Preenche `territory_type` para todos os 71 registros
- Preenche `compatible_species` para simbioses conhecidas (Amphiprion + anêmonas, tangs entre si, Thor + coralimorfos, etc.)
- Preenche `predator_risk` (quem ameaça a espécie)
- Preenche `prey_risk` (o que a espécie pode prejudicar no aquário)

**Como fazer:**
1. Abra o arquivo `supabase_compatibility_data.sql` (na raiz do projeto)
2. Copie todo o conteúdo
3. Cole no Supabase SQL Editor
4. Clique em **Run**

**Verificação após executar:**
```sql
SELECT
  scientific_name,
  aggression_level,
  territory_type,
  compatible_species,
  predator_risk,
  prey_risk
FROM public.bio_requirements
WHERE compatible_species IS NOT NULL
   OR predator_risk IS NOT NULL
   OR prey_risk IS NOT NULL
ORDER BY scientific_name;
```
> Esperado: ~30 espécies com arrays preenchidos

---

## Resumo de status

| Passo | Arquivo | Status |
|-------|---------|--------|
| 1 | `supabase_enrich_bio_requirements.sql` | ✅ Executado |
| 2 | `supabase_bio_inventory_deep_dive.sql` | ✅ Executado |
| 3 | `supabase_compatibility_data.sql` | ✅ Executado |
| 4 | `supabase_user_settings_v2.sql` | ✅ Executado |
| 5 | `supabase_enrich_species_v2.sql` | ✅ Executado |

---

## ✅ Passo 4 — Informações físicas do aquário

**Arquivo:** `supabase_user_settings_v2.sql`

**O que faz:** Adiciona `sump_liters` e `rock_kg` à tabela `user_settings`, permitindo salvar volume do sump e estimativa de rocha viva. Esses dados alimentam cálculos de dosagem e smart tips.

**Como fazer:**
1. Abra o arquivo `supabase_user_settings_v2.sql` (na raiz do projeto)
2. Copie tudo → cole no Supabase SQL Editor → **Run**

**Verificação:**
```sql
SELECT tank_volume_liters, sump_liters, rock_kg,
       tank_volume_liters + sump_liters - rock_kg*0.5 AS volume_real_l
FROM public.user_settings;
```

---

## ✅ Passo 5 — Enriquecimento e expansão do catálogo v2

**Arquivo:** `supabase_enrich_species_v2.sql`

**O que faz:**
- **Corais SPS** (~45 espécies): preenche `difficulty`, `min_tank_liters`, `behavior_notes`, `aggression_level`, `territory_type` para todos os Acropora, Montipora, Pocillopora, Seriatopora, Stylophora, Pavona, Hydnophora, etc. que vieram do import em UPPERCASE sem esses campos
- **Corais LPS**: completa espécies individuais de Euphyllia (ancora, divisa, paraancora, cristata, yaeyamaensis), Blastomussa merletti, Caulastrea furcata, Alveopora, Heliofungia, Pectinia, Porites, Goniastrea, Heteropsammia, Homophyllia
- **Corais moles**: preenche Anthelia, Briareum, Heteroxenia, Litophyton, Pachyclavularia
- **+18 novos peixes**: Premnas biaculeatus, Amphiprion clarkii, A. frenatus, Chrysiptera parasema, C. hemicyanea, Pterois volitans, Dendrochirus zebra, Oxycirrhites typus, Cirrhitichthys falco, Opistognathus aurifrons, Genicanthus lamarck, Centropyge acanthops, Paracheilinus carpenteri, Macropharyngodon meleagris, Pseudanthias bartlettorum, Sphaeramia nematoptera, Siganus unimaculatus, Meiacanthus grammistes
- **+12 novos invertebrados**: Tridacna crocea, T. squamosa, T. derasa, Clibanarius tricolor, Paguristes cadenati, Neopetrolisthes maculatus, Hymenocera picta, Periclimenes brevicarpalis, Ophiarachna incrassata, Diadema setosum, Tripneustes gratilla, Fromia milleporella
- **Compatibilidade adicional**: predator_risk e prey_risk para novas espécies

**Como fazer:**
1. Abra o arquivo `supabase_enrich_species_v2.sql` (na raiz do projeto)
2. Copie todo o conteúdo
3. Cole no Supabase SQL Editor
4. Clique em **Run**

**Verificação após executar:**
```sql
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
```
> Esperado: todos os grupos com cobertura muito maior de `difficulty` e `behavior_notes`.
