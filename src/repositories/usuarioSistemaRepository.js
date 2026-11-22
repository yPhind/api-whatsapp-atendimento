const { atendimento } = require("../config/database");

async function buscarPorLogin(login) {
  const resultado = await atendimento.query(
    `SELECT id, nome, email, username, senha_hash, perfil, setor_id,
            ativo, deve_redefinir_senha
       FROM wb_usuarios_sistema
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
      LIMIT 1`,
    [login]
  );
  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await atendimento.query(
    `SELECT id, nome, email, username, senha_hash, perfil, setor_id,
            ativo, deve_redefinir_senha
       FROM wb_usuarios_sistema WHERE id = $1 LIMIT 1`,
    [id]
  );
  return resultado.rows[0] || null;
}

async function atualizarUltimoAcesso(id) {
  await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET ultimo_acesso_em = CURRENT_TIMESTAMP,
            atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id]
  );
}

async function criar({ nome, email, username, senhaHash, perfil, setorId = null }) {
  const resultado = await atendimento.query(
    `INSERT INTO wb_usuarios_sistema
       (nome, email, username, senha_hash, perfil, setor_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nome, email, username, perfil, setor_id, ativo, criado_em`,
    [nome, email, username, senhaHash, perfil, setorId]
  );
  return resultado.rows[0];
}

async function atualizarSenha(id, senhaHash) {
  await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET senha_hash = $2, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id, senhaHash]
  );
}

async function listarAnalistas() {
  const resultado = await atendimento.query(
    `SELECT u.id, u.nome, u.email, u.username, u.setor_id,
            s.nome AS setor_nome, u.ativo, u.criado_em
       FROM wb_usuarios_sistema u
       LEFT JOIN wb_setores s ON s.id = u.setor_id
      WHERE u.perfil = 'analista'
      ORDER BY u.nome ASC`
  );
  return resultado.rows;
}

async function atualizarSetorAnalista(id, setorId) {
  const resultado = await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET setor_id = $2, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND perfil = 'analista'
      RETURNING id, nome, email, username, perfil, setor_id, ativo, criado_em`,
    [id, setorId]
  );
  return resultado.rows[0] || null;
}

async function atualizarSituacaoAnalista(id, ativo) {
  const resultado = await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET ativo = $2, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND perfil = 'analista'
      RETURNING id, nome, email, username, perfil, setor_id, ativo, criado_em`,
    [id, ativo]
  );
  return resultado.rows[0] || null;
}

async function marcarRedefinicaoSenha(id, senhaHash) {
  const resultado = await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET senha_hash = $2, deve_redefinir_senha = TRUE
      WHERE id = $1
      RETURNING id, nome, email, username, perfil, setor_id, ativo,
                deve_redefinir_senha`,
    [id, senhaHash]
  );
  return resultado.rows[0] || null;
}

async function concluirRedefinicaoSenha(id, senhaHash) {
  const resultado = await atendimento.query(
    `UPDATE wb_usuarios_sistema
        SET senha_hash = $2, deve_redefinir_senha = FALSE
      WHERE id = $1
      RETURNING id, nome, email, username, perfil, setor_id, ativo,
                deve_redefinir_senha`,
    [id, senhaHash]
  );
  return resultado.rows[0] || null;
}

module.exports = {
  buscarPorLogin, buscarPorId, atualizarUltimoAcesso, criar, atualizarSenha,
  listarAnalistas, atualizarSetorAnalista, atualizarSituacaoAnalista,
  marcarRedefinicaoSenha, concluirRedefinicaoSenha
};
