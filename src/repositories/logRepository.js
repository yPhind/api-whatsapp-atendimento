
const { logs } = require("../config/database");

async function registrar(dados) {
    const sql = `
        INSERT INTO public.wb_logs (
            nivel,
            origem,
            evento,
            mensagem,
            usuario_sistema_id,
            atendimento_id,
            correlacao_id,
            contexto
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id, criado_em
    `;

    const valores = [
        dados.nivel,
        dados.origem,
        dados.evento,
        dados.mensagem,
        dados.usuario_sistema_id,
        dados.atendimento_id,
        dados.correlacao_id,
        JSON.stringify(dados.contexto || {})
    ];

    const resultado = await logs.query(sql, valores);

    return resultado.rows[0];
}

module.exports = {
    registrar
};
