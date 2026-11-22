
const logRepository = require("../repositories/logRepository");

const NIVEIS_VALIDOS = [
  "debug",
  "info",
  "warn",
  "error",
  "fatal"
];

function limitarTexto(valor, tamanho) {
  return String(valor || "").trim().slice(0, tamanho);
}

async function registrar(dados = {}) {
  try {
    const nivelInformado = String(
      dados.nivel || "info"
    ).toLowerCase();

    if (!NIVEIS_VALIDOS.includes(nivelInformado)) {
      throw new Error(`Nível de log inválido: ${nivelInformado}`);
    }

    const registro = {
      nivel: nivelInformado,

      origem: limitarTexto(
        dados.origem || "aplicacao",
        100
      ),

      evento: limitarTexto(
        dados.evento || "evento_nao_identificado",
        150
      ),

      mensagem: limitarTexto(
        dados.mensagem || "Evento registrado pela aplicação.",
        5000
      ),

      usuario_sistema_id: dados.usuario_sistema_id || null,
      atendimento_id: dados.atendimento_id || null,

      correlacao_id: dados.correlacao_id
        ? limitarTexto(dados.correlacao_id, 100)
        : null,

      contexto:
        dados.contexto &&
        typeof dados.contexto === "object" &&
        !Array.isArray(dados.contexto)
          ? dados.contexto
          : {}
    };

    return await logRepository.registrar(registro);

  } catch (erro) {
    console.error(
      "[LOG SERVICE] Falha ao gravar log:",
      erro.message
    );

    return null;
  }
}

async function debug(dados) {
  return registrar({ ...dados, nivel: "debug" });
}

async function info(dados) {
  return registrar({ ...dados, nivel: "info" });
}

async function warn(dados) {
  return registrar({ ...dados, nivel: "warn" });
}

async function error(dados) {
  return registrar({ ...dados, nivel: "error" });
}

async function fatal(dados) {
  return registrar({ ...dados, nivel: "fatal" });
}

module.exports = {
  registrar,
  debug,
  info,
  warn,
  error,
  fatal
};
