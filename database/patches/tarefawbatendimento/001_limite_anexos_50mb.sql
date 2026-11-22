-- Aumenta o limite por arquivo para 50 MiB.
-- Idempotente; não altera nem exclui anexos existentes.
ALTER TABLE public.wb_tarefas_anexos
  DROP CONSTRAINT IF EXISTS wb_tarefas_anexos_tamanho_check;
ALTER TABLE public.wb_tarefas_anexos
  ADD CONSTRAINT wb_tarefas_anexos_tamanho_check
  CHECK (tamanho > 0 AND tamanho <= 52428800);
