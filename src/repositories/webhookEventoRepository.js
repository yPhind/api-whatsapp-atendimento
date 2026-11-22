
const { atendimento } = require("../config/database");

async function iniciar({
  chaveEvento,
  identificadorExterno,
  tipoEvento
}) {
  const resultado = await atendimento.query(
    `INSERT INTO public.wb_webhook_eventos (
       chave_evento,
       identificador_externo,
       tipo_evento,
       status_processamento
     )
     VALUES ($1, $2, $3, 'processando')
     ON CONFLICT (chave_evento) DO NOTHING
     RETURNING id`,
    [chaveEvento, identificadorExterno, tipoEvento]
  );

  return resultado.rows[0] || null;
}

async function concluir(chaveEvento) {
  const resultado = await atendimento.query(
    `UPDATE public.wb_webhook_eventos
        SET status_processamento = 'concluido',
            concluido_em = NOW(),
            atualizado_em = NOW(),
            erro_resumido = NULL
      WHERE chave_evento = $1
        AND status_processamento = 'processando'
      RETURNING id`,
    [chaveEvento]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(chaveEvento, erro) {
  const mensagem = String(erro?.message || "Erro desconhecido")
    .slice(0, 1000);

  const resultado = await atendimento.query(
    `UPDATE public.wb_webhook_eventos
        SET status_processamento = 'falha',
            erro_resumido = $2,
            atualizado_em = NOW()
      WHERE chave_evento = $1
        AND status_processamento = 'processando'
      RETURNING id`,
    [chaveEvento, mensagem]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  iniciar,
  concluir,
  marcarFalha
};
