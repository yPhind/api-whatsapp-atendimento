function exigirSupervisor(req, res, next) {
  const perfil = String(req.usuarioSistema?.perfil || "").toLowerCase();

  if (!req.usuarioSistema || perfil !== "supervisor") {
    return res.status(403).json({
      codigo: "ACESSO_RESTRITO_SUPERVISOR",
      mensagem: "Somente o supervisor pode gerenciar as permissões."
    });
  }

  next();
}

module.exports = exigirSupervisor;
