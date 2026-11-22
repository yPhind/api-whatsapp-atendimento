function permitirPerfis(...perfisPermitidos) {
  return (req, res, next) => {
    const usuario = req.usuarioSistema;

    if (!usuario || !perfisPermitidos.includes(usuario.perfil)) {
      return res.status(403).json({
        mensagem: "Você não tem permissão para esta operação."
      });
    }

    next();
  };
}

module.exports = permitirPerfis;