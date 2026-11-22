const { tarefas } = require("../config/database");

async function listarPorUsuario(usuarioId, realizadas = false) {
  const resultado = await tarefas.query(
    `SELECT t.id, t.titulo, t.observacao, t.data_prevista, t.criado_em, t.status,
            COALESCE(
              json_agg(json_build_object('id', a.id, 'nome_original', a.nome_original,
                'mime_type', a.mime_type, 'tamanho', a.tamanho))
                FILTER (WHERE a.id IS NOT NULL), '[]'
            ) AS anexos
       FROM wb_tarefas t
       LEFT JOIN wb_tarefas_anexos a ON a.tarefa_id = t.id
      WHERE t.usuario_id = $1 AND t.status = $2
      GROUP BY t.id
      ORDER BY t.criado_em DESC, t.id DESC`,
    [usuarioId, realizadas ? "realizada" : "em_digitacao"]
  );
  return resultado.rows;
}
async function criar({ usuarioId, titulo, observacao, dataPrevista }) {
  const resultado = await tarefas.query(
    `INSERT INTO wb_tarefas (usuario_id, titulo, observacao, data_prevista, status)
     VALUES ($1, $2, $3, $4, 'em_digitacao') RETURNING *`,
    [usuarioId, titulo, observacao, dataPrevista]
  );
  return resultado.rows[0];
}
async function buscar(id, usuarioId) {
  const resultado = await tarefas.query(
    "SELECT * FROM wb_tarefas WHERE id = $1 AND usuario_id = $2", [id, usuarioId]
  );
  return resultado.rows[0] || null;
}
async function atualizar({ id, usuarioId, titulo, observacao, dataPrevista }) {
  const resultado = await tarefas.query(
    `UPDATE wb_tarefas SET titulo = $3, observacao = $4, data_prevista = $5, atualizado_em = NOW()
      WHERE id = $1 AND usuario_id = $2 AND status = 'em_digitacao' RETURNING *`,
    [id, usuarioId, titulo, observacao, dataPrevista]
  );
  return resultado.rows[0] || null;
}
async function alterarStatus(id, usuarioId, status) {
  const resultado = await tarefas.query(
    "UPDATE wb_tarefas SET status = $3, atualizado_em = NOW() WHERE id = $1 AND usuario_id = $2 RETURNING *",
    [id, usuarioId, status]
  );
  return resultado.rows[0] || null;
}
async function adicionarAnexos({ tarefaId, arquivos }) {
  const client = await tarefas.connect();
  try {
    await client.query("BEGIN");
    const anexos = [];
    for (const arquivo of arquivos) {
      const resultado = await client.query(
        `INSERT INTO wb_tarefas_anexos (tarefa_id, nome_original, nome_arquivo, mime_type, tamanho)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tarefaId, arquivo.originalname, arquivo.filename, arquivo.mimetype, arquivo.size]
      );
      anexos.push(resultado.rows[0]);
    }
    await client.query("COMMIT");
    return anexos;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}
async function buscarAnexo(id, usuarioId) {
  const resultado = await tarefas.query(
    `SELECT a.* FROM wb_tarefas_anexos a
      JOIN wb_tarefas t ON t.id = a.tarefa_id
      WHERE a.id = $1 AND t.usuario_id = $2`,
    [id, usuarioId]
  );
  return resultado.rows[0] || null;
}
async function removerAnexo(id, usuarioId) {
  const resultado = await tarefas.query(
    `DELETE FROM wb_tarefas_anexos a USING wb_tarefas t
      WHERE a.tarefa_id = t.id AND a.id = $1 AND t.usuario_id = $2
      RETURNING a.*`,
    [id, usuarioId]
  );
  return resultado.rows[0] || null;
}
module.exports = { listarPorUsuario, criar, buscar, atualizar, alterarStatus, adicionarAnexos, buscarAnexo, removerAnexo };
