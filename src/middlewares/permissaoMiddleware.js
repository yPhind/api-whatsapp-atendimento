
const permissaoService = require("../services/permissaoService");

function exigirPermissao(codigo) {
  return async function (req, res, next) {
    try {
      if (!req.usuarioSistema) {
        return res.status(401).json({
          mensagem: "Autenticação necessária."
        });
      }

      const permitido =
        await permissaoService.usuarioTemPermissao(
          req.usuarioSistema.id,
          req.usuarioSistema.perfil,
          codigo
        );

      if (!permitido) {
        return res.status(403).json({
          codigo: "PERMISSAO_NEGADA",
          mensagem: "Você não possui permissão para executar esta ação."
        });
      }

      next();
    } catch (erro) {
      next(erro);
    }
  };
}

module.exports = { exigirPermissao };