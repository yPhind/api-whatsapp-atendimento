
const empresaRepository = require("../repositories/empresaRepository");
const logService = require("./logService");

function normalizarCnpj(cnpj) {
  return String(cnpj || "").replace(/\D/g, "");
}

async function identificarPorCnpj(cnpj) {
  const cnpjNormalizado = normalizarCnpj(cnpj);

  if (cnpjNormalizado.length !== 14) {
    throw new Error("CNPJ_INVALIDO");
  }

  const empresa = await empresaRepository.buscarPorCnpj(cnpjNormalizado);

  if (!empresa) {
    throw new Error("EMPRESA_NAO_ENCONTRADA");
  }

  await logService.info({
    origem: "empresaService",
    evento: "empresa_identificada",
    mensagem: "Empresa identificada pelo CNPJ.",
    contexto: {
      empresa_id: empresa.id,
      origem_acao: "whatsapp"
    }
  });

  return empresa;
}

async function localizarOuCadastrar({
  cnpj,
  razaoSocial,
  nomeFantasia,
  usuarioSistemaId = null
}) {
  const normalizado = normalizarCnpj(cnpj);

  if (normalizado.length !== 14) {
    throw new Error("CNPJ_INVALIDO");
  }

  let empresa = await empresaRepository.buscarPorCnpj(normalizado);

  if (empresa) {
    return { empresa, nova: false };
  }

  if (!String(razaoSocial || "").trim()) {
    throw new Error("DADOS_EMPRESA_OBRIGATORIOS");
  }

  empresa = await empresaRepository.criar({
    cnpj: normalizado,
    razaoSocial: String(razaoSocial).trim(),
    nomeFantasia: String(nomeFantasia || "").trim()
  });

  await logService.info({
    origem: "empresaService",
    evento: "empresa_cadastrada",
    mensagem: "Nova empresa cadastrada no sistema.",
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      empresa_id: empresa.id,
      origem_acao: usuarioSistemaId ? "painel" : "sistema"
    }
  });

  return { empresa, nova: true };
}

module.exports = {
  localizarOuCadastrar,
  normalizarCnpj,
  identificarPorCnpj
};
