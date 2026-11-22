const { atendimento } = require("../config/database");

async function criar({ usuarioId, tokenHash, expiraEm }) {
  const conexao = await atendimento.connect();

  try {
    await conexao.query("BEGIN");

    await conexao.query(
      `UPDATE wb_recuperacao_senha
          SET utilizado_em = CURRENT_TIMESTAMP
        WHERE usuario_sistema_id = $1
          AND utilizado_em IS NULL`,
      [usuarioId]
    );

    await conexao.query(
      `INSERT INTO wb_recuperacao_senha
         (usuario_sistema_id, token_hash, expira_em)
       VALUES ($1, $2, $3)`,
      [usuarioId, tokenHash, expiraEm]
    );

    await conexao.query("COMMIT");
  } catch (erro) {
    await conexao.query("ROLLBACK");
    throw erro;
  } finally {
    conexao.release();
  }
}

async function redefinirSenha({ tokenHash, senhaHash }) {
  const conexao = await atendimento.connect();

  try {
    await conexao.query("BEGIN");

    const resultado = await conexao.query(
      `SELECT id, usuario_sistema_id
         FROM wb_recuperacao_senha
        WHERE token_hash = $1
          AND utilizado_em IS NULL
          AND expira_em > CURRENT_TIMESTAMP
        FOR UPDATE`,
      [tokenHash]
    );

    const token = resultado.rows[0];

    if (!token) {
      await conexao.query("ROLLBACK");
      return false;
    }

    await conexao.query(
      `UPDATE wb_usuarios_sistema
          SET senha_hash = $1,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [senhaHash, token.usuario_sistema_id]
    );

    await conexao.query(
      `UPDATE wb_recuperacao_senha
          SET utilizado_em = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [token.id]
    );

    await conexao.query("COMMIT");
    return true;
  } catch (erro) {
    await conexao.query("ROLLBACK");
    throw erro;
  } finally {
    conexao.release();
  }
}

module.exports = { criar, redefinirSenha };
