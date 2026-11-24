const { atendimento, clientes, logs } = require("../config/database");

function adicionarLike(condicoes, parametros, expressao, valor) {
  const texto = String(valor || "").trim();
  if (!texto) return;
  parametros.push(`%${texto}%`);
  condicoes.push(`${expressao} ILIKE $${parametros.length}`);
}

async function anexarDadosClientes(registros) {
  if (!registros.length) return registros;
  const usuarioIds = [...new Set(registros.map(r => r.usuario_id).filter(id => id != null))];
  const empresaIds = [...new Set(registros.map(r => r.empresa_id).filter(id => id != null))];

  const [usuarios, empresas] = await Promise.all([
    usuarioIds.length
      ? clientes.query(
          `SELECT id, nome, telefone FROM wb_usuarios WHERE id = ANY($1::bigint[])`,
          [usuarioIds]
        )
      : Promise.resolve({ rows: [] }),
    empresaIds.length
      ? clientes.query(
          `SELECT id, cnpj FROM wb_empresas WHERE id = ANY($1::bigint[])`,
          [empresaIds]
        )
      : Promise.resolve({ rows: [] })
  ]);

  const mapaUsuarios = new Map(usuarios.rows.map(u => [String(u.id), u]));
  const mapaEmpresas = new Map(empresas.rows.map(e => [String(e.id), e]));
  return registros.map(r => {
    const u = mapaUsuarios.get(String(r.usuario_id));
    const e = mapaEmpresas.get(String(r.empresa_id));
    return {
      ...r,
      cliente_nome: u?.nome ?? null,
      cliente_telefone: u?.telefone ?? null,
      empresa_cnpj: e?.cnpj ?? null
    };
  });
}


async function listarLogs(filtros = {}) {
  const condicoes = [];
  const parametros = [];

  const mapaFiltros = {
    nivel: "l.nivel",
    origem: "l.origem",
    evento: "l.evento",
    mensagem: "l.mensagem",
    atendimento: "l.atendimento_id::text",
    usuario: "l.usuario_sistema_id::text",
    correlacao: "l.correlacao_id"
  };

  for (const [campo, expressao] of Object.entries(mapaFiltros)) {
    adicionarLike(condicoes, parametros, expressao, filtros[campo]);
  }

  if (filtros.dataInicio) {
    parametros.push(filtros.dataInicio);
    condicoes.push(`l.criado_em >= $${parametros.length}::date`);
  }

  if (filtros.dataFim) {
    parametros.push(filtros.dataFim);
    condicoes.push(
      `l.criado_em < ($${parametros.length}::date + INTERVAL '1 day')`
    );
  }

  const where = condicoes.length
    ? `WHERE ${condicoes.join(" AND ")}`
    : "";

  // Busca os registros no banco de logs.
  const resultado = await logs.query(
    `
      SELECT
        l.id,
        l.nivel,
        l.origem,
        l.evento,
        l.mensagem,
        l.usuario_sistema_id,
        l.atendimento_id,
        l.correlacao_id,
        l.contexto,
        l.criado_em
      FROM public.wb_logs l
      ${where}
      ORDER BY l.criado_em DESC, l.id DESC
      LIMIT 5000
    `,
    parametros
  );

  const registros = resultado.rows;

  if (!registros.length) {
    return registros;
  }

  // IDs dos atendimentos vinculados aos logs.
  const atendimentoIds = [
    ...new Set(
      registros
        .map(registro => registro.atendimento_id)
        .filter(id => id != null)
        .map(String)
    )
  ];

  const usuariosSistemaIds = [
    ...new Set(
      registros
        .map(registro => registro.usuario_sistema_id)
        .filter(id => id != null)
        .map(String)
    )
  ];

  const usuariosClienteIds = [
    ...new Set(
      registros
        .map(registro => registro.contexto?.usuario_cliente_id)
        .filter(id => id != null)
        .map(String)
    )
  ];

  // Consultas independentes aos bancos correspondentes.
  const [
    atendimentos,
    usuariosSistema,
    usuariosClientes
  ] = await Promise.all([

    atendimentoIds.length
      ? atendimento.query(
          `SELECT id, protocolo
             FROM wb_atendimentos
            WHERE id = ANY($1::bigint[])`,
          [atendimentoIds]
        )
      : Promise.resolve({ rows: [] }),

    usuariosSistemaIds.length
      ? atendimento.query(
          `SELECT id, nome
             FROM wb_usuarios_sistema
            WHERE id = ANY($1::bigint[])`,
          [usuariosSistemaIds]
        )
      : Promise.resolve({ rows: [] }),

    usuariosClienteIds.length
      ? clientes.query(
          `SELECT id, nome
             FROM wb_usuarios
            WHERE id = ANY($1::bigint[])`,
          [usuariosClienteIds]
        )
      : Promise.resolve({ rows: [] })
  ]);

  // Mapas para relacionar os dados.
  const mapaAtendimentos = new Map(
    atendimentos.rows.map(item => [
      String(item.id),
      item.protocolo
    ])
  );

  const mapaUsuariosSistema = new Map(
    usuariosSistema.rows.map(usuario => [
      String(usuario.id),
      usuario.nome
    ])
  );

  const mapaUsuariosClientes = new Map(
    usuariosClientes.rows.map(usuario => [
      String(usuario.id),
      usuario.nome
    ])
  );

  // Retorna os logs com chamado e protocolo.
  return registros.map(registro => ({
    ...registro,

    protocolo:
      mapaAtendimentos.get(String(registro.atendimento_id)) || null,

    usuario_sistema_nome:
      mapaUsuariosSistema.get(
        String(registro.usuario_sistema_id)
      ) || null,

    cliente_nome:
      mapaUsuariosClientes.get(
        String(registro.contexto?.usuario_cliente_id)
      ) || null
  }));
}


async function listarHistoricoAtendimentos(filtros = {}) {
  const condicoes = ["(a.status = 'realizado' OR a.arquivado = TRUE)"];
  const parametros = [];
  adicionarLike(condicoes, parametros, "a.id::text", filtros.id);
  adicionarLike(condicoes, parametros, "COALESCE(a.protocolo, '')", filtros.protocolo);
  adicionarLike(condicoes, parametros, "COALESCE(an.nome, '')", filtros.analista);
  adicionarLike(condicoes, parametros, "COALESCE(s.nome, '')", filtros.setor);
  if (filtros.data) {
    parametros.push(String(filtros.data));
    condicoes.push(`to_char(a.finalizado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') = $${parametros.length}`);
  }

  const resultado = await atendimento.query(
    `SELECT a.id, a.usuario_id, a.empresa_id, a.protocolo, a.status,
            a.descricao, a.criado_em, a.iniciado_em, a.finalizado_em,
            a.arquivado, s.nome AS setor_nome, an.nome AS analista_nome
       FROM wb_atendimentos a
       JOIN wb_setores s ON s.id = a.setor_id
       LEFT JOIN wb_usuarios_sistema an ON an.id = a.analista_id
      WHERE ${condicoes.join(" AND ")}
      ORDER BY COALESCE(a.finalizado_em, a.atualizado_em, a.criado_em) DESC, a.id DESC`,
    parametros
  );

  let registros = await anexarDadosClientes(resultado.rows);
  const clienteFiltro = String(filtros.cliente || "").trim().toLocaleLowerCase("pt-BR");
  if (clienteFiltro) {
    registros = registros.filter(r =>
      String(r.cliente_nome || "").toLocaleLowerCase("pt-BR").includes(clienteFiltro)
    );
  }
  return registros;
}

async function listarUsuarios(filtros = {}) {
  const condicoes = ["u.perfil = 'analista'"];
  const parametros = [];
  const termo = String(filtros.busca || "").trim();
  if (termo) {
    parametros.push(`%${termo}%`);
    condicoes.push(`(u.nome ILIKE $${parametros.length} OR u.username ILIKE $${parametros.length} OR u.email ILIKE $${parametros.length} OR COALESCE(s.nome, '') ILIKE $${parametros.length})`);
  }
  if (filtros.situacao === "ativo") condicoes.push("u.ativo = TRUE");
  if (filtros.situacao === "inativo") condicoes.push("u.ativo = FALSE");
  if (filtros.setor && filtros.setor !== "todos") {
    parametros.push(filtros.setor);
    condicoes.push(`u.setor_id::text = $${parametros.length}`);
  }

  const resultado = await atendimento.query(
    `SELECT u.id, u.nome, u.email, u.username, u.perfil,
            s.nome AS setor_nome, u.ativo, u.criado_em, u.ultimo_acesso_em
       FROM wb_usuarios_sistema u
       LEFT JOIN wb_setores s ON s.id = u.setor_id
      WHERE ${condicoes.join(" AND ")}
      ORDER BY u.nome ASC`,
    parametros
  );
  return resultado.rows;
}

module.exports = { listarLogs, listarHistoricoAtendimentos, listarUsuarios };
