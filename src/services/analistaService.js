const bcrypt = require("bcrypt");
const crypto = require("crypto");

const usuarioRepository = require("../repositories/usuarioSistemaRepository");
const setorRepository = require("../repositories/setorRepository");

async function listarSetores() {
  return setorRepository.listarAtivos();
}

async function criarAnalista(dados) {
  const setor = await setorRepository.buscarPorId(dados.setorId);

  if (!setor) {
    throw new Error("SETOR_INVALIDO");
  }

  const senhaHash = await bcrypt.hash(dados.senha, 4);

  return usuarioRepository.criar({
    nome: dados.nome,
    email: dados.email.toLowerCase(),
    username: dados.username.toLowerCase(),
    senhaHash,
    perfil: "analista",
    setorId: dados.setorId
  });
}

async function listarAnalistas() {
  return usuarioRepository.listarAnalistas();
}

async function atualizarSetor(id, setorId) {
  const analista = await usuarioRepository.buscarPorId(id);

  if (!analista || analista.perfil !== "analista") {
    throw new Error("ANALISTA_NAO_ENCONTRADO");
  }

  const setor = await setorRepository.buscarPorId(setorId);

  if (!setor) {
    throw new Error("SETOR_INVALIDO");
  }

  return usuarioRepository.atualizarSetorAnalista(id, setorId);
}

async function atualizarSituacao(id, ativo) {
  const analista = await usuarioRepository.buscarPorId(id);

  if (!analista || analista.perfil !== "analista") {
    throw new Error("ANALISTA_NAO_ENCONTRADO");
  }

  return usuarioRepository.atualizarSituacaoAnalista(id, ativo);
}

async function redefinirSenhaPeloSupervisor(usuarioId) {
  const usuario = await usuarioRepository.buscarPorId(usuarioId);

  if (!usuario) {
    throw new Error("USUARIO_NAO_ENCONTRADO");
  }

  if (!usuario.ativo) {
    throw new Error("USUARIO_INATIVO");
  }

  // Gera uma senha temporária aleatória de 10 caracteres.
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