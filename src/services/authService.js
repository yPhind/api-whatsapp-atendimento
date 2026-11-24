const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const usuarioRepository = require("../repositories/usuarioSistemaRepository");
const permissaoService = require("./permissaoService");

const TEMPO_TOKEN = "8h";

async function login({ login, senha }) {
  const usuario = await usuarioRepository.buscarPorLogin(login);

  if (!usuario) {
    throw new Error("CREDENCIAIS_INVALIDAS");
  }

  if (!usuario.ativo) {
    throw new Error("USUARIO_INATIVO");
  }

  const senhaValida = await bcrypt.compare(
    senha,
    usuario.senha_hash
  );

  if (!senhaValida) {
    throw new Error("CREDENCIAIS_INVALIDAS");
  }

  const token = jwt.sign(
    {
      perfil: usuario.perfil,
      setorId: usuario.setor_id
    },
    process.env.JWT_SECRET,
    {
      subject: String(usuario.id),
      expiresIn: TEMPO_TOKEN,
      issuer: "whatsapp-atendimento",
      audience: "whatsapp-atendimento-web"
    }
  );

  await usuarioRepository.atualizarUltimoAcesso(usuario.id);

  return {
    token,
    expiracao: TEMPO_TOKEN,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      username: usuario.username,
      perfil: usuario.perfil,
      setorId: usuario.setor_id,
      deveRedefinirSenha: usuario.deve_redefinir_senha === true
    }
  };
}

async function obterPerfil(id) {
  const usuario = await usuarioRepository.buscarPorId(id);

  if (!usuario) {
    throw new Error("CREDENCIAIS_INVALIDAS");
  }

  if (!usuario.ativo) {
    throw new Error("USUARIO_INATIVO");
  }

  const permissoes =
    await permissaoService.listarPermissoesUsuario(
      usuario.id,
      usuario.perfil
    );

  return {
    ...usuario,
    permissoes
  };
}

async function trocarMinhaSenha(usuarioId, novaSenha) {
  const usuario = await usuarioRepository.buscarPorId(usuarioId);

  if (!usuario) {
    throw new Error("USUARIO_NAO_ENCONTRADO");
  }

  const senhaHash = await bcrypt.hash(novaSenha, 4);

  const usuarioAtualizado =
    await usuarioRepository.concluirRedefinicaoSenha(
      usuarioId,
      senhaHash
    );

  if (!usuarioAtualizado) {
    throw new Error("USUARIO_NAO_ENCONTRADO");
  }

  return usuarioAtualizado;
}

module.exports = {
  login,
  obterPerfil,
  trocarMinhaSenha
};