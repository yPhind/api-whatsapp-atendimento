
const usuarioRepository = require("../repositories/usuarioRepository");
const atendimentoRepository = require("../repositories/atendimentoRepository");
const mensagemRepository = require("../repositories/mensagemRepository");
const setorRepository = require("../repositories/setorRepository");
const empresaRepository = require("../repositories/empresaRepository");
const usuarioSistemaRepository = require("../repositories/usuarioSistemaRepository");
const historicoAtendimentoRepository = require("../repositories/historicoAtendimentoRepository");
const logService = require("./logService");

async function abrirAtendimento({
  nome,
  telefone,
  whatsappId,
  setorId,
  empresaId,
  descricao,
  remetenteTipo = "usuario",
  remetenteId = null,
  direcao = "entrada",
  atendimentoOrigemId = null,
  whatsappMessageId = null,
  usuarioSistemaId = null,
  origemAcao = null
}) {
  if (!telefone || !setorId || !empresaId || !descricao?.trim()) {
    throw new Error(
      "Telefone, setor, empresa e descrição são obrigatórios."
    );
  }

  const setor = await setorRepository.buscarPorId(setorId);

  if (!setor || setor.ativo === false) {
    throw new Error("Setor não encontrado ou inativo.");
  }

  const empresa = await empresaRepository.buscarPorId(empresaId);

  if (!empresa) {
    throw new Error("Empresa não encontrada.");
  }

  if (empresa.status !== "Ativa") {
    throw new Error("Empresa inativa.");
  }

  const usuario = await usuarioRepository.criar({
    nome,
    telefone,
    whatsappId,
    empresaId
  });

  const cnpj = String(empresa.cnpj || "").replace(/\\D/g, "");

  if (cnpj.length !== 14) {
    throw new Error("CNPJ_INVALIDO_PARA_GERAR_PROTOCOLO");
  }

  const atendimento = await atendimentoRepository.criar({
    usuarioId: usuario.id,
    usuarioNome: String(nome || "").trim(),
    setorId: setor.id,
    empresaId,
    cnpj,
    descricao: descricao.trim(),
    atendimentoOrigemId
  });

  // Descrições internas não devem aparecer na conversa do cliente.
  // Somente mensagens recebidas entram na conversa do atendimento.
  if (direcao === "entrada") {
    await mensagemRepository.criar({
      atendimentoId: atendimento.id,
      remetenteTipo,
      remetenteId,
      direcao,
      tipo: "texto",
      conteudo: descricao.trim(),
      identificadorExterno: whatsappMessageId,
      dadosExtras: {
        origem: whatsappMessageId ? "meta_api" : "sistema"
      }
    });
  }

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_criado",
    mensagem: "Novo atendimento criado.",
    atendimento_id: atendimento.id,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      setor_id: setorId,
      empresa_id: empresaId,
      usuario_cliente_id: usuario.id,
      status: atendimento.status || "aguardando",
      direcao,
      origem_acao: origemAcao || (
        direcao === "entrada"
          ? "meta_api"
          : atendimentoOrigemId
            ? "replicacao"
            : "painel"
      ),
      atendimento_origem_id: atendimentoOrigemId
    }
  });

  return {
    atendimento,
    usuario,
    setor,
    empresa
  };
}

async function obterFila(setorId = null) {
  if (setorId !== null) {
    const setor = await setorRepository.buscarPorId(setorId);

    if (!setor) {
      throw new Error("Setor não encontrado ou inativo.");
    }
  }

  return atendimentoRepository.listarFila(setorId);
}

async function obterTodosParaSupervisor() {
  return atendimentoRepository.listarTodosParaSupervisor();
}

async function obterAtendimentosHistorico({ perfil, usuarioId }) {
  // Supervisor consulta todo o histórico; analista somente seus próprios chamados.
  const analistaId = perfil === "supervisor" ? null : Number(usuarioId);
  return atendimentoRepository.listarHistorico(analistaId);
}

async function obterConversa(atendimentoId) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("Atendimento não encontrado.");
  }

  const mensagens = await mensagemRepository.listarPorAtendimento(
    atendimentoId
  );

  return { atendimento, mensagens };
}

async function atribuirParaAnalista({
  atendimentoId,
  analistaId,
  usuarioSistemaId
}) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  if (atendimento.status === "realizado") {
    throw new Error("ATENDIMENTO_FINALIZADO");
  }

  const analista = await usuarioSistemaRepository.buscarPorId(analistaId);

  if (!analista) {
    throw new Error("ANALISTA_NAO_ENCONTRADO");
  }

  if (analista.perfil !== "analista") {
    throw new Error("USUARIO_NAO_E_ANALISTA");
  }

  if (!analista.ativo) {
    throw new Error("ANALISTA_INATIVO");
  }

  if (Number(analista.setor_id) !== Number(atendimento.setor_id)) {
    throw new Error("ANALISTA_OUTRO_SETOR");
  }

  const resultado = await atendimentoRepository.atribuirParaAnalista({
    atendimentoId,
    analistaId
  });

  if (!resultado) {
    throw new Error("ATENDIMENTO_NAO_DISPONIVEL");
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "atribuicao",
    valorAnterior: {
      analista_id: atendimento.analista_id || null,
      analista_nome: atendimento.analista_nome || null
    },
    valorNovo: {
      analista_id: resultado.analista_id,
      analista_nome: analista.nome
    },
    observacao: "Chamado atribuído pelo supervisor."
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_atribuido",
    mensagem: "Atendimento atribuído a um analista.",
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_anterior_id: atendimento.analista_id || null,
      analista_novo_id: resultado.analista_id,
      setor_id: atendimento.setor_id,
      origem_acao: "painel",
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return resultado;
}

async function alterarStatus({
  atendimentoId,
  analistaId,
  status,
  isSupervisor = false,
  usuarioSistemaId
}) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  if (
    !isSupervisor &&
    (
      !atendimento.analista_id ||
      Number(atendimento.analista_id) !== Number(analistaId)
    )
  ) {
    throw new Error("SEM_PERMISSAO");
  }

  if (!isSupervisor && atendimento.status === "aguardando") {
    throw new Error("SEM_PERMISSAO");
  }

  const resultado = await atendimentoRepository.alterarStatus({
    atendimentoId,
    analistaId,
    status,
    isSupervisor
  });

  if (!resultado) {
    throw new Error("ATENDIMENTO_NAO_DISPONIVEL");
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "alteracao_status",
    valorAnterior: {
      status: atendimento.status
    },
    valorNovo: {
      status: resultado.status
    },
    observacao: `Status alterado de "${atendimento.status}" para "${resultado.status}".`
  });

  const eventoStatus = resultado.status === "realizado"
    ? "atendimento_realizado"
    : atendimento.status === "realizado" && resultado.status === "pendente"
      ? "atendimento_reaberto"
      : resultado.status === "pendente"
        ? "atendimento_pendente"
        : resultado.status === "em_atendimento"
          ? "atendimento_iniciado"
          : "atendimento_status_alterado";

  await logService.info({
    origem: "atendimentoService",
    evento: eventoStatus,
    mensagem: `Status alterado de "${atendimento.status}" para "${resultado.status}".`,
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      status_anterior: atendimento.status,
      status_novo: resultado.status,
      analista_id: analistaId || null,
      perfil_responsavel: isSupervisor ? "supervisor" : "analista",
      origem_acao: "painel",
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return resultado;
}

async function editarAtendimento({
  atendimentoId,
  nome,
  descricao,
  setorId,
  usuarioSistemaId,
  perfil,
  analistaId
}) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado || atendimento.status === "realizado") {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  if (
    perfil !== "supervisor" &&
    (
      !atendimento.analista_id ||
      Number(atendimento.analista_id) !== Number(analistaId)
    )
  ) {
    throw new Error("SEM_PERMISSAO");
  }

  const setor = await setorRepository.buscarPorId(setorId);

  if (!setor || setor.ativo === false) {
    throw new Error("SETOR_NAO_ENCONTRADO");
  }

  const nomeLimpo = String(nome || "").trim();
  const descricaoLimpa = String(descricao || "").trim();

  if (nomeLimpo.length < 2 || nomeLimpo.length > 150) {
    throw new Error("NOME_INVALIDO");
  }

  if (!descricaoLimpa || descricaoLimpa.length > 4000) {
    throw new Error("DESCRICAO_INVALIDA");
  }

  const atualizado = await atendimentoRepository.editarDados({
    atendimentoId,
    nome: nomeLimpo,
    setorId,
    descricao: descricaoLimpa
  });

  if (!atualizado) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "edicao_atendimento",
    valorAnterior: {
      nome: atendimento.usuario_nome,
      descricao: atendimento.descricao,
      setor_id: atendimento.setor_id
    },
    valorNovo: {
      nome: nomeLimpo,
      descricao: descricaoLimpa,
      setor_id: setor.id,
      setor_nome: setor.nome
    },
    observacao: "Dados do atendimento editados. Se o setor mudou, o chamado voltou à fila do novo setor."
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_editado",
    mensagem: "Dados do atendimento foram editados.",
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      nome_alterado: atendimento.usuario_nome !== nomeLimpo,
      descricao_alterada: atendimento.descricao !== descricaoLimpa,
      setor_anterior_id: atendimento.setor_id,
      setor_novo_id: setor.id,
      origem_acao: "painel",
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return atendimentoRepository.buscarPorId(atendimentoId);
}

async function assumirAtendimento({
  atendimentoId,
  analistaId,
  setorId,
  usuarioSistemaId
}) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  const resultado = await atendimentoRepository.assumir({
    atendimentoId,
    analistaId,
    setorId
  });

  if (!resultado) {
    throw new Error("ATENDIMENTO_NAO_DISPONIVEL");
  }

  const analista = await usuarioSistemaRepository.buscarPorId(analistaId);

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "assumir",
    valorAnterior: {
      analista_id: atendimento.analista_id || null,
      status: atendimento.status
    },
    valorNovo: {
      analista_id: resultado.analista_id,
      status: resultado.status,
      analista_nome: analista?.nome || null
    },
    observacao: "Atendimento assumido pelo analista."
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_assumido",
    mensagem: "Analista assumiu o atendimento.",
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_id: analistaId,
      setor_id: setorId,
      acao: "assumir_atendimento",
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return resultado;
}

async function devolverParaFila({
  atendimentoId,
  usuarioSistemaId,
  perfil,
  setorId,
  analistaId
}) {
  const atendimento =
    await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  if (atendimento.status === "realizado") {
    throw new Error("ATENDIMENTO_FINALIZADO");
  }

  if (
    perfil !== "supervisor" &&
    (
      Number(atendimento.analista_id) !== Number(analistaId) ||
      Number(atendimento.setor_id) !== Number(setorId)
    )
  ) {
    throw new Error("SEM_PERMISSAO");
  }

  if (!atendimento.analista_id) {
    throw new Error("ATENDIMENTO_SEM_ANALISTA");
  }

  const resultado =
    await atendimentoRepository.devolverParaFila(atendimentoId);

  if (!resultado) {
    throw new Error("ATENDIMENTO_NAO_DISPONIVEL");
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "desatribuicao",
    valorAnterior: {
      analista_id: atendimento.analista_id,
      analista_nome: atendimento.analista_nome || null,
      status: atendimento.status
    },
    valorNovo: {
      analista_id: null,
      status: "aguardando"
    },
    observacao:
      `Chamado devolvido para a fila por ${perfil === "supervisor" ? "supervisor" : "analista"}.`
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_devolvido_fila",
    mensagem: "Atendimento devolvido para a fila do setor.",
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      analista_anterior_id: atendimento.analista_id,
      status_anterior: atendimento.status,
      status_novo: resultado.status || "aguardando",
      perfil_responsavel: perfil,
      setor_id: atendimento.setor_id,
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return resultado;
}

async function alterarSetorAtendimento({
  atendimentoId,
  setorId,
  usuarioSistemaId
}) {
  const atendimento = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!atendimento) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (atendimento.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  if (atendimento.status === "realizado") {
    throw new Error("ATENDIMENTO_FINALIZADO");
  }

  const setor = await setorRepository.buscarPorId(setorId);

  if (!setor || setor.ativo === false) {
    throw new Error("SETOR_NAO_ENCONTRADO");
  }

  if (Number(atendimento.setor_id) === Number(setorId)) {
    throw new Error("SETOR_IGUAL");
  }

  const resultado = await atendimentoRepository.alterarSetor({
    atendimentoId,
    setorId
  });

  if (!resultado) {
    throw new Error("ATENDIMENTO_NAO_DISPONIVEL");
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId,
    usuarioSistemaId,
    acao: "alteracao_setor",
    valorAnterior: {
      setor_id: atendimento.setor_id,
      setor_nome: atendimento.setor_nome,
      analista_id: atendimento.analista_id || null,
      status: atendimento.status
    },
    valorNovo: {
      setor_id: resultado.setor_id,
      setor_nome: setor.nome,
      analista_id: null,
      status: "aguardando"
    },
    observacao: "Setor alterado pelo supervisor; atendimento devolvido à fila do novo setor."
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_transferido_setor",
    mensagem: "Atendimento transferido para outro setor.",
    atendimento_id: atendimentoId,
    usuario_sistema_id: usuarioSistemaId,
    contexto: {
      setor_anterior_id: atendimento.setor_id,
      setor_novo_id: resultado.setor_id,
      analista_anterior_id: atendimento.analista_id || null,
      status_anterior: atendimento.status,
      status_novo: resultado.status || "aguardando",
      usuario_cliente_id: atendimento.usuario_id
    }
  });

  return {
    atendimento: resultado,
    setorAnteriorId: Number(atendimento.setor_id)
  };
}

async function replicarAtendimento({
  atendimentoId,
  nome,
  setorId,
  descricao,
  analistaDestinoId = null,
  usuarioSistemaId,
  perfil,
  setorUsuarioId
}) {
  const origem = await atendimentoRepository.buscarPorId(atendimentoId);

  if (!origem) {
    throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  }

  if (origem.arquivado) {
    throw new Error("ATENDIMENTO_ARQUIVADO");
  }

  // Analista pode replicar somente um atendimento atribuído ao próprio usuário.
  // A autorização não depende do setor atual do analista: a responsabilidade
  // pelo chamado é determinada pelo campo analista_id.
  if (
    perfil !== "supervisor" &&
    Number(origem.analista_id) !== Number(usuarioSistemaId)
  ) {
    throw new Error("SEM_PERMISSAO");
  }

  const nomeLimpo = String(nome || "").trim();

  if (nomeLimpo.length < 2 || nomeLimpo.length > 150) {
    throw new Error("NOME_INVALIDO");
  }

  const setor = await setorRepository.buscarPorId(Number(setorId));

  if (!setor || setor.ativo === false) {
    throw new Error("SETOR_NAO_ENCONTRADO");
  }

  if (perfil !== "supervisor" && Number(setor.id) !== Number(setorUsuarioId)) {
    // Analistas podem direcionar a réplica a outro setor,
    // mas não atribuí-la a um analista.
  }

  const novo = await abrirAtendimento({
    nome: origem.usuario_nome,
    telefone: origem.usuario_telefone,
    whatsappId: origem.usuario_telefone,
    setorId: Number(setorId),
    empresaId: Number(origem.empresa_id),
    descricao: String(descricao || "").trim() || origem.descricao,
    remetenteTipo: perfil,
    remetenteId: Number(usuarioSistemaId),
    direcao: "interna",
    atendimentoOrigemId: Number(origem.id),
    usuarioSistemaId: Number(usuarioSistemaId),
    origemAcao: "replicacao"
  });

  let atendimento = await atendimentoRepository.buscarPorId(novo.atendimento.id);

  if (perfil === "supervisor" && analistaDestinoId) {
    atendimento = await atribuirParaAnalista({
      atendimentoId: Number(novo.atendimento.id),
      analistaId: Number(analistaDestinoId),
      usuarioSistemaId: Number(usuarioSistemaId)
    });
  }

  await historicoAtendimentoRepository.registrar({
    atendimentoId: Number(novo.atendimento.id),
    usuarioSistemaId: Number(usuarioSistemaId),
    acao: "replicar_atendimento",
    valorAnterior: {
      atendimento_origem_id: Number(origem.id)
    },
    valorNovo: {
      atendimento_id: Number(novo.atendimento.id),
      nome: nomeLimpo,
      setor_id: Number(setorId),
      analista_id: atendimento?.analista_id || null
    },
    observacao: `Atendimento replicado a partir do chamado #${origem.id}.`
  });

  await logService.info({
    origem: "atendimentoService",
    evento: "atendimento_replicado",
    mensagem: "Atendimento replicado para um novo chamado.",
    atendimento_id: Number(novo.atendimento.id),
    usuario_sistema_id: Number(usuarioSistemaId),
    contexto: {
      atendimento_origem_id: Number(origem.id),
      atendimento_novo_id: Number(novo.atendimento.id),
      setor_destino_id: Number(setorId),
      analista_destino_id: atendimento?.analista_id || null,
      origem_acao: "painel",
      usuario_cliente_id: novo.usuario.id
    }
  });

  return {
    atendimento,
    atendimentoOrigemId: Number(origem.id)
  };
}

async function obterHistoricoCompleto() {
  return historicoAtendimentoRepository.listarTodos();
}

module.exports = {
  abrirAtendimento,
  obterFila,
  obterTodosParaSupervisor,
  obterAtendimentosHistorico,
  obterConversa,
  atribuirParaAnalista,
  alterarStatus,
  editarAtendimento,
  assumirAtendimento,
  devolverParaFila,
  alterarSetorAtendimento,
  replicarAtendimento,
  obterHistoricoCompleto
};
