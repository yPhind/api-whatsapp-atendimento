const { clientes } = require("../config/database");

async function buscarPorTelefone(telefone) {
  const resultado = await clientes.query(
    `SELECT id, nome, telefone, whatsapp_id, empresa_id, ativo
       FROM wb_usuarios
      WHERE telefone = $1
      LIMIT 1`,
    [telefone]
  );
  return resultado.rows[0] || null;
}

async function criar({ nome, telefone, whatsappId, empresaId }) {
  const resultado = await clientes.query(
    `INSERT INTO wb_usuarios (nome, telefone, whatsapp_id, empresa_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telefone)
     DO UPDATE SET
       nome = COALESCE(EXCLUDED.nome, wb_usuarios.nome),
       whatsapp_id = COALESCE(EXCLUDED.whatsapp_id, wb_usuarios.whatsapp_id),
       empresa_id = COALESCE(EXCLUDED.empresa_id, wb_usuarios.empresa_id),
       atualizado_em = CURRENT_TIMESTAMP
     RETURNING id, nome, telefone, whatsapp_id, empresa_id, ativo`,
    [nome || null, telefone, whatsappId || null, empresaId || null]
  );
  return resultado.rows[0];
}

async function atualizarNome({ usuarioId, nome }) {
  const resultado = await clientes.query(
    `UPDATE wb_usuarios
        SET nome = $2, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nome, telefone, whatsapp_id, empresa_id`,
    [usuarioId, nome]
  );
  return resultado.rows[0] || null;
}

module.exports = { buscarPorTelefone, criar, atualizarNome };
