
const analistaService = require("../services/analistaService");
const { usuarioSchema } = require("../utils/validators");
const gerenciarSessoes = require("../realtime/gerenciarSessoes");

async function criar(req, res, next) {
  try {
    const dados = usuarioSchema.parse(req.body);
    const analista = await analistaService.criarAnalista(dados);

    res.status(201).json({
      mensagem: "Analista cadastrado com sucesso.",
      analista
    });
  } catch (erro) {
    if (erro.name === "ZodError") {
      return res.status(400).json({
        mensagem: "Os dados informados são inválidos.",
        erros: erro.issues.map((item) => ({
          campo: item.path.join("."),
          mensagem: item.message
        }))
      });
    }

    if (erro.message === "SETOR_INVALIDO") {
      return res.status(400).json({
        mensagem: "O setor informado não existe ou está inativo."
      });
    }

    if (erro.code === "23505") {
      return res.status(409).json({
        mensagem: "O e-mail ou nome de usuário já está cadastrado."
      });
    }

    next(erro);
  }
}

async function listarSetores(req, res, next) {
  try {
    const setores = await analistaService.listarSetores();
    res.status(200).json({ setores });
  } catch (erro) {
    next(erro);
  }
}

async function listar(req, res, next) {
  try {
    const analistas = await analistaService.listarAnalistas();

    res.status(200).json({ analistas });
  } catch (erro) {
    next(erro);
  }
}

async function atualizarSetor(req, res, next) {
  try {
    const id = Number(req.params.id);
    const setorId = Number(req.body.setorId);

    if (!Number.isInteger(id) || id <= 0 ||
      !Number.isInteger(setorId) || setorId <= 0) {
      return res.status(400).json({
        mensagem: "Identificador ou setor inválido."
      });
    }

    const analista = await analistaService.atualizarSetor(id, setorId);
    const io = req.app.get("io");
    await gerenciarSessoes.atualizarSetorUsuario(io, id, analista?.setor_id ?? setorId);

    res.status(200).json({
      mensagem: "Setor atualizado com sucesso.",
      analista
    });
  } catch (erro) {
    if (erro.message === "ANALISTA_NAO_ENCONTRADO") {
      return res.status(404).json({
        mensagem: "Analista não encontrado."
      });
    }

    if (erro.message === "SETOR_INVALIDO") {
      return res.status(400).json({
        mensagem: "Setor inválido ou inativo."
      });
    }

    next(erro);
  }
}

async function atualizarSituacao(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { ativo } = req.body;

    if (!Number.isInteger(id) || id <= 0 ||
      typeof ativo !== "boolean") {
      return res.status(400).json({
        mensagem: "Identificador ou situação inválida."
      });
    }

    const analista = await analistaService.atualizarSituacao(id, ativo);
    if (!ativo) {
      await gerenciarSessoes.desconectarUsuario(req.app.get("io"), id);
    }

    res.status(200).json({
      mensagem: ativo
        ? "Conta ativada com sucesso."
        : "Conta desativada com sucesso.",
      analista
    });
  } catch (erro) {
    if (erro.message === "ANALISTA_NAO_ENCONTRADO") {
      return res.status(404).json({
        mensagem: "Analista não encontrado."
      });
    }

    next(erro);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "Identificador do usuário inválido."
      });
    }

    const resultado =
      await analistaService.redefinirSenhaPeloSupervisor(id);
    // A redefinição de senha invalida as sessões Socket.IO já abertas.
    await gerenciarSessoes.desconectarUsuario(req.app.get("io"), id);

    res.status(200).json({
      mensagem: "Senha temporária gerada com sucesso.",
      senhaTemporaria: resultado.senhaTemporaria,
      usuario: resultado.usuario
    });
  } catch (erro) {
    console.error("ERRO AO REDEFINIR SENHA:", erro);

    if (erro.message === "USUARIO_NAO_ENCONTRADO") {
      return res.status(404).json({
        mensagem: "Usuário não encontrado."
      });
    }

    if (erro.message === "USUARIO_INATIVO") {
      return res.status(400).json({
        mensagem: "Não é possível redefinir a senha de um usuário inativo."
      });
    }

    if (erro.message === "ERRO_AO_REDEFINIR_SENHA") {
      return res.status(500).json({
        mensagem: "Não foi possível redefinir a senha."
      });
    }

    next(erro);
  }
}
  module.exports = {
    criar,
    listar,
    listarSetores,
    atualizarSituacao,
    atualizarSetor,
    redefinirSenha
  };