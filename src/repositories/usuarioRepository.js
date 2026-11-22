
const { clientes } = require("../config/database");

function normalizarTelefone(telefone) {
  return String(telefone || "").trim();
}

function normalizarOpcional(valor) {
  const texto = String(valor || "").trim();
  return texto || null;
}

async function buscarPorTelefone(telefone) {
  const telefoneNormalizado = normalizarTelefone(telefone);

  if (!telefoneNormalizado) {
    throw new Error("TELEFONE_OBRIGATORIO");
  }

  const resultado = await clientes.query(
    `
      SELECT
        id,
        nome,
        telefone,
        whatsapp_id,
        empresa_id,
        ativo
      FROM wb_usuarios
      WHERE telefone = $1
      LIMIT 1
    `,
    [telefoneNormalizado]
  );

  return resultado.rows[0] || null;
}

async function criar({
  nome,
  telefone,
  whatsappId,
  empresaId
}) {
  const telefoneNormalizado = normalizarTelefone(telefone);

  if (!telefoneNormalizado) {
    throw new Error("TELEFONE_OBRIGATORIO");
  }

  if (telefoneNormalizado.length > 30) {
    throw new Error("TELEFONE_INVALIDO");
  }

  const nomeNormalizado = normalizarOpcional(nome);
  const whatsappIdNormalizado = normalizarOpcional(whatsappId);
  const empresaIdNormalizado = empresaId || null;

  const resultado = await clientes.query(
    `
      INSERT INTO wb_usuarios (
        nome,
        telefone,
        whatsapp_id,
        empresa_id
      )
      VALUES ($1, $2, $3, $4)

      ON CONFLICT (telefone)
      DO UPDATE SET
        nome = COALESCE(
          EXCLUDED.nome,
          wb_usuarios.nome
        ),

        whatsapp_id = COALESCE(
          EXCLUDED.whatsapp_id,
          wb_usuarios.whatsapp_id
        ),

        empresa_id = COALESCE(
          EXCLUDED.empresa_id,
          wb_usuarios.empresa_id
        ),

        atualizado_em = CURRENT_TIMESTAMP

      RETURNING
        id,
        nome,
        telefone,
        whatsapp_id,
        empresa_id,
        ativo
    `,
    [
      nomeNormalizado,
      telefoneNormalizado,
      whatsappIdNormalizado,
      empresaIdNormalizado
    ]
  );

  return resultado.rows[0];
}

async function atualizarNome({ usuarioId, nome }) {
  if (!usuarioId) {
    throw new Error("USUARIO_ID_OBRIGATORIO");
  }

  const nomeNormalizado = normalizarOpcional(nome);

  if (!nomeNormalizado) {
    throw new Error("NOME_OBRIGATORIO");
  }

  if (nomeNormalizado.length > 150) {
    throw new Error("NOME_INVALIDO");
  }

  const resultado = await clientes.query(
    `
      UPDATE wb_usuarios
      SET
        nome = $2,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1

      RETURNING
        id,
        nome,
        telefone,
        whatsapp_id,
        empresa_id,
        ativo
    `,
    [usuarioId, nomeNormalizado]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  buscarPorTelefone,
  criar,
  atualizarNome
};
