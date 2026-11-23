const atendimentoService = require("../services/atendimentoService");
const atendimentoRepository = require("../repositories/atendimentoRepository");
const empresaService = require("../services/empresaService");
const mensagemRepository = require("../repositories/mensagemRepository");
const whatsappCloudService = require("../services/whatsappCloudService");
const notificarAtendimento = require("../realtime/notificarAtendimento");
const logService = require("../services/logService");

async function consultarEmpresaCnpj(req, res, next) {
  try {
    const cnpj = String(req.params.cnpj || "").replace(/\D/g, "");

    if (cnpj.length !== 14) {
      return res.status(400).json({
        mensagem: "Informe um CNPJ com 14 dígitos."
      });
    }

    const empresa = await require("../repositories/empresaRepository")
      .buscarPorCnpj(cnpj);

    return res.json({
      encontrada: Boolean(empresa),
      empresa
    });
  } catch (erro) {
    next(erro);
  }
}

async function abrirManual(req, res, next) {
  try {
    const usuario = req.usuarioSistema;

    const nome = String(req.body.nome || "").trim();
    const telefone = String(req.body.telefone || "").replace(/\D/g, "");
    const cnpj = String(req.body.cnpj || "").replace(/\D/g, "");
    const descricao = String(req.body.descricao || "").trim();

    const setorId = usuario.perfil === "supervisor"
      ? Number(req.body.setorId)
      : Number(usuario.setor_id ?? usuario.setorId);

    if (nome.length < 2 || nome.length > 150) {
      return res.status(400).json({
        mensagem: "Informe o nome do cliente."
      });
    }

    if (telefone.length < 10 || telefone.length > 15) {
      return res.status(400).json({
        mensagem: "Informe um telefone válido."
      });
    }

    if (cnpj.length !== 14 || !descricao || descricao.length > 4000) {
      return res.status(400).json({
        mensagem: "CNPJ e descrição do atendimento são obrigatórios."
      });
    }

    if (!Number.isInteger(setorId) || setorId <= 0) {
      return res.status(400).json({
        mensagem: "Selecione um setor válido."
      });
    }

    const { empresa } = await empresaService.localizarOuCadastrar({
      cnpj,
      razaoSocial: req.body.razaoSocial,
      nomeFantasia: req.body.nomeFantasia
    });

    const criado = await atendimentoService.abrirAtendimento({
      nome,
      telefone,
      whatsappId: telefone,
      setorId,
      empresaId: Number(empresa.id),
      descricao,
      remetenteTipo: usuario.perfil,
      remetenteId: Number(usuario.id),
      direcao: "interna",
      usuarioSistemaId: Number(usuario.id),
      origemAcao: "painel"
    });

    const atendimento = await atendimentoService.assumirAtendimento({
      atendimentoId: Number(criado.atendimento.id),
      analistaId: Number(usuario.id),
      setorId: usuario.perfil === "supervisor" ? null : setorId,
      usuarioSistemaId: Number(usuario.id)
    });

    notificarAtendimento(req, atendimento, "atendimento_aberto_manual");

    const conversa = await atendimentoService.obterConversa(
      Number(atendimento.id)
    );

    return res.status(201).json({
      mensagem: "Atendimento aberto e atribuído a você.",
      atendimento: conversa.atendimento
    });

  } catch (erro) {
    if (erro.message === "CNPJ_INVALIDO") {
      return res.status(400).json({
        mensagem: "CNPJ inválido. Confira os 14 dígitos."
      });
    }

    if (erro.message === "DADOS_EMPRESA_OBRIGATORIOS") {
      return res.status(400).json({
        mensagem: "Informe a razão social para cadastrar a empresa."
      });
    }

    if (erro.message === "Empresa inativa.") {
      return res.status(409).json({
        mensagem: "A empresa está inativa e não pode receber novos atendimentos."
      });
    }

    if (erro.message === "Setor não encontrado ou inativo.") {
      return res.status(400).json({
        mensagem: "O setor selecionado não existe ou está inativo."
      });
    }

    return next(erro);
  }
}

async function listarFila(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    let setorId;

    if (usuario.perfil === "supervisor") {
      const setorInformado = req.query.setorId;

      if (setorInformado === undefined || setorInformado === "") {
        setorId = null;
      } else {
        setorId = Number(setorInformado);

        if (!Number.isInteger(setorId) || setorId <= 0) {
          return res.status(400).json({
            mensagem: "Informe um setor válido."
          });
        }
      }
    } else {
      setorId = Number(usuario.setorId ?? usuario.setor_id);

      if (!Number.isInteger(setorId) || setorId <= 0) {
        return res.status(400).json({
          mensagem: "Seu usuário não possui um setor válido."
        });
      }
    }

    const fila = await atendimentoService.obterFila(setorId);

    return res.json(fila);
  } catch (erro) {
    next(erro);
  }
}

async function listarMeusAtendimentos(req, res, next) {
  try {
    const usuario = req.usuarioSistema;

    const atendimentos = await atendimentoRepository.listarDoAnalista(
      Number(usuario.id)
    );

    return res.json(atendimentos);
  } catch (erro) {
    next(erro);
  }
}

async function listarAtendimentosSupervisor(req, res, next) {
  try {
    const atendimentos =
      await atendimentoService.obterTodosParaSupervisor();

    return res.json(atendimentos);
  } catch (erro) {
    next(erro);
  }
}

async function replicarAtendimento(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);
    const setorId = Number(req.body.setorId);

    const analistaDestinoId = req.body.analistaId
      ? Number(req.body.analistaId)
      : null;

    const descricao = String(req.body.descricao || "").trim();

    if (descricao.length > 4000) {
      return res.status(400).json({
        mensagem: "A observação deve ter no máximo 4.000 caracteres."
      });
    }

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !Number.isInteger(setorId) ||
      setorId <= 0
    ) {
      return res.status(400).json({
        mensagem: "Atendimento ou setor inválido."
      });
    }

    if (usuario.perfil !== "supervisor" && req.body.analistaId) {
      return res.status(403).json({
        mensagem: "Somente o supervisor pode escolher o analista responsável."
      });
    }

    const resultado = await atendimentoService.replicarAtendimento({
      atendimentoId,
      setorId,
      descricao,
      analistaDestinoId,
      usuarioSistemaId: Number(usuario.id),
      perfil: usuario.perfil,
      setorUsuarioId: Number(usuario.setorId ?? usuario.setor_id)
    });

    notificarAtendimento(
      req,
      resultado.atendimento,
      "atendimento_replicado"
    );

    return res.status(201).json({
      mensagem: "Atendimento replicado com sucesso.",
      atendimento: resultado.atendimento,
      atendimentoOrigemId: resultado.atendimentoOrigemId
    });

  } catch (erro) {
    const respostas = {
      ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento não encontrado."],
      ATENDIMENTO_ARQUIVADO: [409, "Não é possível replicar um atendimento arquivado."],
      SETOR_NAO_ENCONTRADO: [404, "Setor não encontrado ou inativo."],
      SEM_PERMISSAO: [403, "Você não tem permissão para replicar este atendimento."],
      ANALISTA_NAO_ENCONTRADO: [404, "Analista não encontrado."],
      USUARIO_NAO_E_ANALISTA: [400, "O usuário selecionado não é um analista."],
      ANALISTA_INATIVO: [409, "O analista selecionado está inativo."],
      ANALISTA_OUTRO_SETOR: [400, "O analista selecionado não pertence ao setor escolhido."],
      ATENDIMENTO_NAO_DISPONIVEL: [409, "Não foi possível atribuir o atendimento replicado."]
    };

    if (respostas[erro.message]) {
      const [status, mensagem] = respostas[erro.message];

      return res.status(status).json({ mensagem });
    }

    return next(erro);
  }
}

async function assumir(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);
    const isSupervisor = usuario.perfil === "supervisor";

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.status(400).json({
        mensagem: "Identificador de atendimento inválido."
      });
    }

    const setorId = isSupervisor
      ? null
      : Number(usuario.setorId ?? usuario.setor_id);

    if (!isSupervisor && (!Number.isInteger(setorId) || setorId <= 0)) {
      return res.status(400).json({
        mensagem: "Seu usuário não possui um setor válido."
      });
    }

    const atendimento = await atendimentoService.assumirAtendimento({
      atendimentoId,
      analistaId: Number(usuario.id),
      setorId,
      usuarioSistemaId: Number(usuario.id)
    });

    if (!atendimento) {
      return res.status(409).json({
        mensagem: "Atendimento indisponível ou fora do seu setor."
      });
    }

    notificarAtendimento(req, atendimento, "atendimento_assumido");

    return res.json({
      mensagem: "Atendimento assumido.",
      atendimento
    });

  } catch (erro) {
    next(erro);
  }
}

async function atribuirParaAnalista(req, res, next) {
  try {
    const atendimentoId = Number(req.params.id);
    const analistaId = Number(req.body.analistaId);
    const usuario = req.usuarioSistema;

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !Number.isInteger(analistaId) ||
      analistaId <= 0
    ) {
      return res.status(400).json({
        mensagem: "Atendimento ou analista inválido."
      });
    }

    const atendimento = await atendimentoService.atribuirParaAnalista({
      atendimentoId,
      analistaId,
      usuarioSistemaId: Number(usuario.id)
    });

    notificarAtendimento(req, atendimento, "atendimento_atribuido");

    return res.json({
      mensagem: "Atendimento atribuído com sucesso.",
      atendimento
    });

  } catch (erro) {
    const respostas = {
      ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento não encontrado."],
      ATENDIMENTO_ARQUIVADO: [409, "Não é possível atribuir um atendimento arquivado."],
      ATENDIMENTO_FINALIZADO: [409, "Não é possível atribuir um atendimento finalizado."],
      ANALISTA_NAO_ENCONTRADO: [404, "Analista não encontrado."],
      USUARIO_NAO_E_ANALISTA: [400, "O usuário selecionado não é um analista."],
      ANALISTA_INATIVO: [409, "O analista selecionado está inativo."],
      ANALISTA_OUTRO_SETOR: [403, "O analista pertence a outro setor."],
      ATENDIMENTO_NAO_DISPONIVEL: [409, "O atendimento não está mais disponível para atribuição."]
    };

    if (respostas[erro.message]) {
      const [status, mensagem] = respostas[erro.message];

      return res.status(status).json({ mensagem });
    }

    return next(erro);
  }
}

async function alterarSetorAtendimento(req, res, next) {
  try {
    const atendimentoId = Number(req.params.id);
    const setorId = Number(req.body.setorId);
    const usuario = req.usuarioSistema;

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !Number.isInteger(setorId) ||
      setorId <= 0
    ) {
      return res.status(400).json({
        mensagem: "Atendimento ou setor inválido."
      });
    }

    const resultado = await atendimentoService.alterarSetorAtendimento({
      atendimentoId,
      setorId,
      usuarioSistemaId: Number(usuario.id)
    });

    notificarAtendimento(
      req,
      resultado.atendimento,
      "atendimento_setor_alterado",
      resultado.setorAnteriorId
    );

    return res.json({
      mensagem: "Setor alterado. O atendimento voltou à fila do novo setor.",
      atendimento: resultado.atendimento
    });

  } catch (erro) {
    const respostas = {
      ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento não encontrado."],
      ATENDIMENTO_ARQUIVADO: [409, "Não é possível alterar o setor de um atendimento arquivado."],
      ATENDIMENTO_FINALIZADO: [409, "Não é possível alterar o setor de um atendimento realizado."],
      SETOR_NAO_ENCONTRADO: [404, "Setor não encontrado ou inativo."],
      SETOR_IGUAL: [400, "Selecione um setor diferente do atual."],
      ATENDIMENTO_NAO_DISPONIVEL: [409, "O atendimento não está mais disponível para alteração."]
    };

    if (respostas[erro.message]) {
      const [status, mensagem] = respostas[erro.message];

      return res.status(status).json({ mensagem });
    }

    return next(erro);
  }
}

async function alterarStatus(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);
    const { status } = req.body;
    const isSupervisor = usuario.perfil === "supervisor";

    const statusPermitidos = [
      "aguardando",
      "em_atendimento",
      "pendente",
      "realizado"
    ];

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !statusPermitidos.includes(status)
    ) {
      return res.status(400).json({
        mensagem: "Atendimento ou status inválido."
      });
    }

    const atendimento = await atendimentoService.alterarStatus({
      atendimentoId,
      analistaId: Number(usuario.id),
      status,
      isSupervisor,
      usuarioSistemaId: Number(usuario.id)
    });

    if (!atendimento) {
      return res.status(404).json({
        mensagem: "Atendimento não encontrado ou sem permissão."
      });
    }

    notificarAtendimento(req, atendimento, "status_alterado");

    return res.json({
      mensagem: "Status atualizado.",
      atendimento
    });

  } catch (erro) {
    if (erro.message === "SEM_PERMISSAO") {
      return res.status(403).json({
        mensagem: "Você não tem permissão para alterar este atendimento."
      });
    }

    if (erro.message === "ATENDIMENTO_NAO_ENCONTRADO") {
      return res.status(404).json({
        mensagem: "Atendimento não encontrado."
      });
    }

    if (erro.message === "ATENDIMENTO_ARQUIVADO") {
      return res.status(409).json({
        mensagem: "Não é possível alterar um atendimento arquivado."
      });
    }

    if (erro.message === "ATENDIMENTO_NAO_DISPONIVEL") {
      return res.status(409).json({
        mensagem: "O atendimento não está mais disponível."
      });
    }

    return next(erro);
  }
}

async function editarAtendimento(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);
    const setorId = Number(req.body.setorId);

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !Number.isInteger(setorId) ||
      setorId <= 0
    ) {
      return res.status(400).json({
        mensagem: "Atendimento ou setor inválido."
      });
    }

    const atendimento = await atendimentoService.editarAtendimento({
      atendimentoId,
      nome: req.body.nome,
      descricao: req.body.descricao,
      setorId,
      usuarioSistemaId: Number(usuario.id),
      perfil: usuario.perfil,
      analistaId: Number(usuario.id)
    });

    notificarAtendimento(req, atendimento, "atendimento_editado");

    return res.json({
      mensagem: "Atendimento atualizado com sucesso.",
      atendimento
    });

  } catch (erro) {
    const respostas = {
      ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento não encontrado."],
      ATENDIMENTO_ARQUIVADO: [409, "Atendimentos realizados ou arquivados não podem ser editados."],
      SEM_PERMISSAO: [403, "Você só pode editar atendimentos sob sua responsabilidade."],
      SETOR_NAO_ENCONTRADO: [400, "O setor selecionado não existe ou está inativo."],
      NOME_INVALIDO: [400, "Informe um nome de cliente entre 2 e 150 caracteres."],
      DESCRICAO_INVALIDA: [400, "Informe o motivo do atendimento (máximo de 4.000 caracteres)."]
    };

    if (respostas[erro.message]) {
      const [status, mensagem] = respostas[erro.message];

      return res.status(status).json({ mensagem });
    }

    return next(erro);
  }
}

async function obterConversa(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.status(400).json({
        mensagem: "Identificador inválido."
      });
    }

    const resultado = await atendimentoService.obterConversa(atendimentoId);
    const atendimento = resultado.atendimento;

    if (
      usuario.perfil !== "supervisor" &&
      (
        Number(atendimento.setor_id) !== Number(usuario.setorId ?? usuario.setor_id) ||
        Number(atendimento.analista_id) !== Number(usuario.id)
      )
    ) {
      return res.status(403).json({
        mensagem: "Você não tem acesso a este atendimento."
      });
    }

    return res.json(resultado);

  } catch (erro) {
    next(erro);
  }
}

async function enviarMensagemInterna(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);
    const conteudo = String(req.body.conteudo || "").trim();
    const isSupervisor = usuario.perfil === "supervisor";

    if (
      !Number.isInteger(atendimentoId) ||
      atendimentoId <= 0 ||
      !conteudo
    ) {
      return res.status(400).json({
        mensagem: "Atendimento e conteúdo são obrigatórios."
      });
    }

    const atendimento = await atendimentoRepository.buscarPorId(
      atendimentoId
    );

    if (!atendimento) {
      return res.status(404).json({
        mensagem: "Atendimento não encontrado."
      });
    }

    const semPermissaoAnalista =
      !isSupervisor &&
      (
        Number(atendimento.setor_id) !== Number(usuario.setorId ?? usuario.setor_id) ||
        Number(atendimento.analista_id) !== Number(usuario.id)
      );

    if (
      atendimento.arquivado ||
      atendimento.status === "realizado" ||
      semPermissaoAnalista
    ) {
      return res.status(403).json({
        mensagem: "Não é permitido enviar mensagem neste atendimento."
      });
    }

    let respostaMeta;

    try {
      respostaMeta = await whatsappCloudService.enviarTexto(
        String(atendimento.usuario_telefone || "").replace(/\D/g, ""),
        conteudo
      );
    } catch (erroMeta) {
      const detalhe =
        erroMeta.response?.data?.error?.message || erroMeta.message;

      console.error(
        "Falha ao enviar mensagem pela WhatsApp Cloud API:",
        detalhe
      );

      await logService.error({
        origem: "atendimentoController",
        evento: "mensagem_envio_falhou",
        mensagem: "Falha no envio de mensagem pela WhatsApp Cloud API.",
        atendimento_id: atendimentoId,
        usuario_sistema_id: Number(usuario.id),
        contexto: {
          perfil: usuario.perfil,
          erro: String(detalhe).slice(0, 300),
          origem_acao: "painel"
        }
      });

      return res.status(502).json({
        mensagem: `A Meta não aceitou o envio. Confira a configuração da API, o telefone e a janela de atendimento. Detalhe: ${detalhe}`
      });
    }

    const mensagem = await mensagemRepository.criar({
      atendimentoId,
      remetenteTipo: usuario.perfil,
      remetenteId: Number(usuario.id),
      direcao: "saida",
      conteudo,
      identificadorExterno: respostaMeta.messages?.[0]?.id || null,
      dadosExtras: {
        origem: "painel",
        meta: respostaMeta
      }
    });

    await logService.info({
      origem: "atendimentoController",
      evento: "mensagem_enviada",
      mensagem: "Mensagem enviada ao cliente pelo painel.",
      atendimento_id: atendimentoId,
      usuario_sistema_id: Number(usuario.id),
      contexto: {
        mensagem_id: mensagem.id || null,
        identificador_externo: respostaMeta.messages?.[0]?.id || null,
        tipo: "texto",
        direcao: "saida",
        origem_acao: "painel"
      }
    });

    notificarAtendimento(req, atendimento, "nova_mensagem");

    return res.status(201).json(mensagem);

  } catch (erro) {
    next(erro);
  }
}

async function devolverParaFila(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentoId = Number(req.params.id);

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.status(400).json({
        mensagem: "Identificador de atendimento inválido."
      });
    }

    const atendimento = await atendimentoService.devolverParaFila({
      atendimentoId,
      usuarioSistemaId: Number(usuario.id),
      perfil: usuario.perfil,
      setorId: Number(usuario.setorId ?? usuario.setor_id),
      analistaId: Number(usuario.id)
    });

    notificarAtendimento(req, atendimento, "atendimento_devolvido_fila");

    return res.json({
      mensagem: "Atendimento devolvido para a fila.",
      atendimento
    });

  } catch (erro) {
    const respostas = {
      ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento não encontrado."],
      ATENDIMENTO_ARQUIVADO: [409, "Não é possível alterar um atendimento arquivado."],
      ATENDIMENTO_FINALIZADO: [409, "Não é possível devolver um atendimento finalizado."],
      SEM_PERMISSAO: [403, "Você só pode devolver à fila atendimentos sob sua responsabilidade e do seu setor."],
      ATENDIMENTO_SEM_ANALISTA: [409, "O atendimento já está sem analista."],
      ATENDIMENTO_NAO_DISPONIVEL: [409, "O atendimento não está mais disponível."]
    };

    if (respostas[erro.message]) {
      const [status, mensagem] = respostas[erro.message];

      return res.status(status).json({ mensagem });
    }

    return next(erro);
  }
}

async function listarHistorico(req, res, next) {
  try {
    const usuario = req.usuarioSistema;
    const atendimentos = await atendimentoService.obterAtendimentosHistorico({
      perfil: usuario.perfil,
      usuarioId: Number(usuario.id)
    });

    return res.json({ atendimentos });
  } catch (erro) {
    next(erro);
  }
}

async function obterConversaHistorica(req, res, next) {
  const usuario = req.usuarioSistema;
  const atendimentoId = Number(req.params.id);

  if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
    return res.status(400).json({
      mensagem: "Identificador de atendimento inválido."
    });
  }

  try {
    const resultado = await atendimentoService.obterConversa(atendimentoId);
    const atendimento = resultado.atendimento;

    if (
      atendimento.status !== "realizado" &&
      atendimento.arquivado !== true
    ) {
      return res.status(404).json({
        mensagem: "Atendimento não encontrado no histórico."
      });
    }

    if (
      usuario.perfil !== "supervisor" &&
      Number(atendimento.analista_id) !== Number(usuario.id)
    ) {
      return res.status(403).json({
        mensagem: "Você não tem acesso a este atendimento no histórico."
      });
    }

    return res.json(resultado);

  } catch (erro) {
    if (erro.message === "Atendimento não encontrado.") {
      return res.status(404).json({
        mensagem: erro.message
      });
    }

    return next(erro);
  }
}

async function listarLogs(req, res, next) {
  try {
    const relatorioRepository =
      require("../repositories/relatorioRepository");

    const logs = await relatorioRepository.listarLogs(req.query || {});

    return res.json({ logs });
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  consultarEmpresaCnpj,
  abrirManual,
  replicarAtendimento,
  listarFila,
  listarMeusAtendimentos,
  listarAtendimentosSupervisor,
  assumir,
  atribuirParaAnalista,
  alterarSetorAtendimento,
  alterarStatus,
  editarAtendimento,
  obterConversa,
  enviarMensagemInterna,
  devolverParaFila,
  listarHistorico,
  obterConversaHistorica,
  listarLogs
};