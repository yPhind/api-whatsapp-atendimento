
const authService = require("../services/authService");
const recuperacaoService = require("../services/recuperacaoSenhaService");

const {
  loginSchema,
  recuperacaoSchema,
  trocarMinhaSenhaSchema
} = require("../utils/validators");

async function login(req, res, next) {
  try {
    const dados = loginSchema.parse(req.body);
    const resultado = await authService.login(dados);

    res.json(resultado);
  } catch (erro) {
    if (erro.name === "ZodError") {
      return res.status(400).json({
        mensagem: "Dados de login inválidos."
      });
    }

    if (erro.message === "USUARIO_INATIVO") {
      return res.status(403).json({
        mensagem: "Esta conta está desativada. Entre em contato com o supervisor."
      });
    }

    if (erro.message === "CREDENCIAIS_INVALIDAS") {
      return res.status(401).json({
        mensagem: "Usuário ou senha inválidos."
      });
    }

    next(erro);
  }
}

async function perfil(req, res, next) {
  try {
    const usuario = await authService.obterPerfil(
      req.usuarioSistema.id
    );

    res.json(usuario);
  } catch (erro) {
    next(erro);
  }
}

async function solicitarRecuperacao(req, res, next) {
  try {
    const dados = recuperacaoSchema.parse(req.body);

    await recuperacaoService.solicitar(dados.email);

    res.json({
      mensagem: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação."
    });
  } catch (erro) {
    if (erro.name === "ZodError") {
      return res.status(400).json({
        mensagem: "Informe um e-mail válido."
      });
    }

    next(erro);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    const dados = trocarMinhaSenhaSchema.parse(req.body);

    await recuperacaoService.redefinir(dados);

    res.json({
      mensagem: "Senha redefinida com sucesso."
    });
  } catch (erro) {
    if (erro.name === "ZodError") {
      return res.status(400).json({
        mensagem: "Dados inválidos. A senha deve ter pelo menos 4 caracteres."
      });
    }

    if (erro.message === "TOKEN_INVALIDO_OU_EXPIRADO") {
      return res.status(400).json({
        mensagem: "O link de recuperação é inválido ou expirou."
      });
    }

    next(erro);
  }
}

async function trocarMinhaSenha(req, res, next) {
  try {
    const dados = trocarMinhaSenhaSchema.parse(req.body);
    const usuarioId = req.usuarioSistema.id;

    const resultado = await authService.trocarMinhaSenha(
      usuarioId,
      dados.senha
    );

    res.json({
      mensagem: "Senha alterada com sucesso.",
      usuario: resultado
    });
  } catch (erro) {
    if (erro.name === "ZodError") {
      return res.status(400).json({
        mensagem: "A nova senha deve ter pelo menos 4 caracteres."
      });
    }

    if (erro.message === "USUARIO_NAO_ENCONTRADO") {
      return res.status(404).json({
        mensagem: "Usuário não encontrado."
      });
    }

    next(erro);
  }
}

module.exports = {
  login,
  perfil,
  solicitarRecuperacao,
  redefinirSenha,
  trocarMinhaSenha
};
