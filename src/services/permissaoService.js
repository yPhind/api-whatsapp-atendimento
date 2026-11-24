const permissaoRepository = require("../repositories/permissaoRepository");
const { atendimento } = require("../config/database");

async function listarPermissoesUsuario(usuarioId, perfil) {
  if (String(perfil).toLowerCase() === "supervisor") {
    const resultado = await atendimento.query(
      `SELECT codigo
         FROM wb_permissoes
        ORDER BY codigo`
    );
    return resultado.rows.map((item) => item.codigo);
  }

  const resultado = await atendimento.query(
    `SELECT
       p.codigo,
       COALESCE(
         up.permitido,
         BOOL_OR(rp.permitido) FILTER (WHERE ur.usuario_id IS NOT NULL),
         FALSE
       ) AS permitido
     FROM wb_permissoes p
     LEFT JOIN wb_usuario_roles ur
       ON ur.usuario_id = $1
     LEFT JOIN wb_role_permissoes rp
       ON rp.role_id = ur.role_id
      AND rp.permissao_id = p.id
     LEFT JOIN wb_usuario_permissoes up
       ON up.usuario_id = $1
      AND up.permissao_id = p.id
     GROUP BY p.id, p.codigo, up.permitido
     ORDER BY p.codigo`,
    [usuarioId]
  );

  return resultado.rows
    .filter((item) => item.permitido === true)
    .map((item) => item.codigo);
}

async function usuarioTemPermissao(usuarioId, perfil, codigo) {
  if (String(perfil).toLowerCase() === "supervisor") return true;
  const permissoes = await listarPermissoesUsuario(usuarioId, perfil);
  return permissoes.includes(codigo);
}

async function listarConfiguracaoAnalista() {
  return permissaoRepository.listarPermissoesDoPapel("Analista");
}

async function atualizarConfiguracaoAnalista(permissoes) {
  return permissaoRepository.salvarPermissoesDoPapel("Analista", permissoes);
}

async function listarConfiguracaoUsuario(usuarioId) {
  return permissaoRepository.listarPermissoesDoUsuario(usuarioId);
}

async function atualizarConfiguracaoUsuario(usuarioId, permissoes) {
  return permissaoRepository.salvarPermissoesDoUsuario(usuarioId, permissoes);
}

module.exports = {
  listarPermissoesUsuario,
  usuarioTemPermissao,
  listarConfiguracaoAnalista,
  atualizarConfiguracaoAnalista,
  listarConfiguracaoUsuario,
  atualizarConfiguracaoUsuario
};
