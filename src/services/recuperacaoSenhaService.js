const crypto = require("crypto");
const bcrypt = require("bcrypt");

const usuarioRepository = require("../repositories/usuarioSistemaRepository");
const recuperacaoRepository = require("../repositories/recuperacaoSenhaRepository");
const emailService = require("./emailService");

async function solicitar(email) {
  const usuario = await usuarioRepository.buscarPorLogin(email);

  if (!usuario || !usuario.ativo || usuario.email.toLowerCase() !== email.toLowerCase()) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

  await recuperacaoRepository.criar({
    usuarioId: usuario.id,
    tokenHash,
    expiraEm
  });

  await emailService.enviarRecuperacao(usuario.email, token);
}

async function redefinir({ token, novaSenha }) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const senhaHash = await bcrypt.hash(novaSenha, 4);

  const sucesso = await recuperacaoRepository.redefinirSenha({
    tokenHash,
    senhaHash
  });

  if (!sucesso) {
    throw new Error("TOKEN_INVALIDO_OU_EXPIRADO");
  }
}

module.exports = {
  solicitar,
  redefinir
};