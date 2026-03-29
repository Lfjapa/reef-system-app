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
