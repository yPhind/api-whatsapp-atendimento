
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const usuarioRepository = require("../repositories/usuarioSistemaRepository");
const setorRepository = require("../repositories/setorRepository");
const logService = require("./logService");

async function listarSetores() {
  return setorRepository.listarAtivos();
}

async function criarAnalista(dados, usuarioSistemaId) {
  const setor = await setorRepository.buscarPorId(dados.setorId);

  if (!setor) {
    throw new Error("SETOR_INVALIDO");
  }

  const senhaHash = await bcrypt.hash(dados.senha, 3);

  const analista = await usuarioRepository.criar({
    nome: dados.nome,
    email: dados.email.toLowerCase(),
    username: dados.username.toLowerCase(),
    senhaHash,
    perfil: "analista",
    setorId: dados.setorId
  });

  await logService.info({
    origem: "analistaService",
    evento: "analista_criado",
    mensagem: "Novo analista cadastrado no sistema.",
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_id: analista.id,
      setor_id: setor.id,
      perfil: "analista"
    }
  });

  return analista;
}

async function listarAnalistas() {
  return usuarioRepository.listarAnalistas();
}

async function atualizarSetor(id, setorId, usuarioSistemaId) {
  const analista = await usuarioRepository.buscarPorId(id);

  if (!analista || analista.perfil !== "analista") {
    throw new Error("ANALISTA_NAO_ENCONTRADO");
  }

  const setor = await setorRepository.buscarPorId(setorId);

  if (!setor) {
    throw new Error("SETOR_INVALIDO");
  }

  const setorAnteriorId = analista.setor_id;

  const atualizado = await usuarioRepository.atualizarSetorAnalista(
    id,
    setorId
  );

  await logService.info({
    origem: "analistaService",
    evento: "analista_setor_alterado",
    mensagem: "Setor do analista alterado.",
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_id: id,
      setor_anterior_id: setorAnteriorId,
      setor_novo_id: setorId
    }
  });

  return atualizado;
}

async function atualizarSituacao(id, ativo, usuarioSistemaId) {
  const analista = await usuarioRepository.buscarPorId(id);

  if (!analista || analista.perfil !== "analista") {
    throw new Error("ANALISTA_NAO_ENCONTRADO");
  }

  const situacaoAnterior = Boolean(analista.ativo);

  const atualizado = await usuarioRepository.atualizarSituacaoAnalista(
    id,
    ativo
  );

  await logService.info({
    origem: "analistaService",
    evento: "analista_situacao_alterada",
    mensagem: ativo
      ? "Conta de analista ativada."
      : "Conta de analista desativada.",
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_id: id,
      situacao_anterior: situacaoAnterior ? "ativo" : "inativo",
      situacao_nova: ativo ? "ativo" : "inativo"
    }
  });

  return atualizado;
}

async function redefinirSenhaPeloSupervisor(
  usuarioId,
  usuarioSistemaId
) {
  const usuario = await usuarioRepository.buscarPorId(usuarioId);

  if (!usuario) {
    throw new Error("USUARIO_NAO_ENCONTRADO");
  }

  if (!usuario.ativo) {
    throw new Error("USUARIO_INATIVO");
  }

  const senhaTemporaria = crypto
    .randomBytes(8)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);

  const senhaHash = await bcrypt.hash(senhaTemporaria, 4);

  const usuarioAtualizado =
    await usuarioRepository.marcarRedefinicaoSenha(
      usuarioId,
      senhaHash
    );

  if (!usuarioAtualizado) {
    throw new Error("ERRO_AO_REDEFINIR_SENHA");
  }

  await logService.info({
    origem: "analistaService",
    evento: "analista_senha_redefinida",
    mensagem: "Senha de acesso redefinida pelo supervisor.",
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      usuario_alvo_id: usuarioId,
      redefinicao_temporaria: true
    }
  });

  return {
    usuario: usuarioAtualizado,
    senhaTemporaria
  };
}

module.exports = {
  listarSetores,
  criarAnalista,
  listarAnalistas,
  atualizarSetor,
  atualizarSituacao,
  redefinirSenhaPeloSupervisor
};
