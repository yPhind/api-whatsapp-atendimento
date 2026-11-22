
const { atendimento } = require("../config/database");

async function criar({
  atendimentoId,
  usuarioSistemaId,
  telefoneDestino,
  conteudo
}) {
  const resultado = await atendimento.query(
    `INSERT INTO public.wb_mensagens_outbox (
       atendimento_id,
       usuario_sistema_id,
       telefone_destino,
       tipo,
       conteudo
     )
     VALUES ($1, $2, $3, 'texto', $4)
     RETURNING *`,
    [
      atendimentoId,
      usuarioSistemaId,
      telefoneDestino,
      conteudo
    ]
  );

  return resultado.rows[0];
}

async function buscarProxima() {
  const resultado = await atendimento.query(
    `WITH proxima AS (
       SELECT id
         FROM public.wb_mensagens_outbox
        WHERE status = 'pendente'
          AND proxima_tentativa_em <= NOW()
        ORDER BY criado_em ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     UPDATE public.wb_mensagens_outbox AS fila
        SET status = 'processando',
            tentativas = tentativas + 1,
            iniciado_em = NOW(),
            atualizado_em = NOW()
       FROM proxima
      WHERE fila.id = proxima.id
      RETURNING fila.*`
  );

  return resultado.rows[0] || null;
}

async function marcarEnviada(id, identificadorExterno) {
  const resultado = await atendimento.query(
    `UPDATE public.wb_mensagens_outbox
        SET status = 'enviada',
            identificador_externo = $2,
            enviada_em = NOW(),
            erro_resumido = NULL,
            atualizado_em = NOW()
      WHERE id = $1
        AND status = 'processando'
      RETURNING *`,
    [id, identificadorExterno]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(id, erro, atrasoMinutos = 5) {
  const resultado = await atendimento.query(
    `UPDATE public.wb_mensagens_outbox
        SET status = CASE
              WHEN tentativas >= 5 THEN 'falha'
              ELSE 'pendente'
            END,
            erro_resumido = $2,
            proxima_tentativa_em =
              NOW() + ($3 * INTERVAL '1 minute'),
            atualizado_em = NOW()
      WHERE id = $1
        AND status = 'processando'
      RETURNING *`,
    [
      id,
      String(erro?.message || "Falha no envio").slice(0, 1000),
      atrasoMinutos
    ]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  criar,
  buscarProxima,
  marcarEnviada,
  marcarFalha
};
