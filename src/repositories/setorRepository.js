const { atendimento } = require("../config/database");

async function listarAtivos() {
  const resultado = await atendimento.query(
    `SELECT id, nome, descricao
       FROM wb_setores
      WHERE ativo = TRUE
      ORDER BY id`
  );
  return resultado.rows;
}

async function buscarPorId(id) {
  const resultado = await atendimento.query(
    `SELECT id, nome, descricao
       FROM wb_setores
      WHERE id = $1 AND ativo = TRUE`,
    [id]
  );
  return resultado.rows[0] || null;
}

module.exports = { listarAtivos, buscarPorId };
