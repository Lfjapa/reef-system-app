-- ============================================================
-- Migração: Evolução do Aquario Marinho para projeto completo
-- Execute estas queries no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de configurações do usuário (volume do aquário, etc.)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id   uuid      PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  tank_volume_liters double precision DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'user_settings_owner'
  ) THEN
    CREATE POLICY user_settings_owner ON public.user_settings
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tabela de histórico de trocas de água
CREATE TABLE IF NOT EXISTS public.water_changes (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  performed_at  timestamptz NOT NULL DEFAULT now(),
  volume_liters double precision,
  volume_percent double precision,
  note          text      NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.water_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'water_changes' AND policyname = 'water_changes_owner'
  ) THEN
    CREATE POLICY water_changes_owner ON public.water_changes
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Enriquecimento da tabela bio_requirements
--    (dificuldade, volume mínimo do aquário, notas de comportamento)
ALTER TABLE public.bio_requirements
  ADD COLUMN IF NOT EXISTS difficulty        text,         -- 'Iniciante', 'Intermediário', 'Avançado'
  ADD COLUMN IF NOT EXISTS min_tank_liters   integer,      -- volume mínimo recomendado em litros
  ADD COLUMN IF NOT EXISTS behavior_notes    text;         -- curiosidades e comportamento

-- 4. Comentários descritivos nas colunas
COMMENT ON COLUMN public.bio_requirements.difficulty     IS 'Nível de dificuldade: Iniciante, Intermediário, Avançado';
COMMENT ON COLUMN public.bio_requirements.min_tank_liters IS 'Volume mínimo recomendado do aquário em litros';
COMMENT ON COLUMN public.bio_requirements.behavior_notes  IS 'Notas sobre comportamento, curiosidades e cuidados especiais';

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_water_changes_user_performed
  ON public.water_changes (user_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_bio_requirements_difficulty
  ON public.bio_requirements (difficulty)
  WHERE difficulty IS NOT NULL;

-- ============================================================
-- Fase 2: Verificador de Compatibilidade
-- ============================================================

-- 6. Colunas de compatibilidade e agressividade em bio_requirements
ALTER TABLE public.bio_requirements
  ADD COLUMN IF NOT EXISTS compatible_species text[],   -- nomes científicos compatíveis
  ADD COLUMN IF NOT EXISTS aggression_level   text,     -- 'Pacífico', 'Semi-agressivo', 'Agressivo'
  ADD COLUMN IF NOT EXISTS territory_type     text,     -- 'Bentônico', 'Pelágico', 'Recife', 'Substrato'
  ADD COLUMN IF NOT EXISTS predator_risk      text[],   -- tipos que este animal pode predar
  ADD COLUMN IF NOT EXISTS prey_risk          text[];   -- tipos que podem predar este animal

COMMENT ON COLUMN public.bio_requirements.compatible_species IS 'Lista de nomes científicos compatíveis para convivência';
COMMENT ON COLUMN public.bio_requirements.aggression_level   IS 'Nível de agressividade: Pacífico, Semi-agressivo, Agressivo';
COMMENT ON COLUMN public.bio_requirements.territory_type     IS 'Tipo de território ocupado no aquário';
COMMENT ON COLUMN public.bio_requirements.predator_risk      IS 'Categorias de organismos que este animal pode predar';
COMMENT ON COLUMN public.bio_requirements.prey_risk          IS 'Categorias de predadores que representam risco a este animal';

-- 7. Índice GIN para busca eficiente em arrays de compatibilidade
CREATE INDEX IF NOT EXISTS idx_bio_requirements_compatible_species_gin
  ON public.bio_requirements USING gin (compatible_species)
  WHERE compatible_species IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bio_requirements_aggression
  ON public.bio_requirements (aggression_level)
  WHERE aggression_level IS NOT NULL;
