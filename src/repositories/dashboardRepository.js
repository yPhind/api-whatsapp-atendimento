const { atendimento } = require("../config/database");

const STATUS = ["aguardando", "pendente", "em_atendimento", "realizado"];

async function obterIndicadores(setorId = null) {
  const resumo = await atendimento.query(
    `SELECT s.id AS setor_id, s.nome AS setor_nome,
       (COUNT(a.id) FILTER (WHERE a.status = 'aguardando'))::integer AS aguardando,
       (COUNT(a.id) FILTER (WHERE a.status = 'pendente'))::integer AS pendente,
       (COUNT(a.id) FILTER (WHERE a.status = 'em_atendimento'))::integer AS em_atendimento,
       (COUNT(a.id) FILTER (WHERE a.status = 'realizado' AND a.finalizado_em >= CURRENT_DATE AND a.finalizado_em < CURRENT_DATE + INTERVAL '1 day'))::integer AS realizado
     FROM wb_setores s
     LEFT JOIN wb_atendimentos a
       ON a.setor_id = s.id AND a.arquivado = FALSE AND a.status = ANY($2::text[])
     WHERE ($1::integer IS NULL OR s.id = $1)
     GROUP BY s.id, s.nome ORDER BY s.nome`,
    [setorId, STATUS]
  );

  const mensal = await atendimento.query(
    `WITH meses AS (
       SELECT generate_series(
         date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
         date_trunc('month', CURRENT_DATE), INTERVAL '1 month'
       ) AS mes
     ), setores AS (
       SELECT id, nome FROM wb_setores
        WHERE ($1::integer IS NULL OR id = $1)
     ), status AS (
       SELECT unnest($2::text[]) AS status
     )
     SELECT to_char(m.mes, 'YYYY-MM') AS mes,
            s.id AS setor_id, s.nome AS setor_nome, st.status,
            COUNT(a.id)::integer AS total
       FROM meses m CROSS JOIN setores s CROSS JOIN status st
       LEFT JOIN wb_atendimentos a
         ON a.setor_id = s.id AND a.arquivado = FALSE AND a.status = st.status
        AND (
          (st.status = 'realizado' AND a.finalizado_em >= m.mes
            AND a.finalizado_em < m.mes + INTERVAL '1 month')
          OR
          (st.status <> 'realizado' AND a.criado_em >= m.mes
            AND a.criado_em < m.mes + INTERVAL '1 month')
        )
      GROUP BY m.mes, s.id, s.nome, st.status
      ORDER BY s.nome, m.mes, st.status`,
    [setorId, STATUS]
  );

  return { setores: resumo.rows, mensal: mensal.rows };
}

module.exports = { obterIndicadores };
