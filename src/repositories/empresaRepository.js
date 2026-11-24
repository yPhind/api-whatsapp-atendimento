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
    `SELECT
       e.id,
       e.cnpj,
       e.razao_social,
       e.nome_fantasia,
       e.chave,
       CASE WHEN COALESCE(e.chave, 0) > 0 THEN 'Ativo' ELSE 'Inativo' END AS status,
       e.max_licencas,
       e.quantidade_notas,
       e.ultima_sincronizacao,
       COALESCE(
         json_agg(
           json_build_object(
             'id', m.id,
             'codigo', m.codigo,
             'nome', m.nome
           ) ORDER BY m.nome
         ) FILTER (WHERE m.id IS NOT NULL),
         '[]'::json
       ) AS modulos
     FROM wb_empresas e
     LEFT JOIN wb_empresa_modulos em ON em.empresa_id = e.id AND em.ativo = TRUE
     LEFT JOIN wb_modulos m ON m.id = em.modulo_id AND m.ativo = TRUE
     GROUP BY e.id
     ORDER BY COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social) ASC`
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