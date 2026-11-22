const { atendimento } = require("../config/database");

async function buscarPorTelefone(telefone) {
  const { rows } = await atendimento.query(
    `SELECT * FROM wb_sessoes_whatsapp WHERE telefone = $1`,
    [telefone]
  );
  return rows[0] || null;
}

async function salvar({
  telefone, whatsappId, nomeCliente, estado,
  setorId = null, empresaId = null, ultimaMensagemId = null
}) {
  const { rows } = await atendimento.query(
    `INSERT INTO wb_sessoes_whatsapp (
       telefone, whatsapp_id, nome_cliente, estado, setor_id,
       empresa_id, ultima_mensagem_id, atualizado_em
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (telefone)
     DO UPDATE SET
       whatsapp_id = EXCLUDED.whatsapp_id,
       nome_cliente = EXCLUDED.nome_cliente,
       estado = EXCLUDED.estado,
       setor_id = EXCLUDED.setor_id,
       empresa_id = EXCLUDED.empresa_id,
       ultima_mensagem_id = EXCLUDED.ultima_mensagem_id,
       atualizado_em = NOW()
     RETURNING *`,
    [telefone, whatsappId, nomeCliente, estado, setorId,
      empresaId, ultimaMensagemId]
  );
  return rows[0];
}

async function atualizarEstado(
  telefone, estado, setorId = null, empresaId = null, ultimaMensagemId = null
) {
  const { rows } = await atendimento.query(
    `UPDATE wb_sessoes_whatsapp
        SET estado = $2, setor_id = $3, empresa_id = $4,
            ultima_mensagem_id = $5, atualizado_em = NOW()
      WHERE telefone = $1
      RETURNING *`,
    [telefone, estado, setorId, empresaId, ultimaMensagemId]
  );
  return rows[0] || null;
}

async function remover(telefone) {
  await atendimento.query(
    `DELETE FROM wb_sessoes_whatsapp WHERE telefone = $1`,
    [telefone]
  );
}

module.exports = { buscarPorTelefone, salvar, atualizarEstado, remover };
