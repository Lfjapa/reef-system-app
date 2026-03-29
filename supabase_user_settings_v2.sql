-- supabase_user_settings_v2.sql
-- Cria (ou atualiza) a tabela user_settings com informações físicas do aquário
-- Idempotente: pode ser executado múltiplas vezes com segurança

-- 1. Cria a tabela se não existir (com todas as colunas já)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  tank_volume_liters double precision NOT NULL DEFAULT 300,
  sump_liters        double precision NOT NULL DEFAULT 0,
  rock_kg            double precision NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 2. Adiciona colunas novas caso a tabela já existisse sem elas
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS sump_liters double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rock_kg     double precision NOT NULL DEFAULT 0;

-- 3. Garante RLS habilitado
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 4. Cria política de acesso (só o próprio usuário lê/escreve)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_settings' AND policyname = 'user_settings_owner'
  ) THEN
    CREATE POLICY user_settings_owner ON public.user_settings
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Comentários descritivos
COMMENT ON COLUMN public.user_settings.tank_volume_liters IS 'Volume bruto do display / aquário principal em litros';
COMMENT ON COLUMN public.user_settings.sump_liters        IS 'Volume do sump em litros (0 se não tiver)';
COMMENT ON COLUMN public.user_settings.rock_kg            IS 'Estimativa de rocha viva em kg (1 kg ≈ 0,5 L deslocado)';

-- 6. Verificação final
SELECT
  tank_volume_liters,
  sump_liters,
  rock_kg,
  tank_volume_liters + sump_liters - rock_kg * 0.5 AS volume_real_estimado_l
FROM public.user_settings
LIMIT 5;
