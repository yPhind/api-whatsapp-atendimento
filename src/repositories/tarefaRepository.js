
const { tarefas } = require("../config/database");

const STATUS_VALIDOS = ["em_digitacao", "realizada"];

function validarId(valor, campo = "ID") {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${campo}_INVALIDO`);
  }

  return id;
}

function validarStatus(status) {
  if (!STATUS_VALIDOS.includes(status)) {
    throw new Error("STATUS_TAREFA_INVALIDO");
  }
}


async function listarPorUsuario(
  usuarioId,
  realizadas = false,
  todosUsuarios = false,
  filtros = {}
) {
  const status = realizadas ? "realizada" : "em_digitacao";

  const parametros = [status];
  const condicoes = ["t.status = $1"];

  // Analista visualiza somente as próprias tarefas.
  // Supervisor pode visualizar tarefas de todos os usuários.
  if (!todosUsuarios) {
    const id = validarId(usuarioId, "USUARIO_ID");
    parametros.push(id);
    condicoes.push(`t.usuario_id = $${parametros.length}`);
  } else if (filtros.usuarioId) {
    const id = validarId(filtros.usuarioId, "USUARIO_ID");
    parametros.push(id);
    condicoes.push(`t.usuario_id = $${parametros.length}`);
  }

  // Filtro por cliente/empresa.
  if (filtros.empresaId) {
    const empresaId = validarId(filtros.empresaId, "EMPRESA_ID");
    parametros.push(empresaId);
    condicoes.push(`t.empresa_id = $${parametros.length}`);
  }

  // Filtro por data prevista.
  if (filtros.dataPrevista) {
    parametros.push(filtros.dataPrevista);
    condicoes.push(`t.data_prevista = $${parametros.length}::date`);
  }

  const resultado = await tarefas.query(
    `SELECT
       t.id,
       t.usuario_id,
       t.empresa_id,
       t.titulo,
       t.observacao,
       t.data_prevista,
       t.status,
       t.criado_em,
       t.atualizado_em,
       COALESCE(
         json_agg(
           json_build_object(
             'id', a.id,
             'nome_original', a.nome_original,
             'mime_type', a.mime_type,
             'tamanho', a.tamanho
           )
           ORDER BY a.id
         ) FILTER (WHERE a.id IS NOT NULL),
         '[]'::json
       ) AS anexos
     FROM wb_tarefas t
     LEFT JOIN wb_tarefas_anexos a
       ON a.tarefa_id = t.id
     WHERE ${condicoes.join(" AND ")}
     GROUP BY t.id
     ORDER BY t.criado_em DESC, t.id DESC`,
    parametros
  );

  return resultado.rows;
}

async function criar({
  usuarioId,
  empresaId,
  titulo,
  observacao,
  dataPrevista
}) {
  const id = validarId(usuarioId, "USUARIO_ID");

  const resultado = await tarefas.query(
    `INSERT INTO wb_tarefas (
       usuario_id,
       empresa_id,
       titulo,
       observacao,
       data_prevista,
       status
     )
     VALUES ($1, $2, $3, $4, $5, 'em_digitacao')
     RETURNING *`,
    [
      id,
      empresaId || null,
      titulo,
      observacao,
      dataPrevista || null
    ]
  );

  return resultado.rows[0];
}

async function buscar(id, usuarioId) {
  const tarefaId = validarId(id, "TAREFA_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  const resultado = await tarefas.query(
    `SELECT *
       FROM wb_tarefas
      WHERE id = $1
        AND usuario_id = $2
      LIMIT 1`,
    [tarefaId, usuario]
  );

  return resultado.rows[0] || null;
}

async function atualizar({
  id,
  usuarioId,
  empresaId,
  titulo,
  observacao,
  dataPrevista
}) {
  const tarefaId = validarId(id, "TAREFA_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  const resultado = await tarefas.query(
    `UPDATE wb_tarefas
        SET empresa_id = $3,
            titulo = $4,
            observacao = $5,
            data_prevista = $6,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
        AND usuario_id = $2
        AND status = 'em_digitacao'
      RETURNING *`,
    [
      tarefaId,
      usuario,
      empresaId || null,
      titulo,
      observacao,
      dataPrevista || null
    ]
  );

  return resultado.rows[0] || null;
}

async function alterarStatus(id, usuarioId, status) {
  const tarefaId = validarId(id, "TAREFA_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  validarStatus(status);

  const resultado = await tarefas.query(
    `UPDATE wb_tarefas
        SET status = $3,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
        AND usuario_id = $2
      RETURNING *`,
    [tarefaId, usuario, status]
  );

  return resultado.rows[0] || null;
}

async function adicionarAnexos({ tarefaId, usuarioId, arquivos }) {
  const id = validarId(tarefaId, "TAREFA_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  if (!Array.isArray(arquivos) || arquivos.length === 0) {
    throw new Error("ARQUIVOS_OBRIGATORIOS");
  }

  const client = await tarefas.connect();
  let transacaoIniciada = false;

  try {
    await client.query("BEGIN");
    transacaoIniciada = true;

    // Bloqueia a tarefa durante a operação para impedir
    // alterações concorrentes de situação.
    const tarefa = await client.query(
      `SELECT id
         FROM wb_tarefas
        WHERE id = $1
          AND usuario_id = $2
          AND status = 'em_digitacao'
        FOR UPDATE`,
      [id, usuario]
    );

    if (tarefa.rowCount === 0) {
      throw new Error("TAREFA_NAO_ENCONTRADA_OU_FINALIZADA");
    }

    const anexos = [];

    for (const arquivo of arquivos) {
      if (
        !arquivo ||
        !arquivo.originalname ||
        !arquivo.filename ||
        !arquivo.mimetype ||
        !Number.isInteger(arquivo.size) ||
        arquivo.size < 0
      ) {
        throw new Error("DADOS_ANEXO_INVALIDOS");
      }

      const resultado = await client.query(
        `INSERT INTO wb_tarefas_anexos (
           tarefa_id,
           nome_original,
           nome_arquivo,
           mime_type,
           tamanho
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          id,
          arquivo.originalname,
          arquivo.filename,
          arquivo.mimetype,
          arquivo.size
        ]
      );

      anexos.push(resultado.rows[0]);
    }

    await client.query("COMMIT");
    transacaoIniciada = false;

    return anexos;
  } catch (erro) {
    if (transacaoIniciada) {
      try {
        await client.query("ROLLBACK");
      } catch (erroRollback) {
        console.error(
          "[TAREFA REPOSITORY] Falha no rollback:",
          erroRollback.message
        );
      }
    }

    throw erro;
  } finally {
    client.release();
  }
}

async function buscarAnexo(id, usuarioId) {
  const anexoId = validarId(id, "ANEXO_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  const resultado = await tarefas.query(
    `SELECT a.*
       FROM wb_tarefas_anexos a
       INNER JOIN wb_tarefas t
         ON t.id = a.tarefa_id
      WHERE a.id = $1
        AND t.usuario_id = $2
      LIMIT 1`,
    [anexoId, usuario]
  );

  return resultado.rows[0] || null;
}

async function removerAnexo(id, usuarioId) {
  const anexoId = validarId(id, "ANEXO_ID");
  const usuario = validarId(usuarioId, "USUARIO_ID");

  const resultado = await tarefas.query(
    `DELETE FROM wb_tarefas_anexos a
     USING wb_tarefas t
     WHERE a.tarefa_id = t.id
       AND a.id = $1
       AND t.usuario_id = $2
     RETURNING a.*`,
    [anexoId, usuario]
  );

  return resultado.rows[0] || null;
}


// Busca somente os campos textuais necessários para impressão.
// Nenhuma informação da tabela de anexos é consultada.
async function listarParaImpressao(ids, usuarioId, ehSupervisor = false) {
  const idsValidos = [...new Set(ids.map(id => validarId(id, "TAREFA_ID")))];
  const usuario = validarId(usuarioId, "USUARIO_ID");

  if (!idsValidos.length || idsValidos.length > 50) {
    throw new Error("QUANTIDADE_TAREFAS_IMPRESSAO_INVALIDA");
  }

  const resultado = await tarefas.query(
    `SELECT
       id,
       usuario_id,
       empresa_id,
       titulo,
       observacao,
       data_prevista,
       status,
       criado_em
     FROM wb_tarefas
     WHERE id = ANY($1::bigint[])
       AND ($2::boolean = TRUE OR usuario_id = $3)
     ORDER BY criado_em DESC, id DESC`,
    [idsValidos, Boolean(ehSupervisor), usuario]
  );

  return resultado.rows;
}

module.exports = {
  listarPorUsuario,
  listarParaImpressao,
  criar,
  buscar,
  atualizar,
  alterarStatus,
  adicionarAnexos,
  buscarAnexo,
  removerAnexo
};
