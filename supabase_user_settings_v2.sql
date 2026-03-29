-- supabase_user_settings_v2.sql
-- Adiciona informações físicas do aquário à tabela user_settings
-- Idempotente: pode ser executado múltiplas vezes

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS sump_liters numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rock_kg     numeric DEFAULT 0;

-- Garante que colunas existentes tenham defaults corretos
ALTER TABLE public.user_settings
  ALTER COLUMN tank_volume_liters SET DEFAULT 300;

-- Comentários descritivos
COMMENT ON COLUMN public.user_settings.tank_volume_liters IS 'Volume bruto do display / aquário principal em litros';
COMMENT ON COLUMN public.user_settings.sump_liters        IS 'Volume do sump em litros (0 se não tiver)';
COMMENT ON COLUMN public.user_settings.rock_kg            IS 'Estimativa de rocha viva em kg (1 kg ≈ 0,5 L deslocado)';

-- Verificação
SELECT
  tank_volume_liters,
  sump_liters,
  rock_kg,
  tank_volume_liters + COALESCE(sump_liters,0) - COALESCE(rock_kg,0)*0.5 AS volume_real_estimado_l
FROM public.user_settings
LIMIT 5;
