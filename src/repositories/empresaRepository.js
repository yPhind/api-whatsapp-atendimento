const { clientes } = require("../config/database");

async function buscarPorCnpj(cnpj) {
  const resultado = await clientes.query(
    `SELECT id, cnpj, razao_social, nome_fantasia, status
       FROM wb_empresas
      WHERE cnpj = $1
      LIMIT 1`,
    [cnpj]
  );

  return resultado.rows[0] || null;
}

async function buscarPorId(id) {
  const resultado = await clientes.query(
    `SELECT id, cnpj, razao_social, nome_fantasia, status
       FROM wb_empresas
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  return resultado.rows[0] || null;
}

async function listarAtivas() {
  const resultado = await clientes.query(
    `SELECT id, cnpj, razao_social, nome_fantasia, status
       FROM wb_empresas
      WHERE status = 'Ativa'
      ORDER BY COALESCE(NULLIF(nome_fantasia, ''), razao_social) ASC`
  );

  return resultado.rows;
}

async function buscarPorIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const resultado = await clientes.query(
    `SELECT id, cnpj, razao_social, nome_fantasia, status
       FROM wb_empresas
      WHERE id = ANY($1::bigint[])`,
    [ids]
  );

  return resultado.rows;
}

async function criar({ cnpj, razaoSocial, nomeFantasia }) {
  const resultado = await clientes.query(
    `INSERT INTO wb_empresas (
       cnpj,
       razao_social,
       nome_fantasia,
       status
     )
     VALUES ($1, $2, $3, 'Ativa')
     ON CONFLICT (cnpj)
     DO UPDATE SET cnpj = EXCLUDED.cnpj
     RETURNING id, cnpj, razao_social, nome_fantasia, status`,
    [cnpj, razaoSocial, nomeFantasia || null]
  );

  return resultado.rows[0];
}

module.exports = {
  buscarPorCnpj,
  buscarPorId,
  listarAtivas,
  buscarPorIds,
  criar
};