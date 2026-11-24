const { atendimento } = require("../config/database");

async function listarPermissoesDoPapel(nomePapel) {
  const resultado = await atendimento.query(
    `SELECT
       r.id AS role_id,
       r.nome AS role_nome,
       p.id AS permissao_id,
       p.codigo,
       p.modulo,
       p.acao,
       p.descricao,
       COALESCE(rp.permitido, FALSE) AS permitido
     FROM wb_roles r
     CROSS JOIN wb_permissoes p
     LEFT JOIN wb_role_permissoes rp
       ON rp.role_id = r.id
      AND rp.permissao_id = p.id
     WHERE LOWER(BTRIM(r.nome)) = LOWER(BTRIM($1))
       AND r.ativo = TRUE
     ORDER BY p.modulo, p.id`,
    [nomePapel]
  );

  if (resultado.rows.length === 0) {
    const erro = new Error(`Papel ativo não encontrado: ${nomePapel}.`);
    erro.status = 404;
    throw erro;
  }

  const primeira = resultado.rows[0];
  return {
    id: primeira.role_id,
    nome: primeira.role_nome,
    permissoes: resultado.rows.map((item) => ({
      id: item.permissao_id,
      codigo: item.codigo,
      modulo: item.modulo,
      acao: item.acao,
      descricao: item.descricao,
      permitido: item.permitido
    }))
  };
}

async function salvarPermissoesDoPapel(nomePapel, permissoes) {
  const conexao = await atendimento.connect();

  try {
    await conexao.query("BEGIN");

    const papel = await conexao.query(
      `SELECT id, nome
         FROM wb_roles
        WHERE LOWER(BTRIM(nome)) = LOWER(BTRIM($1))
          AND ativo = TRUE
        FOR UPDATE`,
      [nomePapel]
    );

    if (papel.rows.length === 0) {
      const erro = new Error(`Papel ativo não encontrado: ${nomePapel}.`);
      erro.status = 404;
      throw erro;
    }

    const roleId = papel.rows[0].id;

    const catalogo = await conexao.query(
      "SELECT id, codigo FROM wb_permissoes ORDER BY id"
    );

    const codigosConhecidos = new Set(
      catalogo.rows.map((item) => item.codigo)
    );
    const codigosRecebidos = new Set(permissoes.map((item) => item.codigo));

    const desconhecidos = [...codigosRecebidos].filter(
      (codigo) => !codigosConhecidos.has(codigo)
    );

    if (desconhecidos.length > 0) {
      const erro = new Error(
        `Permissões não cadastradas: ${desconhecidos.join(", ")}.`
      );
      erro.status = 400;
      throw erro;
    }

    const porCodigo = new Map(
      permissoes.map((item) => [item.codigo, item.permitido])
    );

    for (const permissao of catalogo.rows) {
      // A ausência de um código no envio significa desabilitado.
      const permitido = porCodigo.get(permissao.codigo) === true;

      await conexao.query(
        `INSERT INTO wb_role_permissoes
           (role_id, permissao_id, permitido)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permissao_id)
         DO UPDATE SET permitido = EXCLUDED.permitido`,
        [roleId, permissao.id, permitido]
      );
    }

    await conexao.query("COMMIT");
    return listarPermissoesDoPapel(nomePapel);
  } catch (erro) {
    await conexao.query("ROLLBACK");
    throw erro;
  } finally {
    conexao.release();
  }
}


async function buscarAnalistaPorId(usuarioId, executor = atendimento) {
  const resultado = await executor.query(
    `SELECT id, nome, username, email, ativo, perfil
       FROM wb_usuarios_sistema
      WHERE id = $1
        AND perfil = 'analista'
      LIMIT 1`,
    [usuarioId]
  );

  if (resultado.rows.length === 0) {
    const erro = new Error("Analista não encontrado.");
    erro.status = 404;
    throw erro;
  }

  return resultado.rows[0];
}

async function listarPermissoesDoUsuario(usuarioId) {
  const analista = await buscarAnalistaPorId(usuarioId);
  const resultado = await atendimento.query(
    `SELECT
       p.id AS permissao_id,
       p.codigo,
       p.modulo,
       p.acao,
       p.descricao,
       up.permitido AS override_permitido,
       COALESCE(
         up.permitido,
         BOOL_OR(rp.permitido) FILTER (WHERE ur.usuario_id IS NOT NULL),
         FALSE
       ) AS permitido,
       CASE
         WHEN up.usuario_id IS NOT NULL THEN 'individual'
         WHEN COUNT(rp.permissao_id) FILTER (WHERE ur.usuario_id IS NOT NULL) > 0 THEN 'perfil'
         ELSE 'herdada'
       END AS origem
     FROM wb_permissoes p
     LEFT JOIN wb_usuario_roles ur
       ON ur.usuario_id = $1
     LEFT JOIN wb_role_permissoes rp
       ON rp.role_id = ur.role_id
      AND rp.permissao_id = p.id
     LEFT JOIN wb_usuario_permissoes up
       ON up.usuario_id = $1
      AND up.permissao_id = p.id
     GROUP BY p.id, p.codigo, p.modulo, p.acao, p.descricao,
              up.usuario_id, up.permitido
     ORDER BY p.modulo, p.id`,
    [usuarioId]
  );

  return {
    usuario: analista,
    permissoes: resultado.rows.map((item) => ({
      id: item.permissao_id,
      codigo: item.codigo,
      modulo: item.modulo,
      acao: item.acao,
      descricao: item.descricao,
      permitido: item.permitido === true,
      override: item.override_permitido === null ? null : item.override_permitido === true,
      origem: item.origem
    }))
  };
}

async function salvarPermissoesDoUsuario(usuarioId, permissoes) {
  const conexao = await atendimento.connect();
  try {
    await conexao.query("BEGIN");
    await buscarAnalistaPorId(usuarioId, conexao);

    const catalogo = await conexao.query(
      "SELECT id, codigo FROM wb_permissoes ORDER BY id"
    );
    const idsPorCodigo = new Map(catalogo.rows.map((item) => [item.codigo, item.id]));
    const codigosRecebidos = new Set(permissoes.map((item) => item.codigo));
    const desconhecidos = [...codigosRecebidos].filter((codigo) => !idsPorCodigo.has(codigo));
    if (desconhecidos.length) {
      const erro = new Error(`Permissões não cadastradas: ${desconhecidos.join(", ")}.`);
      erro.status = 400;
      throw erro;
    }

    // A lista representa o conjunto completo de exceções individuais.
    // null ou código omitido significa herdar a configuração do papel Analista.
    await conexao.query(
      "DELETE FROM wb_usuario_permissoes WHERE usuario_id = $1",
      [usuarioId]
    );

    for (const item of permissoes) {
      if (item.permitido === null) continue;
      await conexao.query(
        `INSERT INTO wb_usuario_permissoes
           (usuario_id, permissao_id, permitido)
         VALUES ($1, $2, $3)`,
        [usuarioId, idsPorCodigo.get(item.codigo), item.permitido]
      );
    }

    await conexao.query("COMMIT");
    return listarPermissoesDoUsuario(usuarioId);
  } catch (erro) {
    await conexao.query("ROLLBACK");
    throw erro;
  } finally {
    conexao.release();
  }
}

module.exports = {
  listarPermissoesDoPapel,
  salvarPermissoesDoPapel,
  buscarAnalistaPorId,
  listarPermissoesDoUsuario,
  salvarPermissoesDoUsuario
};
