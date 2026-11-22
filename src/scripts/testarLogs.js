require("dotenv").config();

const logService = require("../services/logService");
const { logs } = require("../config/database");

async function testar() {
    try {
        const resultado = await logService.info({
            origem: "teste",
            evento: "teste_gravacao_log",
            mensagem: "Teste de gravação no banco logwbatendimento.",
            contexto: {
                teste: true,
                aplicacao: "api-atendimento-whatsapp"
            }
        });

        if (!resultado) {
            throw new Error("O serviço não conseguiu gravar o log.");
        }

        console.log("Log gravado com sucesso:", resultado);

        const consulta = await logs.query(`
            SELECT *
            FROM public.wb_logs
            WHERE id = $1
        `, [resultado.id]);

        console.log("Registro localizado no banco:", consulta.rows[0]);

    } catch (erro) {
        console.error("Erro no teste:", erro.message);
        process.exitCode = 1;
    } finally {
        await logs.end();
    }
}

testar();