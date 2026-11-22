const { atendimento, clientes } = require("../config/database");

async function registrar({
  atendimentoId, usuarioSistemaId, acao,
  valorAnterior = null, valorNovo = null, observacao = null
}) {
  const resultado = await atendimento.query(
    `INSERT INTO wb_historico_atendimentos (
       atendimento_id, usuario_sistema_id, acao,
       valor_anterior, valor_novo, observacao
     )
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
     RETURNING *`,
    [
      atendimentoId, usuarioSistemaId, acao,
      valorAnterior ? JSON.stringify(valorAnterior) : null,
      valorNovo ? JSON.stringify(valorNovo) : null,
      observacao
    ]
  );
  return resultado.rows[0];
}

async function listarPorAtendimento(atendimentoId) {
  const resultado = await atendimento.query(
    `SELECT h.*, u.nome AS usuario_sistema_nome
       FROM wb_historico_atendimentos h
       LEFT JOIN wb_usuarios_sistema u ON u.id = h.usuario_sistema_id
      WHERE h.atendimento_id = $1
      ORDER BY h.criado_em ASC, h.id ASC`,
    [atendimentoId]
  );
  return resultado.rows;
}

async function listarTodos() {
  const resultado = await atendimento.query(
    `SELECT h.id, h.atendimento_id, a.usuario_id, a.protocolo,
            a.status AS atendimento_status, h.usuario_sistema_id,
            hs.nome AS usuario_sistema_nome, h.acao, h.valor_anterior,
            h.valor_novo, h.observacao, h.criado_em
       FROM wb_historico_atendimentos h
       JOIN wb_atendimentos a ON a.id = h.atendimento_id
       LEFT JOIN wb_usuarios_sistema hs ON hs.id = h.usuario_sistema_id
      ORDER BY h.criado_em DESC, h.id DESC`
  );

  const usuarioIds = [...new Set(
    resultado.rows.map(r => r.usuario_id).filter(id => id !== null)
  )];
  const clientesResult = usuarioIds.length
    ? await clientes.query(
        `SELECT id, nome FROM wb_usuarios WHERE id = ANY($1::bigint[])`,
        [usuarioIds]
      )
    : { rows: [] };
  const nomes = new Map(clientesResult.rows.map(u => [String(u.id), u.nome]));

  return resultado.rows.map(r => ({
    ...r,
    cliente_nome: nomes.get(String(r.usuario_id)) || null
  }));
}

module.exports = { registrar, listarPorAtendimento, listarTodos };
