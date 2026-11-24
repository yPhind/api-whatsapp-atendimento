const permissaoService = require("../services/permissaoService");

async function listarPermissoesAnalista(req, res, next) {
  try {
    const papel = await permissaoService.listarConfiguracaoAnalista();
    return res.json({ papel });
  } catch (erro) {
    next(erro);
  }
}

async function atualizarPermissoesAnalista(req, res, next) {
  try {
    const permissoes = req.body?.permissoes;

    if (!Array.isArray(permissoes)) {
      return res.status(400).json({
        mensagem: "Envie uma lista de permissões no campo 'permissoes'."
      });
    }

    const codigos = new Set();
    for (const item of permissoes) {
      if (
        !item ||
        typeof item.codigo !== "string" ||
        item.codigo.trim() === "" ||
        typeof item.permitido !== "boolean"
      ) {
        return res.status(400).json({
          mensagem: "Cada permissão deve conter 'codigo' (texto) e 'permitido' (booleano)."
        });
      }

      if (codigos.has(item.codigo)) {
        return res.status(400).json({
          mensagem: `O código de permissão '${item.codigo}' foi enviado mais de uma vez.`
        });
      }
      codigos.add(item.codigo);
    }

    const papel = await permissaoService.atualizarConfiguracaoAnalista(
      permissoes.map((item) => ({
        codigo: item.codigo.trim(),
        permitido: item.permitido
      }))
    );

    return res.json({
      mensagem: "Permissões do perfil Analista atualizadas com sucesso.",
      papel
    });
  } catch (erro) {
    next(erro);
  }
}


function validarListaPermissoes(permissoes) {
  if (!Array.isArray(permissoes)) {
    return "Envie uma lista de permissões no campo 'permissoes'.";
  }
  const codigos = new Set();
  for (const item of permissoes) {
    if (!item || typeof item.codigo !== "string" || !item.codigo.trim() ||
        !(typeof item.permitido === "boolean" || item.permitido === null)) {
      return "Cada permissão deve conter 'codigo' (texto) e 'permitido' (booleano ou null para herdar).";
    }
    if (codigos.has(item.codigo.trim())) {
      return `O código '${item.codigo}' foi enviado mais de uma vez.`;
    }
    codigos.add(item.codigo.trim());
  }
  return null;
}

async function listarPermissoesUsuario(req, res, next) {
  try {
    const usuarioId = Number(req.params.usuarioId);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ mensagem: "Identificador de analista inválido." });
    }
    const resultado = await permissaoService.listarConfiguracaoUsuario(usuarioId);
    return res.json(resultado);
  } catch (erro) {
    next(erro);
  }
}

async function atualizarPermissoesUsuario(req, res, next) {
  try {
    const usuarioId = Number(req.params.usuarioId);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ mensagem: "Identificador de analista inválido." });
    }
    const erroValidacao = validarListaPermissoes(req.body?.permissoes);
    if (erroValidacao) return res.status(400).json({ mensagem: erroValidacao });

    const resultado = await permissaoService.atualizarConfiguracaoUsuario(
      usuarioId,
      req.body.permissoes.map((item) => ({
        codigo: item.codigo.trim(),
        permitido: item.permitido
      }))
    );
    return res.json({
      mensagem: `Permissões individuais de ${resultado.usuario.nome} atualizadas com sucesso.`,
      ...resultado
    });
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  listarPermissoesAnalista,
  atualizarPermissoesAnalista,
  listarPermissoesUsuario,
  atualizarPermissoesUsuario
};
