-- Execute somente depois de confirmar backup e que a aplicação não usa
-- logwbatendimento.wb_historico_atendimentos. O histórico oficial permanece
-- em wbatendimento.wb_historico_atendimentos.
DROP TABLE IF EXISTS public.wb_historico_atendimentos;
