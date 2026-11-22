const jwt = require("jsonwebtoken");
const usuarioRepository = require("../repositories/usuarioSistemaRepository");

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      mensagem: "Autenticação necessária."
    });
  }

  try {
    const token = header.slice(7);

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "whatsapp-atendimento",
      audience: "whatsapp-atendimento-web"
    });

    const usuario = await usuarioRepository.buscarPorId(payload.sub);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({
        mensagem: "Sessão inválida ou usuário inativo."
      });
    }

    // Enquanto a senha temporária estiver ativa, só permite consultar o perfil
    // e concluir a troca de senha. Todo o restante da API fica bloqueado.
    const rotasPermitidasDuranteTroca = new Set([
      "/perfil",
      "/trocar-minha-senha"
    ]);
    if (usuario.deve_redefinir_senha === true &&
        !rotasPermitidasDuranteTroca.has(req.path)) {
      return res.status(403).json({
        codigo: "SENHA_TEMPORARIA",
        mensagem: "Sua senha foi redefinida. Entre novamente com a senha temporária e crie uma nova senha para continuar."
      });
    }

    req.usuarioSistema = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      setorId: usuario.setor_id
    };

    next();
  } catch (erro) {
    if (erro.name === "JsonWebTokenError" ||
        erro.name === "TokenExpiredError") {
      return res.status(401).json({
        mensagem: "Token inválido ou expirado."
      });
    }

    next(erro);
  }
}

module.exports = authMiddleware;