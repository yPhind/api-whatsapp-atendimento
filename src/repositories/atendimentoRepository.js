const { atendimento, clientes } = require("../config/database");

/**
 * Complementa os registros operacionais com os dados de contato e empresa.
 * Como os bancos são independentes, as consultas são feitas separadamente,
 * sem JOIN ou chave estrangeira entre bancos.
 */
async function incluirDadosClientes(registros) {
  if (!registros.length) return registros;

  const usuarioIds = [...new Set(
    registros.map(r => r.usuario_id).filter(id => id !== null && id !== undefined)
  )];
  const empresaIds = [...new Set(
    registros.map(r => r.empresa_id).filter(id => id !== null && id !== undefined)
  )];

  const [usuariosResult, empresasResult] = await Promise.all([
    usuarioIds.length
      ? clientes.query(
          `SELECT id, nome, telefone, whatsapp_id, empresa_id
             FROM wb_usuarios
            WHERE id = ANY($1::bigint[])`,
          [usuarioIds]
        )
      : Promise.resolve({ rows: [] }),
    empresaIds.length
      ? clientes.query(
          `SELECT id, cnpj, razao_social, nome_fantasia, status
             FROM wb_empresas
            WHERE id = ANY($1::bigint[])`,
          [empresaIds]
        )
      : Promise.resolve({ rows: [] })
  ]);

  const usuarios = new Map(usuariosResult.rows.map(u => [String(u.id), u]));
  const empresas = new Map(empresasResult.rows.map(e => [String(e.id), e]));

  return registros.map(registro => {
    const usuario = usuarios.get(String(registro.usuario_id));
    const empresa = empresas.get(String(registro.empresa_id));
    return {
      ...registro,
      usuario_nome: usuario?.nome ?? null,
      usuario_telefone: usuario?.telefone ?? null,
      usuario_whatsapp_id: usuario?.whatsapp_id ?? null,
      cliente_nome: usuario?.nome ?? null,
      cliente_telefone: usuario?.telefone ?? null,
      cnpj: empresa?.cnpj ?? null,
      empresa_cnpj: empresa?.cnpj ?? null,
      empresa_razao_social: empresa?.razao_social ?? null,
      empresa_nome_fantasia: empresa?.nome_fantasia ?? null
    };
  });
}

async function criar({
  usuarioId, setorId, empresaId, descricao, protocolo,
  atendimentoOrigemId = null
}) {
  const resultado = await atendimento.query(
    `INSERT INTO wb_atendimentos
       (usuario_id, setor_id, empresa_id, descricao, protocolo, atendimento_origem_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [usuarioId, setorId, empresaId, descricao, protocolo, atendimentoOrigemId]
  );
  return resultado.rows[0];
}

async function buscarPorId(id) {
  const resultado = await atendimento.query(
    `SELECT a.*, s.nome AS setor_nome, an.nome AS analista_nome
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE a.id = $1`,
    [id]
  );
  const registros = await incluirDadosClientes(resultado.rows);
  return registros[0] || null;
}

async function buscarAbertoPorTelefone(telefone) {
  const contato = await clientes.query(
    `SELECT id FROM wb_usuarios WHERE telefone = $1 LIMIT 1`,
    [telefone]
  );
  if (!contato.rows[0]) return null;

  const resultado = await atendimento.query(
    `SELECT a.*, s.nome AS setor_nome, an.nome AS analista_nome
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE a.usuario_id = $1
        AND a.arquivado = FALSE
        AND a.status <> 'realizado'
      ORDER BY a.atualizado_em DESC NULLS LAST, a.id DESC
      LIMIT 1`,
    [contato.rows[0].id]
  );
  const registros = await incluirDadosClientes(resultado.rows);
  return registros[0] || null;
}

async function listarFila(setorId = null) {
  const resultado = await atendimento.query(
    `SELECT a.id, a.usuario_id, a.empresa_id, a.protocolo, a.descricao,
            a.atendimento_origem_id, a.status, a.criado_em,
            s.nome AS setor_nome, a.setor_id
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
      WHERE ($1::integer IS NULL OR a.setor_id = $1)
        AND a.analista_id IS NULL
        AND a.status = 'aguardando'
        AND a.arquivado = FALSE
      ORDER BY a.id DESC`,
    [setorId]
  );
  return incluirDadosClientes(resultado.rows);
}

async function listarDoAnalista(analistaId) {
  const resultado = await atendimento.query(
    `SELECT a.*, s.nome AS setor_nome, an.nome AS analista_nome
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE a.analista_id = $1
        AND a.arquivado = FALSE
        AND a.status IN ('em_atendimento', 'pendente')
      ORDER BY a.id DESC`,
    [analistaId]
  );
  return incluirDadosClientes(resultado.rows);
}

async function listarTodosParaSupervisor() {
  const resultado = await atendimento.query(
    `SELECT a.*, s.nome AS setor_nome, an.nome AS analista_nome
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE a.arquivado = FALSE
      ORDER BY a.id DESC`
  );
  return incluirDadosClientes(resultado.rows);
}

async function assumir({ atendimentoId, analistaId, setorId }) {
  const resultado = await atendimento.query(
    `UPDATE wb_atendimentos
        SET analista_id = $2,
            status = 'em_atendimento',
            iniciado_em = COALESCE(iniciado_em, CURRENT_TIMESTAMP),
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
        AND ($3::integer IS NULL OR setor_id = $3::integer)
        AND analista_id IS NULL
        AND status = 'aguardando'
        AND arquivado = FALSE
      RETURNING *`,
    [atendimentoId, analistaId, setorId]
  );
  return resultado.rows[0] || null;
}

async function atribuirParaAnalista({ atendimentoId, analistaId }) {
  const resultado = await atendimento.query(
    `UPDATE wb_atendimentos
        SET analista_id = $2, status = 'em_atendimento',
            iniciado_em = COALESCE(iniciado_em, CURRENT_TIMESTAMP),
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND arquivado = FALSE AND status <> 'realizado'
      RETURNING *`,
    [atendimentoId, analistaId]
  );
  return resultado.rows[0] || null;
}

async function alterarStatus({
  atendimentoId, analistaId, status, isSupervisor = false
}) {
  let resultado;
  if (status === "aguardando") {
    resultado = await atendimento.query(
      `UPDATE wb_atendimentos
          SET status = 'aguardando', analista_id = NULL,
              iniciado_em = NULL, finalizado_em = NULL,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
          AND ($3::boolean = TRUE OR analista_id = $2)
          AND arquivado = FALSE
          AND (LOWER(status) <> 'realizado' OR $3::boolean = TRUE)
        RETURNING *`,
      [atendimentoId, analistaId, isSupervisor]
    );
  } else if (status === "realizado") {
    resultado = await atendimento.query(
      `UPDATE wb_atendimentos
          SET status = $3, finalizado_em = CURRENT_TIMESTAMP,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
          AND ($4::boolean = TRUE OR analista_id = $2)
          AND arquivado = FALSE
          AND (status <> 'realizado' OR $4::boolean = TRUE)
        RETURNING *`,
      [atendimentoId, analistaId, status, isSupervisor]
    );
  } else {
    resultado = await atendimento.query(
      `UPDATE wb_atendimentos
          SET status = $3, finalizado_em = NULL,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
          AND ($4::boolean = TRUE OR analista_id = $2)
          AND arquivado = FALSE
          AND (
            status <> 'realizado'
            OR $4::boolean = TRUE
            OR ($3 = 'pendente' AND status = 'realizado')
          )
        RETURNING *`,
      [atendimentoId, analistaId, status, isSupervisor]
    );
  }
  return resultado.rows[0] || null;
}

async function devolverParaFila(atendimentoId) {
  const resultado = await atendimento.query(
    `UPDATE wb_atendimentos
        SET analista_id = NULL, status = 'aguardando',
            iniciado_em = NULL, finalizado_em = NULL,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND arquivado = FALSE AND status <> 'realizado'
      RETURNING *`,
    [atendimentoId]
  );
  return resultado.rows[0] || null;
}


async function listarHistorico(analistaId = null) {
  const resultado = await atendimento.query(
    `SELECT a.*,
            s.nome AS setor_nome,
            an.nome AS analista_nome,
            (SELECT COUNT(*)::integer
               FROM wb_mensagens m
              WHERE m.atendimento_id = a.id) AS total_mensagens,
            (SELECT MAX(m.criado_em)
               FROM wb_mensagens m
              WHERE m.atendimento_id = a.id) AS ultima_mensagem_em
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE (a.status = 'realizado' OR a.arquivado = TRUE)
        AND ($1::bigint IS NULL OR a.analista_id = $1)
      ORDER BY COALESCE(
        (SELECT MAX(m.criado_em)
           FROM wb_mensagens m
          WHERE m.atendimento_id = a.id),
        a.atualizado_em,
        a.criado_em
      ) DESC, a.id DESC`,
    [analistaId]
  );

  return incluirDadosClientes(resultado.rows);
}


async function alterarSetor({ atendimentoId, setorId }) {
  const resultado = await atendimento.query(
    `UPDATE wb_atendimentos
        SET setor_id = $2, analista_id = NULL, status = 'aguardando',
            iniciado_em = NULL, finalizado_em = NULL,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND arquivado = FALSE AND status <> 'realizado'
      RETURNING *`,
    [atendimentoId, setorId]
  );
  return resultado.rows[0] || null;
}

async function editarDados({ atendimentoId, setorId, descricao }) {
  const resultado = await atendimento.query(
    `UPDATE wb_atendimentos
        SET setor_id = $2, descricao = $3,
            analista_id = CASE WHEN setor_id <> $2 THEN NULL ELSE analista_id END,
            status = CASE WHEN setor_id <> $2 THEN 'aguardando' ELSE status END,
            iniciado_em = CASE WHEN setor_id <> $2 THEN NULL ELSE iniciado_em END,
            finalizado_em = CASE WHEN setor_id <> $2 THEN NULL ELSE finalizado_em END,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND arquivado = FALSE
      RETURNING *`,
    [atendimentoId, setorId, descricao]
  );
  return resultado.rows[0] || null;
}

module.exports = {
  criar, buscarPorId, buscarAbertoPorTelefone, listarFila, listarDoAnalista,
  listarTodosParaSupervisor, listarHistorico, assumir, atribuirParaAnalista,
  alterarStatus, editarDados, devolverParaFila, alterarSetor,
  incluirDadosClientes
};
