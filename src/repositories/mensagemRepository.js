
const { atendimento } = require("../config/database");

async function criar({
  atendimentoId,
  remetenteTipo,
  remetenteId = null,
  direcao,
  tipo = "texto",
  conteudo = null,
  midiaUrl = null,
  identificadorExterno = null,
  dadosExtras = {}
}) {
  const resultado = await atendimento.query(
    `INSERT INTO wb_mensagens (
       atendimento_id,
       remetente_tipo,
       remetente_id,
       direcao,
       tipo,
       conteudo,
       midia_url,
       identificador_externo,
       dados_extras
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (identificador_externo) DO NOTHING
     RETURNING *`,
    [
      atendimentoId,
      remetenteTipo,
      remetenteId,
      direcao,
      tipo,
      conteudo,
      midiaUrl,
      identificadorExterno,
      JSON.stringify(dadosExtras)
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarStatusPorIdentificador(
  identificadorExterno,
  statusMeta
) {
  const mapaStatus = {
    sent: "enviada",
    delivered: "entregue",
    read: "lida",
    failed: "falha"
  };

  const novoStatus = mapaStatus[statusMeta];

  if (!novoStatus) {
    return null;
  }

  const resultado = await atendimento.query(
    `UPDATE wb_mensagens
        SET status_envio = CASE
          WHEN status_envio = 'lida' THEN 'lida'
          WHEN $2 = 'falha' THEN 'falha'
          WHEN status_envio = 'falha' THEN 'falha'
          WHEN
            CASE status_envio
              WHEN 'recebida' THEN 0
              WHEN 'aguardando_envio' THEN 1
              WHEN 'enviada' THEN 2
              WHEN 'entregue' THEN 3
              WHEN 'lida' THEN 4
              ELSE 0
            END
            <
            CASE $2
              WHEN 'enviada' THEN 2
              WHEN 'entregue' THEN 3
              WHEN 'lida' THEN 4
              ELSE 0
            END
          THEN $2
          ELSE status_envio
        END,
        enviado_em = CASE
          WHEN $2 IN ('enviada', 'entregue', 'lida')
            THEN COALESCE(enviado_em, NOW())
          ELSE enviado_em
        END,
        atualizado_em = NOW()
      WHERE identificador_externo = $1
      RETURNING id, atendimento_id, status_envio`,
    [identificadorExterno, novoStatus]
  );

  return resultado.rows[0] || null;
}

async function listarPorAtendimento(atendimentoId) {
  const resultado = await atendimento.query(
    `SELECT *
       FROM wb_mensagens
      WHERE atendimento_id = $1
      ORDER BY criado_em ASC, id ASC`,
    [atendimentoId]
  );

  return resultado.rows;
}

module.exports = {
  criar,
  atualizarStatusPorIdentificador,
  listarPorAtendimento
};
