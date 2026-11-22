const dashboardRepository = require("../repositories/dashboardRepository");

async function obterIndicadores(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    let setorId = null;

    // A restrição é aplicada no servidor: o analista nunca escolhe o setor
    // por parâmetro e recebe exclusivamente os indicadores do próprio setor.
    if (usuario.perfil === "analista") {
      setorId = Number(usuario.setorId);
      if (!Number.isInteger(setorId) || setorId <= 0) {
        return res.status(403).json({
          mensagem: "Seu usuário não possui um setor válido para consultar os indicadores."
        });
      }
    }

    const indicadores = await dashboardRepository.obterIndicadores(setorId);
    return res.json(indicadores);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { obterIndicadores };
