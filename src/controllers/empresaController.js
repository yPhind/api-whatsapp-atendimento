const empresaRepository = require("../repositories/empresaRepository");

async function listar(req, res, next) {
  try {
    const empresas = await empresaRepository.listarAtivas();
    return res.status(200).json({ empresas });
  } catch (erro) {
    next(erro);
  }
}

module.exports = { listar };
