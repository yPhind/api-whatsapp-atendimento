const jwt = require("jsonwebtoken");
const usuarioRepository = require("../repositories/usuarioSistemaRepository");

module.exports = function configurarSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Autenticação necessária."));

      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "whatsapp-atendimento",
        audience: "whatsapp-atendimento-web"
      });
      const usuario = await usuarioRepository.buscarPorId(payload.sub);
      if (!usuario || !usuario.ativo) {
        return next(new Error("Sessão inválida ou usuário inativo."));
      }

      socket.usuarioSistema = {
        id: Number(usuario.id),
        perfil: usuario.perfil,
        setorId: usuario.setor_id == null ? null : Number(usuario.setor_id)
      };
      next();
    } catch (erro) {
      next(new Error("Token inválido ou expirado."));
    }
  });

  io.on("connection", (socket) => {
    const usuario = socket.usuarioSistema;
    socket.join(`usuario:${usuario.id}`);
    if (usuario.perfil === "supervisor") socket.join("supervisores");
    if (usuario.perfil === "analista" && usuario.setorId) {
      socket.join(`setor:${usuario.setorId}`);
    }
  });
};
