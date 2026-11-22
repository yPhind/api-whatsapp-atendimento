const sessaoRepository = require("../repositories/sessaoWhatsappRepository");
const setorRepository = require("../repositories/setorRepository");
const atendimentoService = require("./atendimentoService");
const atendimentoRepository = require("../repositories/atendimentoRepository");
const mensagemRepository = require("../repositories/mensagemRepository");
const empresaService = require("./empresaService");
const whatsapp = require("./whatsappCloudService");
const logService = require("./logService");
const webhookEventoRepository = require("../repositories/webhookEventoRepository");

const TEXTO_CNPJ =
  "Olá! Para iniciar seu atendimento, informe o CNPJ da empresa que deseja atender.";

const TEXTO_DESCRICAO =
  "Agora, descreva sua solicitação ou observação com o máximo de detalhes possível. Essas informações serão registradas no chamado e ajudarão nosso analista a entender como podemos ajudar.";

const ROTULOS_SUPORTE = {
  1: "Notas fiscais, cadastros, pedidos e módulos",
  2: "Instalação, sistema com erro, certificado e configurações de sistema",
  3: "Treinamento de sistema, acompanhamentos e análise de solicitações",
  4: "2ª via de boleto / pagamento PIX"
};

const TEXTO_EMPRESA_NAO_ENCONTRADA =
  "Não localizamos esse CNPJ em nossa base. Por favor, entre em contato com o setor comercial pelo WhatsApp (DDD) 99999-9999.";

const TEXTO_EMPRESA_INATIVA =
  "A empresa informada está com cadastro inativo. Por favor, entre em contato com o setor comercial pelo WhatsApp (DDD) 99999-9999.";

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarCnpj(cnpj) {
  return String(cnpj || "").replace(/\D/g, "");
}

function extrairResposta(message) {
  if (message.type === "text") {
    return {
      tipo: "texto",
      texto: message.text?.body || ""
    };
  }

  if (message.type === "interactive") {
    const interactive = message.interactive || {};

    if (interactive.type === "list_reply") {
      return {
        tipo: "setor",
        id: interactive.list_reply?.id || ""
      };
    }

    if (interactive.type === "button_reply") {
      return {
        tipo: "setor",
        id: interactive.button_reply?.id || ""
      };
    }
  }

  return {
    tipo: "nao_suportado"
  };
}

function extrairNome(value, message) {
  const contato = value.contacts?.find(
    item => item.wa_id === message.from
  );

  return contato?.profile?.name || "Cliente WhatsApp";
}

async function registrarEvento({
  nivel = "info",
  evento,
  mensagem,
  atendimentoId = null,
  correlacaoId = null,
  contexto = {}
}) {
  const dados = {
    origem: "whatsappWebhookService",
    evento,
    mensagem,
    atendimento_id: atendimentoId,
    correlacao_id: correlacaoId,
    contexto
  };

  if (typeof logService[nivel] === "function") {
    await logService[nivel](dados);
  }
}

async function obterSetorPorId(id) {
  const numero = Number(String(id).replace("setor_", ""));

  if (!Number.isInteger(numero) || numero < 1) {
    return null;
  }

  return setorRepository.buscarPorId(numero);
}

function notificarNovaMensagem(io, atendimento) {
  if (!io || !atendimento) return;

  const evento = {
    tipo: "nova_mensagem",
    atendimentoId: Number(atendimento.id),
    setorId: Number(atendimento.setor_id),
    analistaId: atendimento.analista_id
      ? Number(atendimento.analista_id)
      : null,
    em: new Date().toISOString()
  };

  io.to("supervisores").emit("atendimentos:atualizar", evento);

  if (evento.setorId) {
    io.to(`setor:${evento.setorId}`).emit(
      "atendimentos:atualizar",
      evento
    );
  }

  if (evento.analistaId) {
    io.to(`usuario:${evento.analistaId}`).emit(
      "atendimentos:atualizar",
      evento
    );
  }
}

async function atualizarSessao(
  telefone,
  estado,
  setorId,
  empresaId,
  messageId
) {
  return sessaoRepository.atualizarEstado(
    telefone,
    estado,
    setorId,
    empresaId,
    messageId
  );
}

async function processarMensagem(value, message, io = null) {
  const telefone = message.from;
  const whatsappId = message.from;
  const nomeCliente = extrairNome(value, message);
  const resposta = extrairResposta(message);
  const texto = resposta.texto?.trim() || "";
  const textoNormalizado = normalizarTexto(texto);

  if (!telefone || !message.id) {
    return;
  }

  let sessao = await sessaoRepository.buscarPorTelefone(telefone);

  /*
   * COMANDO PARA REINICIAR O FLUXO
   */
  if (
    resposta.tipo === "texto" &&
    ["menu", "inicio", "comecar"].includes(textoNormalizado)
  ) {
    await sessaoRepository.salvar({
      telefone,
      whatsappId,
      nomeCliente,
      estado: "aguardando_cnpj",
      setorId: null,
      empresaId: null,
      ultimaMensagemId: message.id
    });

    await registrarEvento({
      evento: "whatsapp_fluxo_reiniciado",
      mensagem: "Cliente reiniciou o fluxo de atendimento.",
      correlacaoId: message.id,
      contexto: {
        origem: "meta_api",
        comando: "menu"
      }
    });

    await whatsapp.enviarTexto(telefone, TEXTO_CNPJ);
    return;
  }

  /*
   * CLIENTE COM ATENDIMENTO JÁ ABERTO
   */
  if (!sessao) {
    const atendimentoAberto =
      await atendimentoRepository.buscarAbertoPorTelefone(telefone);

    if (atendimentoAberto) {
      const conteudo = resposta.tipo === "texto"
        ? texto
        : resposta.tipo === "setor"
          ? `Opção selecionada: ${resposta.id}`
          : "[Tipo de mensagem não suportado]";

      const mensagemSalva = await mensagemRepository.criar({
        atendimentoId: atendimentoAberto.id,
        remetenteTipo: "usuario",
        direcao: "entrada",
        tipo: resposta.tipo === "nao_suportado"
          ? "outro"
          : resposta.tipo === "setor"
            ? "interativo"
            : "texto",
        conteudo,
        identificadorExterno: message.id,
        dadosExtras: {
          whatsapp: true,
          tipoOriginal: message.type,
          origem: "meta_api"
        }
      });

      /*
       * O repositório retorna null quando o identificador externo
       * já existe. Nesse caso, não registra novamente nem notifica.
       */
      if (!mensagemSalva) {
        return;
      }

      await registrarEvento({
        evento: "whatsapp_mensagem_recebida",
        mensagem: "Nova mensagem recebida em atendimento existente.",
        atendimentoId: atendimentoAberto.id,
        correlacaoId: message.id,
        contexto: {
          origem: "meta_api",
          tipo: message.type || "desconhecido",
          mensagem_id: mensagemSalva.id || null
        }
      });

      notificarNovaMensagem(io, atendimentoAberto);
      return;
    }
  }

  /*
   * PRIMEIRO CONTATO
   */
  if (!sessao) {
    await sessaoRepository.salvar({
      telefone,
      whatsappId,
      nomeCliente,
      estado: "aguardando_cnpj",
      setorId: null,
      empresaId: null,
      ultimaMensagemId: message.id
    });

    await registrarEvento({
      evento: "whatsapp_fluxo_iniciado",
      mensagem: "Novo fluxo de atendimento iniciado.",
      correlacaoId: message.id,
      contexto: {
        origem: "meta_api",
        etapa: "aguardando_cnpj"
      }
    });

    await whatsapp.enviarTexto(telefone, TEXTO_CNPJ);
    return;
  }

  /*
   * ETAPA 1 — IDENTIFICAÇÃO DA EMPRESA
   */
  if (sessao.estado === "aguardando_cnpj") {
    if (resposta.tipo !== "texto" || !texto) {
      await atualizarSessao(
        telefone,
        "aguardando_cnpj",
        null,
        null,
        message.id
      );

      await whatsapp.enviarTexto(
        telefone,
        "Por favor, envie o CNPJ com pontuações, conforme exemplo: 00.000.000/0000-00, em uma única mensagem de texto."
      );

      return;
    }

    const cnpj = normalizarCnpj(texto);

    if (cnpj.length !== 14) {
      await atualizarSessao(
        telefone,
        "aguardando_cnpj",
        null,
        null,
        message.id
      );

      await registrarEvento({
        nivel: "warn",
        evento: "whatsapp_cnpj_formato_invalido",
        mensagem: "Cliente enviou CNPJ em formato inválido.",
        correlacaoId: message.id,
        contexto: {
          origem: "meta_api"
        }
      });

      await whatsapp.enviarTexto(
        telefone,
        "O CNPJ informado não possui um formato válido. Envie o CNPJ com pontuações, exemplo: 00.000.000/0000-00."
      );

      return;
    }

    let empresa;

    try {
      empresa = await empresaService.identificarPorCnpj(cnpj);
    } catch (erro) {
      if (erro.message === "CNPJ_INVALIDO") {
        await atualizarSessao(
          telefone,
          "aguardando_cnpj",
          null,
          null,
          message.id
        );

        await whatsapp.enviarTexto(
          telefone,
          "O CNPJ informado não possui um formato válido. Envie o CNPJ com pontuações, exemplo: 00.000.000/0000-00."
        );

        return;
      }

      if (erro.message === "EMPRESA_NAO_ENCONTRADA") {
        await atualizarSessao(
          telefone,
          "aguardando_cnpj",
          null,
          null,
          message.id
        );

        await registrarEvento({
          nivel: "warn",
          evento: "whatsapp_empresa_nao_encontrada",
          mensagem: "CNPJ informado não foi localizado na base de clientes.",
          correlacaoId: message.id,
          contexto: {
            origem: "meta_api"
          }
        });

        await whatsapp.enviarTexto(
          telefone,
          TEXTO_EMPRESA_NAO_ENCONTRADA
        );

        return;
      }

      throw erro;
    }

    if (empresa.status !== "Ativa") {
      await atualizarSessao(
        telefone,
        "aguardando_cnpj",
        null,
        null,
        message.id
      );

      await registrarEvento({
        nivel: "warn",
        evento: "whatsapp_empresa_inativa",
        mensagem: "Tentativa de atendimento por empresa inativa.",
        correlacaoId: message.id,
        contexto: {
          origem: "meta_api",
          empresa_id: Number(empresa.id)
        }
      });

      await whatsapp.enviarTexto(
        telefone,
        TEXTO_EMPRESA_INATIVA
      );

      return;
    }

    await atualizarSessao(
      telefone,
      "aguardando_setor",
      null,
      empresa.id,
      message.id
    );

    await registrarEvento({
      evento: "whatsapp_empresa_identificada",
      mensagem: "Empresa identificada no fluxo do WhatsApp.",
      correlacaoId: message.id,
      contexto: {
        origem: "meta_api",
        empresa_id: Number(empresa.id),
        proxima_etapa: "aguardando_setor"
      }
    });

    await whatsapp.enviarTexto(
      telefone,
      `CNPJ identificado com sucesso!\nEmpresa: ${empresa.nome_fantasia || empresa.razao_social}.\n\nAgora, escolha o tipo de suporte desejado no menu abaixo.`
    );

    await whatsapp.enviarMenuSetores(telefone);
    return;
  }

  /*
   * ETAPA 2 — SELEÇÃO DO SETOR
   */
  if (sessao.estado === "aguardando_setor") {
    if (!sessao.empresa_id) {
      await atualizarSessao(
        telefone,
        "aguardando_cnpj",
        null,
        null,
        message.id
      );

      await whatsapp.enviarTexto(telefone, TEXTO_CNPJ);
      return;
    }

    if (resposta.tipo !== "setor") {
      await atualizarSessao(
        telefone,
        "aguardando_setor",
        null,
        sessao.empresa_id,
        message.id
      );

      await whatsapp.enviarTexto(
        telefone,
        "Por favor, selecione uma das opções de suporte disponíveis no menu."
      );

      await whatsapp.enviarMenuSetores(telefone);
      return;
    }

    const setor = await obterSetorPorId(resposta.id);

    if (!setor || setor.ativo === false) {
      await atualizarSessao(
        telefone,
        "aguardando_setor",
        null,
        sessao.empresa_id,
        message.id
      );

      await whatsapp.enviarTexto(
        telefone,
        "Não foi possível identificar esse setor. Selecione uma opção do menu."
      );

      await whatsapp.enviarMenuSetores(telefone);
      return;
    }

    await atualizarSessao(
      telefone,
      "aguardando_descricao",
      setor.id,
      sessao.empresa_id,
      message.id
    );

    await registrarEvento({
      evento: "whatsapp_setor_selecionado",
      mensagem: "Cliente selecionou o setor de atendimento.",
      correlacaoId: message.id,
      contexto: {
        origem: "meta_api",
        setor_id: Number(setor.id),
        empresa_id: Number(sessao.empresa_id)
      }
    });

    await whatsapp.enviarTexto(
      telefone,
      TEXTO_DESCRICAO
    );

    return;
  }

  /*
   * ETAPA 3 — DESCRIÇÃO E CRIAÇÃO DO ATENDIMENTO
   */
  if (sessao.estado === "aguardando_descricao") {
    if (resposta.tipo !== "texto" || !texto) {
      await atualizarSessao(
        telefone,
        "aguardando_descricao",
        sessao.setor_id,
        sessao.empresa_id,
        message.id
      );

      await whatsapp.enviarTexto(
        telefone,
        "Por favor, envie sua solicitação em uma mensagem de texto."
      );

      return;
    }

    if (!sessao.empresa_id || !sessao.setor_id) {
      await atualizarSessao(
        telefone,
        "aguardando_cnpj",
        null,
        null,
        message.id
      );

      await whatsapp.enviarTexto(telefone, TEXTO_CNPJ);
      return;
    }

    const setor = await setorRepository.buscarPorId(
      sessao.setor_id
    );

    if (!setor || setor.ativo === false) {
      await atualizarSessao(
        telefone,
        "aguardando_setor",
        null,
        sessao.empresa_id,
        message.id
      );

      await whatsapp.enviarTexto(
        telefone,
        "Esse setor não está disponível no momento. Selecione outro setor."
      );

      await whatsapp.enviarMenuSetores(telefone);
      return;
    }

    const resultado = await atendimentoService.abrirAtendimento({
      telefone,
      whatsappId,
      nome: nomeCliente,
      setorId: setor.id,
      empresaId: sessao.empresa_id,
      descricao: texto,
      whatsappMessageId: message.id
    });

    await registrarEvento({
      evento: "whatsapp_atendimento_criado",
      mensagem: "Atendimento criado pelo fluxo automático do WhatsApp.",
      atendimentoId: resultado.atendimento.id,
      correlacaoId: message.id,
      contexto: {
        origem: "meta_api",
        setor_id: Number(setor.id),
        empresa_id: Number(sessao.empresa_id),
        protocolo: resultado.atendimento.protocolo
      }
    });

    await sessaoRepository.remover(telefone);

    await whatsapp.enviarTexto(
      telefone,
      `Sua solicitação foi registrada!\n` +
      `Protocolo: ${resultado.atendimento.protocolo}\n` +
      `Tipo de suporte: ${ROTULOS_SUPORTE[Number(setor.id)] || setor.nome}\n\n` +
      "Um de nossos analistas dará continuidade ao atendimento por aqui."
    );

    return;
  }

  /*
   * Estado desconhecido ou sessão inconsistente.
   */
  await registrarEvento({
    nivel: "warn",
    evento: "whatsapp_estado_sessao_desconhecido",
    mensagem: "Sessão do WhatsApp possui estado não reconhecido.",
    correlacaoId: message.id,
    contexto: {
      estado: sessao.estado || null
    }
  });

  await atualizarSessao(
    telefone,
    "aguardando_cnpj",
    null,
    null,
    message.id
  );

  await whatsapp.enviarTexto(telefone, TEXTO_CNPJ);
}

async function processarWebhook(payload, io = null) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      // ==========================================
      // MENSAGENS RECEBIDAS
      // ==========================================

      for (const message of value.messages || []) {
        if (!message.id) {
          continue;
        }

        const chaveEvento = `mensagem:${message.id}`;

        const eventoRegistrado =
          await webhookEventoRepository.iniciar({
            chaveEvento,
            identificadorExterno: message.id,
            tipoEvento: "mensagem"
          });

        // Evento já registrado: não processa novamente.
        if (!eventoRegistrado) {
          continue;
        }

        try {
          await processarMensagem(value, message, io);

          await webhookEventoRepository.concluir(chaveEvento);

        } catch (erro) {
          await webhookEventoRepository.marcarFalha(
            chaveEvento,
            erro
          );

          throw erro;
        }
      }

      // ==========================================
      // STATUS DAS MENSAGENS
      // ==========================================

      for (const status of value.statuses || []) {
        if (!status.id) {
          continue;
        }

        const statusMeta = String(
          status.status || "desconhecido"
        ).toLowerCase();

        const chaveEvento =
          `status:${status.id}:${statusMeta}`;

        const eventoRegistrado =
          await webhookEventoRepository.iniciar({
            chaveEvento,
            identificadorExterno: status.id,
            tipoEvento: "status"
          });

        if (!eventoRegistrado) {
          continue;
        }

        try {
          const mensagemAtualizada =
            await mensagemRepository.atualizarStatusPorIdentificador(
              status.id,
              statusMeta
            );

          if (mensagemAtualizada) {
            await registrarEvento({
              evento: "whatsapp_status_atualizado",
              mensagem: "Status de mensagem atualizado pela Meta.",
              atendimentoId: mensagemAtualizada.atendimento_id,
              correlacaoId: status.id,
              contexto: {
                origem: "meta_api",
                status: mensagemAtualizada.status_envio
              }
            });
          } else {
            await registrarEvento({
              nivel: "warn",
              evento: "whatsapp_status_mensagem_nao_encontrada",
              mensagem: "Status recebido sem mensagem correspondente no banco.",
              correlacaoId: status.id,
              contexto: {
                origem: "meta_api",
                status: statusMeta
              }
            });
          }

          await webhookEventoRepository.concluir(chaveEvento);

        } catch (erro) {
          await webhookEventoRepository.marcarFalha(
            chaveEvento,
            erro
          );

          throw erro;
        }
      }
    }
  }
}

module.exports = {
  processarWebhook
};