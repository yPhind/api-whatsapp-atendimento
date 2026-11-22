// PADRÃO GLOBAL DE MODAIS: clicar no fundo/fora do conteúdo não fecha janelas.
// O fechamento deve ocorrer somente por botão explícito (X, Cancelar ou ação equivalente).
document.addEventListener("click", (event) => {
  const overlay = event.target?.closest?.(".modal-overlay");
  if (overlay && event.target === overlay) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

const inicioSection = document.getElementById("inicio-section");
const usuariosSection = document.getElementById("usuarios-section");
const ticketsSection = document.getElementById("tickets-section");
const formAnalista = document.getElementById("form-analista");
const selectSetor = document.getElementById("analista-setor");
const mensagemAnalista = document.getElementById("analista-mensagem");
const modalCadastroAnalista = document.getElementById("modal-cadastro-analista");
const abrirCadastroAnalistaBotao = document.getElementById("abrir-cadastro-analista");
const fecharCadastroAnalistaBotao = document.getElementById("fechar-modal-cadastro-analista");
const cancelarCadastroAnalistaBotao = document.getElementById("cancelar-cadastro-analista");
const title = document.getElementById("view-title");
const sectionTitle = document.getElementById("section-title");
const ticketList = document.getElementById("ticket-list");
const analistasLista = document.getElementById("analistas-lista");
const atualizarAnalistasBotao = document.getElementById("atualizar-analistas");
const chatSection = document.getElementById("chat-section");
const chatCliente = document.getElementById("chat-cliente");
const chatEmpresa = document.getElementById("chat-empresa");
const chatProtocolo = document.getElementById("chat-protocolo");
const chatStatus = document.getElementById("chat-status");
const chatMensagens = document.getElementById("chat-mensagens");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatEnviar = document.getElementById("chat-enviar");
const chatMensagemStatus = document.getElementById("chat-mensagem-status");
const historicoSection = document.getElementById("historico-section");
const historicoLista = document.getElementById("historico-lista");
const modalHistorico = document.getElementById("modal-historico-conversa");
const modalHistoricoTitulo = document.getElementById("modal-historico-titulo");
const modalHistoricoMensagens = document.getElementById("modal-historico-mensagens");
const fecharModalHistorico = document.getElementById("fechar-modal-historico");
const logsSection = document.getElementById("logs-section");
const tarefasSection = document.getElementById("tarefas-section");
const logsLista = document.getElementById("logs-lista");

let visualizacao = "inicio";
let modoVisualizacaoTarefas = "quadros";
let chamados = [];
let usuarioAtual = null;
let atendimentoSelecionado = null;
let mensagensAtendimento = [];
let analistasDisponiveis = [];
let setoresDisponiveis = [];
let listaAnalistasCompleta = [];
let paginaAnalistas = 1;
let itensPorPaginaAnalistas = 10;
const filtroAnalistas = document.getElementById("filtro-analistas");
const filtroSituacaoAnalistas = document.getElementById("filtro-situacao-analistas");
const filtroSetorAnalistas = document.getElementById("filtro-setor-analistas");
const analistasResumo = document.getElementById("analistas-resumo");
const quantidadeAnalistasSelect = document.getElementById("quantidade-analistas");



function criarElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;
  if (classe) elemento.className = classe;
  return elemento;
}

function normalizarStatus(status) {
  const valor = String(status || "").trim().toLowerCase().replaceAll(" ", "_");
  const aliases = { "em_atendimento": "em_atendimento", "em-atendimento": "em_atendimento" };
  return aliases[valor] || valor;
}

function rotuloStatus(status) {
  const rotulos = { aguardando: "Aguardando", em_atendimento: "Em atendimento", pendente: "Pendente", realizado: "Realizado" };
  const normalizado = normalizarStatus(status);
  return rotulos[normalizado] || (normalizado ? normalizado.charAt(0).toUpperCase() + normalizado.slice(1).replaceAll("_", " ") : "Indefinido");
}

function criarBolhaStatus(status, contexto = "ticket") {
  const normalizado = normalizarStatus(status);
  return criarElemento("span", rotuloStatus(normalizado), `${contexto}-status-badge status-${normalizado || "indefinido"}`);
}

function abrirModalCadastroAnalista() {
  formAnalista.reset();
  mensagemAnalista.textContent = "";
  mensagemAnalista.className = "";

  modalCadastroAnalista.hidden = false;

  setTimeout(() => {
    document.getElementById("analista-nome").focus();
  }, 100);
}

function fecharModalCadastroAnalista() {
  formAnalista.reset();
  mensagemAnalista.textContent = "";
  mensagemAnalista.className = "";

  modalCadastroAnalista.hidden = true;
}

async function carregarPerfil() {
  const usuario = await API.get("/api/auth/perfil");

  usuarioAtual = usuario;

  const ehSupervisor = usuario.perfil === "supervisor";

  const nomeExibido = usuario.nome || usuario.username || "Usuário";
  const perfilExibido = ehSupervisor ? "Supervisor" : "Analista";

  const elementoNome = document.getElementById("usuario-nome");

  if (!elementoNome) {
    throw new Error('Elemento "usuario-nome" não encontrado no HTML.');
  }

  elementoNome.textContent = `${nomeExibido} · ${perfilExibido}`;

  const menus = {
    "nav-usuarios": !ehSupervisor,
    "nav-historico": !ehSupervisor,
    "nav-logs": !ehSupervisor
  };

  for (const [id, ocultar] of Object.entries(menus)) {
    const elemento = document.getElementById(id);

    if (!elemento) {
      console.warn(`Menu "${id}" não encontrado no HTML.`);
      continue;
    }

    elemento.hidden = ocultar;
  }
}

async function carregarIndicadores() {
  const descricao = document.getElementById("inicio-descricao");
  const areaBarras = document.getElementById("grafico-atendimentos-setor");
  const areaPizza = document.getElementById("grafico-distribuicao-status");
  const areaMensal = document.getElementById("graficos-mensais-setor");

  [areaBarras, areaPizza, areaMensal].forEach((area) => {
    if (area) area.replaceChildren(criarElemento("p", "Carregando indicadores...", "inicio-carregando"));
  });

  try {
    const indicadores = await API.get("/api/dashboard/indicadores");
    if (!window.DashboardCharts || typeof window.DashboardCharts.renderizar !== "function") {
      throw new Error("Não foi possível carregar o módulo de gráficos.");
    }

    window.DashboardCharts.renderizar(indicadores);
    if (descricao) {
      const atualizado = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      descricao.textContent = `Indicadores do seu acesso · Atualizado às ${atualizado}`;
    }
  } catch (erro) {
    [areaBarras, areaPizza, areaMensal].forEach((area) => {
      if (area) area.replaceChildren(criarElemento("p", erro.message || "Não foi possível carregar os indicadores.", "error-message"));
    });
  }
}

async function carregarAnalistasDisponiveis() {
  const resultado = await API.get("/api/analistas");

  const analistas = resultado.analistas || [];

  analistasDisponiveis = analistas.filter(
    (analista) => analista.ativo === true
  );
}

async function carregarChamados() {
  if (visualizacao !== "meus") chatSection.hidden = true;
  ticketList.replaceChildren(
    criarElemento("p", "Carregando chamados...")
  );

  try {

    let endpoint;

    if (usuarioAtual?.perfil === "supervisor") {
      endpoint = visualizacao === "fila"
        ? "/api/atendimentos/fila"
        : "/api/atendimentos/supervisor";

      if (analistasDisponiveis.length === 0) await carregarAnalistasDisponiveis();
      if (setoresDisponiveis.length === 0) await carregarSetores();
    } else {
      endpoint = visualizacao === "fila"
        ? "/api/atendimentos/fila"
        : "/api/atendimentos/meus";
    }

    const resultado = await API.get(endpoint);

    chamados = Array.isArray(resultado)
      ? resultado
      : resultado.atendimentos || [];

    // "Meus atendimentos" só deve conter chamados atribuídos a um analista.
    // Chamados sem responsável permanecem exclusivamente na fila do setor,
    // inclusive na visão do supervisor.
    if (visualizacao === "meus") {
      chamados = chamados.filter((chamado) =>
        chamado.analista_id !== null &&
        chamado.analista_id !== undefined &&
        String(chamado.analista_id).trim() !== ""
      );
    }

    // Chamados realizados não pertencem às listas operacionais.
    if (["fila", "meus"].includes(visualizacao)) {
      chamados = chamados.filter((chamado) =>
        normalizarStatus(chamado.status) !== "realizado" &&
        chamado.arquivado !== true
      );
    }

    const metricAguardando = document.getElementById("metric-aguardando");
    const metricMeus = document.getElementById("metric-meus");
    const totalAguardando = document.getElementById("total-aguardando");
    const aguardandoPorSetor = document.getElementById("aguardando-por-setor");

    metricAguardando.hidden = visualizacao !== "fila";
    metricMeus.hidden = visualizacao !== "meus";
    totalAguardando.textContent = chamados.filter((c) => normalizarStatus(c.status) === "aguardando").length;
    const totalMeus = document.getElementById("total-meus");
    if (totalMeus) {
      totalMeus.textContent = visualizacao === "meus" ? String(chamados.length) : "0";
    }
    aguardandoPorSetor.replaceChildren();
    aguardandoPorSetor.hidden = !(usuarioAtual?.perfil === "supervisor" && visualizacao === "fila");

    if (usuarioAtual?.perfil === "supervisor" && visualizacao === "fila") {
      const contagens = new Map();
      chamados.forEach((chamado) => {
        const chave = String(chamado.setor_id ?? "sem-setor");
        contagens.set(chave, (contagens.get(chave) || 0) + 1);
      });
      setoresDisponiveis.forEach((setor) => {
        const chip = criarElemento("span", `${setor.nome}: ${contagens.get(String(setor.id)) || 0}`, "fila-contagem-setor");
        aguardandoPorSetor.append(chip);
      });
    }

    const layoutAtendimentos = document.querySelector(".atendimento-layout");
    layoutAtendimentos?.classList.toggle("fila-ampla", visualizacao === "fila");

    renderizarChamados();

    // O chat de qualquer perfil só fica disponível em "Meus atendimentos".
    // Na Fila, não deve aparecer nem para analistas nem para supervisores.
    if (visualizacao !== "meus") {
      chatSection.hidden = true;
      atendimentoSelecionado = null;
      mensagensAtendimento = [];
    }

  } catch (erro) {
    ticketList.replaceChildren(
      criarElemento("p", erro.message, "error-message")
    );
  }
}

async function carregarConversa(atendimentoId) {
  chatSection.hidden = false;

  chatMensagens.replaceChildren(
    criarElemento("p", "Carregando conversa...", "chat-vazio")
  );

  chatMensagemStatus.textContent = "";

  try {
    const resultado = await API.get(
      `/api/atendimentos/${encodeURIComponent(atendimentoId)}`
    );

    atendimentoSelecionado = resultado.atendimento;
    mensagensAtendimento = Array.isArray(resultado.mensagens)
      ? resultado.mensagens
      : [];

    renderizarCabecalhoChat();
    renderizarMensagens();

    chatInput.focus();
  } catch (erro) {
    atendimentoSelecionado = null;
    mensagensAtendimento = [];

    chatMensagens.replaceChildren(
      criarElemento("p", erro.message, "error-message")
    );
  }
}

function renderizarCabecalhoChat() {
  if (!atendimentoSelecionado) return;

  chatCliente.textContent =
    atendimentoSelecionado.usuario_nome || "Cliente";

  chatEmpresa.textContent =
    atendimentoSelecionado.empresa_nome || "Empresa não informada";

  chatProtocolo.textContent =
    `Protocolo: ${atendimentoSelecionado.protocolo || "Não informado"}`;

  chatStatus.textContent = rotuloStatus(atendimentoSelecionado.status);
  chatStatus.className = `chat-status status-${normalizarStatus(atendimentoSelecionado.status) || "indefinido"}`;
}

function renderizarMensagens() {
  chatMensagens.replaceChildren();

  if (mensagensAtendimento.length === 0) {
    chatMensagens.append(
      criarElemento(
        "p",
        "Nenhuma mensagem encontrada.",
        "chat-vazio"
      )
    );

    return;
  }

  mensagensAtendimento.forEach((mensagem) => {
    const bloco = criarElemento(
      "div",
      "",
      `chat-mensagem ${obterClasseMensagem(mensagem)}`
    );

    const remetente = criarElemento(
      "span",
      obterNomeRemetente(mensagem),
      "chat-remetente"
    );

    const conteudo = criarElemento(
      "p",
      mensagem.conteudo || "[Mensagem sem conteúdo]",
      "chat-conteudo"
    );

    const horario = criarElemento(
      "span",
      formatarHorario(mensagem.criado_em),
      "chat-horario"
    );

    bloco.append(remetente, conteudo, horario);
    chatMensagens.append(bloco);
  });

  chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

function obterClasseMensagem(mensagem) {
  if (mensagem.remetente_tipo === "usuario") {
    return "mensagem-cliente";
  }

  if (
    mensagem.remetente_tipo === "analista" ||
    mensagem.remetente_tipo === "supervisor"
  ) {
    return "mensagem-atendente";
  }

  return "mensagem-sistema";
}

function obterNomeRemetente(mensagem) {
  if (mensagem.remetente_tipo === "usuario") {
    return "Cliente";
  }

  if (mensagem.remetente_tipo === "analista") {
    return "Analista";
  }

  if (mensagem.remetente_tipo === "supervisor") {
    return "Supervisor";
  }

  return "Sistema";
}

function formatarHorario(data) {
  if (!data) return "";

  const dataFormatada = new Date(data);

  if (Number.isNaN(dataFormatada.getTime())) {
    return "";
  }

  return dataFormatada.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function obterDestinoGrupoSupervisor(chamado, gruposSetor, gruposStatus) {
  const chaveSetor = String(chamado.setor_id ?? chamado.setor_nome ?? "sem-setor");
  let grupoSetor = gruposSetor.get(chaveSetor);
  if (!grupoSetor) {
    grupoSetor = criarElemento("section", "", "ticket-setor-grupo");
    grupoSetor.append(criarElemento("h3", chamado.setor_nome || "Setor não informado", "ticket-setor-titulo"));
    ticketList.append(grupoSetor);
    gruposSetor.set(chaveSetor, grupoSetor);
  }

  if (visualizacao === "fila") return grupoSetor;

  const status = String(chamado.status || "").toLowerCase();
  const rotulos = { em_atendimento: "Em atendimento", aguardando: "Aguardando", pendente: "Pendente" };
  const chaveStatus = `${chaveSetor}:${status}`;
  let grupoStatus = gruposStatus.get(chaveStatus);
  if (!grupoStatus) {
    grupoStatus = criarElemento("div", "", "ticket-status-grupo");
    grupoStatus.append(criarElemento("h4", rotulos[status] || rotuloStatus(status), "ticket-status-titulo"));
    const lista = criarElemento("div", "", "ticket-status-lista");
    grupoStatus.append(lista);
    grupoSetor.append(grupoStatus);
    gruposStatus.set(chaveStatus, lista);
  }
  return grupoStatus;
}

function criarControleAlterarSetor(chamado) {
  const controle = criarElemento("div", "", "ticket-atribuicao");
  controle.addEventListener("click", (event) => event.stopPropagation());
  const seletor = document.createElement("select");
  seletor.className = "ticket-analista-select";
  seletor.setAttribute("aria-label", `Selecionar novo setor para o atendimento ${chamado.id}`);
  seletor.add(new Option("Selecione um setor", ""));
  seletor.classList.add("ticket-controle-select");
  setoresDisponiveis.forEach((setor) => {
    const opcao = new Option(setor.nome, String(setor.id));
    if (Number(setor.id) === Number(chamado.setor_id)) opcao.selected = true;
    seletor.add(opcao);
  });
  const botao = criarElemento("button", "Alterar setor", "secondary-button ticket-controle-botao");
  botao.type = "button";
  botao.addEventListener("click", async (event) => {
    event.stopPropagation();
    const setorId = Number(seletor.value);
    if (!setorId) return alert("Selecione o novo setor.");
    if (setorId === Number(chamado.setor_id)) return alert("Selecione um setor diferente do atual.");
    const precisaDevolver = Boolean(chamado.analista_id) || chamado.status !== "aguardando";
    const aviso = precisaDevolver
      ? "Ao mudar o setor, o analista atual será removido e o atendimento voltará para Aguardando na fila do novo setor. Continuar?"
      : "Deseja mover este atendimento para o setor selecionado?";
    if (!confirm(aviso)) return;
    botao.disabled = true; botao.textContent = "Alterando...";
    try {
      await API.post(`/api/atendimentos/${encodeURIComponent(chamado.id)}/setor`, { setorId });
      await carregarChamados();
    } catch (erro) {
      alert(erro.message);
    } finally {
      botao.disabled = false; botao.textContent = "Alterar setor";
    }
  });
  controle.append(seletor, botao);
  return controle;
}

async function abrirModalEditarAtendimento(chamado) {
  let setores = setoresDisponiveis || [];
  try {
    const resultado = await API.get("/api/analistas/setores");
    setores = resultado.setores || setores;
  } catch (erro) {
    alert(`Não foi possível carregar os setores: ${erro.message}`);
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;";
  const modal = document.createElement("section");
  modal.className = "modal-content";
  modal.style.cssText = "width:min(560px,100%);max-height:90vh;overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,inherit);padding:24px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);";
  const titulo = criarElemento("h2", `Editar atendimento #${chamado.id}`);
  const ajuda = criarElemento("p", "Corrija os dados abaixo. Se mudar o setor, o chamado será devolvido à fila do novo setor.");
  const form = document.createElement("form");
  form.style.cssText = "display:grid;gap:12px;";
  const nomeLabel = criarElemento("label", "Nome do cliente");
  const nome = document.createElement("input");
  nome.type = "text"; nome.required = true; nome.minLength = 2; nome.maxLength = 150;
  nome.value = chamado.usuario_nome || chamado.nome_usuario || "";
  const descricaoLabel = criarElemento("label", "Motivo do atendimento");
  const descricao = document.createElement("textarea");
  descricao.required = true; descricao.maxLength = 4000; descricao.rows = 5;
  descricao.value = chamado.descricao || "";
  const setorLabel = criarElemento("label", "Setor");
  const setor = document.createElement("select"); setor.required = true;
  setores.forEach((item) => setor.add(new Option(item.nome, String(item.id))));
  setor.value = String(chamado.setor_id || "");
  const botoes = document.createElement("div"); botoes.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:8px;";
  const cancelar = criarElemento("button", "Cancelar", "secondary-button"); cancelar.type = "button";
  const salvar = criarElemento("button", "Salvar alterações", "primary-button"); salvar.type = "submit";
  const fechar = () => overlay.remove();
  cancelar.addEventListener("click", fechar);
  // Padrão do projeto: clique fora do modal nunca fecha a janela.
  form.append(nomeLabel, nome, descricaoLabel, descricao, setorLabel, setor, botoes);
  botoes.append(cancelar, salvar);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    salvar.disabled = true; salvar.textContent = "Salvando...";
    try {
      await API.patch(`/api/atendimentos/${encodeURIComponent(chamado.id)}/editar`, {
        nome: nome.value.trim(), descricao: descricao.value.trim(), setorId: Number(setor.value)
      });
      fechar();
      if (atendimentoSelecionado && Number(atendimentoSelecionado.id) === Number(chamado.id)) {
        atendimentoSelecionado = null; mensagensAtendimento = []; chatSection.hidden = true;
      }
      await carregarChamados();
    } catch (erro) {
      alert(erro.message);
    } finally {
      salvar.disabled = false; salvar.textContent = "Salvar alterações";
    }
  });
  modal.append(titulo, ajuda, form); overlay.append(modal); document.body.append(overlay);
  nome.focus();
}

function renderizarChamados() {
  ticketList.replaceChildren();
  const supervisorAgrupado = usuarioAtual?.perfil === "supervisor" && ["fila", "meus"].includes(visualizacao);
  ticketList.classList.toggle("ticket-list-compacta", visualizacao === "meus" && chamados.length >= 2);
  ticketList.classList.toggle("ticket-list-por-setor", supervisorAgrupado);
  ticketList.classList.toggle("ticket-list-fila", visualizacao === "fila");

  if (chamados.length === 0) {
    ticketList.append(
      criarElemento("p", "Nenhum chamado encontrado.")
    );
    return;
  }

  const gruposSetor = new Map();
  const gruposStatus = new Map();
  // Todas as listas operacionais seguem o número do chamado em ordem decrescente.
  const chamadosOrdenados = [...chamados].sort((a, b) => Number(b.id) - Number(a.id));

  chamadosOrdenados.forEach((chamado) => {
    const destinoCard = supervisorAgrupado
      ? obterDestinoGrupoSupervisor(chamado, gruposSetor, gruposStatus)
      : ticketList;
    const card = criarElemento(
      "article",
      "",
      visualizacao === "fila" ? "ticket-card fila-linha-chamado" : "ticket-card"
    );
    if (visualizacao === "meus" && chamados.length >= 2) card.classList.add("ticket-card-compacto");
    const statusNormalizado = normalizarStatus(chamado.status);

    const nome = criarElemento(
      "h3",
      chamado.usuario_nome || chamado.nome_usuario || "Usuário",
      "fila-cliente"
    );

    const numero = criarElemento(
      "p",
      `Chamado #${chamado.id}`,
      "fila-numero"
    );

    const setor = criarElemento(
      "p",
      `Setor: ${chamado.setor_nome ||
      chamado.setor_id ||
      "Não informado"
      }`,
      "fila-setor"
    );

    const analista = criarElemento(
      "p",
      `Analista: ${chamado.analista_nome || "Não atribuído"
      }`,
      "fila-analista"
    );

    let vinculoOrigem = null;
    if (chamado.atendimento_origem_id) {
      vinculoOrigem = criarElemento("p", `Replicado do chamado #${chamado.atendimento_origem_id}`, "ticket-vinculo-origem");
      vinculoOrigem.title = "Este atendimento foi criado a partir de outro chamado";
    }

    let controleAtribuicao = null;

    if (usuarioAtual?.perfil === "supervisor") {
      controleAtribuicao = document.createElement("div");
      controleAtribuicao.className = "ticket-atribuicao";

      controleAtribuicao.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      const rotulo = criarElemento(
        "p",
        "Atribuir para:"
      );

      const selectAnalista = document.createElement("select");

      selectAnalista.className =
        "ticket-analista-select";

      selectAnalista.setAttribute(
        "aria-label",
        `Selecionar analista para o chamado ${chamado.id}`
      );

      selectAnalista.add(
        new Option(
          "Selecione um analista",
          ""
        )
      );

      analistasDisponiveis
        .filter(
          (analistaDisponivel) =>
            Number(analistaDisponivel.setor_id) ===
            Number(chamado.setor_id)
        )
        .forEach((analistaDisponivel) => {
          const opcao = new Option(
            analistaDisponivel.nome,
            String(analistaDisponivel.id)
          );

          selectAnalista.add(opcao);
        });

      if (chamado.analista_id) {
        selectAnalista.value =
          String(chamado.analista_id);
      }

      const botaoAtribuir = criarElemento(
        "button",
        "Atribuir chamado",
        "secondary-button"
      );

      botaoAtribuir.type = "button";

      botaoAtribuir.addEventListener(
        "click",
        async (event) => {
          event.stopPropagation();

          const analistaId =
            Number(selectAnalista.value);

          if (!analistaId) {
            alert("Selecione um analista.");
            return;
          }

          botaoAtribuir.disabled = true;
          botaoAtribuir.textContent = "Atribuindo...";

          try {
            await API.post(
              `/api/atendimentos/${encodeURIComponent(
                chamado.id
              )}/atribuir`,
              {
                analistaId
              }
            );

            await carregarChamados();

            if (
              atendimentoSelecionado &&
              Number(atendimentoSelecionado.id) ===
              Number(chamado.id)
            ) {
              await carregarConversa(chamado.id);
            }
          } catch (erro) {
            alert(erro.message);
          } finally {
            botaoAtribuir.disabled = false;
            botaoAtribuir.textContent =
              "Atribuir chamado";
          }
        }
      );

      const botaoDevolver = criarElemento(
        "button",
        "Devolver à fila",
        "danger-outline-button"
      );

      botaoDevolver.type = "button";

      botaoDevolver.hidden = visualizacao === "fila";

      botaoDevolver.disabled =
        !chamado.analista_id ||
        chamado.status === "realizado";

      botaoDevolver.title =
        chamado.analista_id
          ? "Remover o analista e devolver o chamado para a fila"
          : "Este chamado já está na fila";

      botaoDevolver.addEventListener(
        "click",
        async (event) => {
          event.stopPropagation();

          if (!chamado.analista_id) {
            alert(
              "Este chamado já está sem analista."
            );
            return;
          }

          if (chamado.status === "realizado") {
            alert(
              "Chamados realizados não podem ser devolvidos à fila."
            );
            return;
          }

          const confirmar = confirm(
            `Deseja devolver o chamado #${chamado.id} para a fila?`
          );

          if (!confirmar) {
            return;
          }

          botaoDevolver.disabled = true;
          botaoDevolver.textContent =
            "Devolvendo...";

          try {
            await API.post(
              `/api/atendimentos/${encodeURIComponent(
                chamado.id
              )}/devolver-fila`
            );

            await carregarChamados();

            if (
              atendimentoSelecionado &&
              Number(atendimentoSelecionado.id) ===
              Number(chamado.id)
            ) {
              await carregarConversa(chamado.id);
            }
          } catch (erro) {
            alert(erro.message);
          } finally {
            botaoDevolver.disabled =
              !chamado.analista_id ||
              chamado.status === "realizado";

            botaoDevolver.textContent =
              "Devolver à fila";
          }
        }
      );

      controleAtribuicao.append(
        rotulo,
        selectAnalista,
        botaoAtribuir,
        botaoDevolver
      );
    }

    const descricao = criarElemento(
      "p",
      chamado.descricao || "Sem descrição.",
      "fila-descricao"
    );

    const controleStatus =
      document.createElement("div");

    controleStatus.className =
      "ticket-status-controle";

    controleStatus.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
      }
    );

    const selectStatus =
      document.createElement("select");

    selectStatus.className =
      "ticket-status-select";

    selectStatus.setAttribute(
      "aria-label",
      `Alterar status do chamado ${chamado.id}`
    );

    const statusAtual = normalizarStatus(chamado.status);
    const statusDisponiveis = [["aguardando", "Aguardando"], ["em_atendimento", "Em atendimento"], ["pendente", "Pendente"], ["realizado", "Realizado"]];
    statusDisponiveis.forEach(([valor, texto]) => selectStatus.add(new Option(texto, valor)));
    selectStatus.value = statusAtual;

    const botaoStatus = criarElemento(
      "button",
      "Alterar status",
      "secondary-button"
    );

    botaoStatus.type = "button";

    botaoStatus.addEventListener(
      "click",
      async (event) => {
        event.stopPropagation();

        const novoStatus =
          selectStatus.value;

        if (novoStatus === normalizarStatus(chamado.status)) {
          return;
        }

        botaoStatus.disabled = true;
        botaoStatus.textContent =
          "Alterando...";

        try {
          await API.patch(
            `/api/atendimentos/${encodeURIComponent(
              chamado.id
            )}/status`,
            {
              status: novoStatus
            }
          );

          await carregarChamados();

          if (novoStatus === "realizado" && atendimentoSelecionado &&
            Number(atendimentoSelecionado.id) === Number(chamado.id)) {
            atendimentoSelecionado = null;
            mensagensAtendimento = [];
            chatSection.hidden = true;
          } else if (atendimentoSelecionado &&
            Number(atendimentoSelecionado.id) === Number(chamado.id)) {
            await carregarConversa(chamado.id);
          }
        } catch (erro) {
          alert(erro.message);

          selectStatus.value = normalizarStatus(chamado.status);
        } finally {
          botaoStatus.disabled = false;

          botaoStatus.textContent =
            "Alterar status";
        }
      }
    );

    controleStatus.append(
      selectStatus,
      botaoStatus
    );

    const bolhaStatus = criarBolhaStatus(chamado.status);

    if (visualizacao === "meus" || (usuarioAtual?.perfil === "supervisor" && visualizacao === "fila")) {
      const botaoReplicar = criarElemento("button", "Replicar atendimento", "secondary-button");
      botaoReplicar.type = "button";
      botaoReplicar.addEventListener("click", async (event) => {
        event.stopPropagation();
        await abrirModalReplicarAtendimento(chamado);
      });
      card.append(nome, numero, bolhaStatus, setor, analista, descricao, botaoReplicar);
    } else {
      card.append(nome, numero, bolhaStatus, setor, analista, descricao);
    }

    if (controleAtribuicao) {
      card.append(controleAtribuicao);
    }

    if (usuarioAtual?.perfil === "analista" && visualizacao === "meus" && Number(chamado.analista_id) === Number(usuarioAtual.id) && chamado.status !== "realizado") {
      const botaoDevolverAnalista = criarElemento("button", "Devolver à fila", "danger-outline-button");
      botaoDevolverAnalista.type = "button";
      botaoDevolverAnalista.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!confirm(`Deseja devolver o chamado #${chamado.id} para a fila do setor ${chamado.setor_nome || "atual"}?`)) return;
        botaoDevolverAnalista.disabled = true;
        botaoDevolverAnalista.textContent = "Devolvendo...";
        try {
          await API.post(`/api/atendimentos/${encodeURIComponent(chamado.id)}/devolver-fila`);
          if (atendimentoSelecionado && Number(atendimentoSelecionado.id) === Number(chamado.id)) {
            atendimentoSelecionado = null;
            mensagensAtendimento = [];
            chatSection.hidden = true;
          }
          await carregarChamados();
        } catch (erro) {
          alert(erro.message);
        } finally {
          botaoDevolverAnalista.disabled = false;
          botaoDevolverAnalista.textContent = "Devolver à fila";
        }
      });
      card.append(botaoDevolverAnalista);
    }


    if (usuarioAtual?.perfil === "supervisor" && visualizacao !== "fila" && setoresDisponiveis.length) {
      card.append(criarControleAlterarSetor(chamado));
    }

    const analistaPodeAlterarStatus = usuarioAtual?.perfil === "analista" && visualizacao === "meus" && Number(chamado.analista_id) === Number(usuarioAtual.id) && statusNormalizado !== "realizado";
    if ((usuarioAtual?.perfil === "supervisor" && visualizacao !== "fila") || analistaPodeAlterarStatus) {
      card.append(controleStatus);
    }

    const podeEditarChamado = usuarioAtual?.perfil === "supervisor" || (usuarioAtual?.perfil === "analista" && visualizacao === "meus" && Number(chamado.analista_id) === Number(usuarioAtual.id));
    if (podeEditarChamado && statusNormalizado !== "realizado") {
      const botaoEditar = criarElemento("button", "Editar atendimento", "secondary-button");
      botaoEditar.type = "button";
      botaoEditar.addEventListener("click", async (event) => {
        event.stopPropagation();
        await abrirModalEditarAtendimento(chamado);
      });
      card.append(botaoEditar);
    }

    if (visualizacao === "meus" && chamado.analista_id) {
      card.style.cursor = "pointer";
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, select, input, label")) return;
        carregarConversa(chamado.id);
      });
    } else {
      card.style.cursor = "default";
    }

    if (
      visualizacao === "fila" &&
      usuarioAtual?.perfil === "analista"
    ) {
      const botao = criarElemento(
        "button",
        "Assumir chamado"
      );

      botao.addEventListener(
        "click",
        async (event) => {
          event.stopPropagation();

          botao.disabled = true;
          botao.textContent =
            "Assumindo...";

          try {
            await API.post(
              `/api/atendimentos/${encodeURIComponent(
                chamado.id
              )}/assumir`,
              {}
            );

            await carregarChamados();
          } catch (erro) {
            alert(erro.message);

            botao.disabled = false;
            botao.textContent =
              "Assumir chamado";
          }
        }
      );

      card.append(botao);
    }

    destinoCard.append(card);
  });
}


document.querySelectorAll(".nav-button").forEach((botao) => {
  botao.addEventListener("click", async () => {
    const novaVisualizacao = botao.dataset.view;

    if (
      ["usuarios", "historico", "logs"].includes(novaVisualizacao) &&
      usuarioAtual?.perfil !== "supervisor"
    ) {
      return;
    }

    visualizacao = novaVisualizacao;

    atendimentoSelecionado = null;
    mensagensAtendimento = [];
    chatSection.hidden = true;

    document.querySelectorAll(".nav-button").forEach((item) => {
      item.classList.toggle("active", item === botao);
    });

    const gerenciandoInicio = visualizacao === "inicio";
    const gerenciandoUsuarios = visualizacao === "usuarios";
    const gerenciandoHistorico = visualizacao === "historico";
    const gerenciandoLogs = visualizacao === "logs";
    const gerenciandoTarefas = visualizacao === "tarefas";
    const meus = visualizacao === "meus";

    inicioSection.hidden = !gerenciandoInicio;
    usuariosSection.hidden = !gerenciandoUsuarios;
    historicoSection.hidden = !gerenciandoHistorico;
    logsSection.hidden = !gerenciandoLogs;
    tarefasSection.hidden = !gerenciandoTarefas;

    ticketsSection.hidden =
      gerenciandoInicio ||
      gerenciandoUsuarios ||
      gerenciandoHistorico ||
      gerenciandoLogs ||
      gerenciandoTarefas;

    const metricas = document.querySelector(".metrics");
    const botaoAtualizar = document.getElementById("refresh-button");
    const botaoAbrirAtendimento = document.getElementById("abrir-atendimento-button");
    if (botaoAbrirAtendimento) botaoAbrirAtendimento.hidden = !["fila", "meus"].includes(visualizacao);

    const telaAdministrativa =
      gerenciandoInicio ||
      gerenciandoUsuarios ||
      gerenciandoHistorico ||
      gerenciandoLogs ||
      gerenciandoTarefas;

    metricas.hidden = telaAdministrativa;
    botaoAtualizar.hidden = telaAdministrativa;

    if (gerenciandoInicio) {
      title.textContent = "Início";
      await carregarIndicadores();
      return;
    }

    if (gerenciandoUsuarios) {
      title.textContent = "Gerenciar usuários";

      await carregarSetores();
      await carregarAnalistas();
      return;
    }

    if (gerenciandoHistorico) {
      title.textContent = "Histórico de atendimentos";
      sectionTitle.textContent = "Atendimentos finalizados e arquivados";
      await carregarHistorico();
      return;
    }

    if (gerenciandoLogs) {
      title.textContent = "Tabela de Logs";
      sectionTitle.textContent = "Logs do sistema";
      await carregarLogs();
      return;
    }

    if (gerenciandoTarefas) {
      title.textContent = "Tarefas";
      await carregarTarefas();
      return;
    }

    title.textContent =
      usuarioAtual?.perfil === "supervisor"
        ? "Controle de atendimentos"
        : meus
          ? "Meus atendimentos"
          : "Fila de atendimentos";

    sectionTitle.textContent = usuarioAtual?.perfil === "supervisor"
      ? (meus ? "Atendimentos por setor e status" : "Aguardando por setor")
      : meus ? "Chamados sob minha responsabilidade" : "Chamados disponíveis";

    await carregarChamados();
  });
});



// Tarefas pessoais: acesso restrito ao usuário autenticado.
const modalCriarTarefa = document.getElementById("modal-criar-tarefa"), formCriarTarefa = document.getElementById("form-criar-tarefa");
const tarefasContainer = document.getElementById("tarefas-lista"), campoTituloTarefa = document.getElementById("tarefa-titulo"), campoObservacaoTarefa = document.getElementById("tarefa-observacao"), campoDataTarefa = document.getElementById("tarefa-data"), mensagemTarefa = document.getElementById("tarefa-mensagem");
const campoEmpresaTarefa = document.getElementById("tarefa-empresa");
let tarefaEmEdicao = null, tarefaSelecionada = null, modoTarefasRealizadas = false;
function formatarDataTarefa(data) { if (!data) return "Sem data prevista"; const p = String(data).slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(data); }

async function carregarTarefas() {
  tarefasContainer.replaceChildren(
    criarElemento("p", "Carregando tarefas...", "tarefas-vazio")
  );

  try {
    const r = await API.get(
      modoTarefasRealizadas
        ? "/api/tarefas/realizadas"
        : "/api/tarefas"
    );

    const tarefas = Array.isArray(r.tarefas) ? r.tarefas : [];

    tarefasContainer.className =
      modoVisualizacaoTarefas === "quadros"
        ? "tarefas-grid"
        : "tarefas-lista-modo";

    tarefasContainer.replaceChildren();

    if (!tarefas.length) {
      tarefasContainer.append(
        criarElemento(
          "p",
          modoTarefasRealizadas
            ? "Nenhuma tarefa realizada."
            : "Você ainda não possui tarefas.",
          "tarefas-vazio"
        )
      );
      return;
    }

    tarefas.forEach((t) => {
      const card = document.createElement("article");
      card.className = "tarefa-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");

      const h = document.createElement("h3");
      h.textContent = t.titulo;

      const p = document.createElement("p");
      p.className = "tarefa-observacao";
      p.textContent = t.observacao;

      const d = document.createElement("span");
      d.className = "tarefa-data";
      d.textContent = `◷ ${formatarDataTarefa(t.data_prevista)}`;

      card.append(h, p, d);

      if (t.empresa) {
        const empresa = document.createElement("span");
        empresa.className = "tarefa-data";
        empresa.textContent =
          `Empresa: ${t.empresa.nome_fantasia || t.empresa.razao_social}`;

        card.append(empresa);
      }

      // Abre os detalhes da tarefa.
      const abrir = () => abrirDetalheTarefa(t);

      card.addEventListener("click", abrir);

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrir();
        }
      });

      // Insere o card na lista.
      tarefasContainer.append(card);
    });

  } catch (e) {
    tarefasContainer.replaceChildren(
      criarElemento(
        "p",
        e.message || "Erro ao carregar tarefas.",
        "error-message"
      )
    );
  }
}

const modalDetalheTarefa = document.getElementById("modal-detalhe-tarefa");
function formatarTamanhoAnexo(bytes) {
  const tamanho = Number(bytes) || 0;
  if (tamanho < 1024) return `${tamanho} B`;
  if (tamanho < 1024 * 1024) return `${(tamanho / 1024).toFixed(1)} KB`;
  return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`;
}
function renderizarAnexosTarefa(t) {
  const area = document.getElementById("detalhe-tarefa-anexos");
  area.replaceChildren();
  const anexos = Array.isArray(t.anexos) ? t.anexos : [];
  const titulo = document.createElement("h3");
  titulo.textContent = anexos.length ? `Anexos (${anexos.length})` : "Nenhum anexo nesta tarefa.";
  area.append(titulo);
  anexos.forEach(a => {
    const linha = document.createElement("div");
    linha.className = "tarefa-anexo-item";
    const info = document.createElement("div");
    info.className = "tarefa-anexo-info";
    const nome = document.createElement("strong");
    nome.className = "tarefa-anexo-nome";
    nome.textContent = a.nome_original || "Arquivo sem nome";
    const tamanho = document.createElement("small");
    tamanho.className = "tarefa-anexo-tamanho";
    tamanho.textContent = formatarTamanhoAnexo(a.tamanho);
    info.append(nome, tamanho);
    const acoes = document.createElement("div");
    acoes.className = "tarefa-anexo-acoes";
    const visualizar = document.createElement("button");
    visualizar.type = "button"; visualizar.className = "secondary-button"; visualizar.textContent = "Visualizar";
    visualizar.addEventListener("click", () => abrirAnexoTarefa(a, "visualizar"));
    const baixar = document.createElement("button");
    baixar.type = "button"; baixar.className = "secondary-button"; baixar.textContent = "Baixar";
    baixar.addEventListener("click", () => abrirAnexoTarefa(a, "baixar"));
    acoes.append(visualizar, baixar);
    if (!modoTarefasRealizadas) {
      const remover = document.createElement("button");
      remover.type = "button"; remover.className = "secondary-button"; remover.textContent = "Remover";
      remover.addEventListener("click", () => removerAnexoTarefa(a));
      acoes.append(remover);
    }
    linha.append(info, acoes); area.append(linha);
  });
}
async function abrirAnexoTarefa(anexo, acao) {
  const token = sessionStorage.getItem("token");
  const url = acao === "visualizar" ? `/api/tarefas/anexos/${anexo.id}/visualizar` : `/api/tarefas/anexos/${anexo.id}`;
  const janela = acao === "visualizar" ? window.open("about:blank", "_blank") : null;
  try {
    const resposta = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (resposta.status === 401) {
      sessionStorage.removeItem("token"); if (janela) janela.close(); window.location.href = "/"; return;
    }
    if (!resposta.ok) {
      const texto = await resposta.text(); let mensagem = "Não foi possível acessar o anexo.";
      try { const dados = JSON.parse(texto); mensagem = dados.mensagem || dados.erro || mensagem; } catch { }
      throw new Error(mensagem);
    }
    const objetoUrl = URL.createObjectURL(await resposta.blob());
    if (acao === "visualizar") {
      if (janela) janela.location.href = objetoUrl;
      else { const link = document.createElement("a"); link.href = objetoUrl; link.target = "_blank"; link.rel = "noopener"; link.click(); }
    } else {
      const link = document.createElement("a"); link.href = objetoUrl; link.download = anexo.nome_original || "anexo";
      document.body.append(link); link.click(); link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(objetoUrl), 60000);
  } catch (erro) {
    if (janela) janela.close();
    alert(erro.message || "Erro ao acessar o anexo.");
  }
}
async function removerAnexoTarefa(anexo) {
  if (!tarefaSelecionada) return;
  if (!window.confirm(`Deseja remover o anexo "${anexo.nome_original}"?`)) return;
  try {
    await API.delete(`/api/tarefas/anexos/${anexo.id}`);
    tarefaSelecionada.anexos = (tarefaSelecionada.anexos || []).filter(a => Number(a.id) !== Number(anexo.id));
    renderizarAnexosTarefa(tarefaSelecionada);
    await carregarTarefas();
  } catch (erro) { alert(erro.message || "Não foi possível remover o anexo."); }
}

function abrirDetalheTarefa(t) {
  tarefaSelecionada = t;
  document.getElementById("detalhe-tarefa-titulo").textContent = t.titulo;
  const empresaDetalhe = document.getElementById("detalhe-tarefa-empresa");

  empresaDetalhe.textContent = t.empresa
    ? `Empresa: ${t.empresa.nome_fantasia || t.empresa.razao_social} — CNPJ: ${t.empresa.cnpj}`
    : "Nenhuma empresa vinculada";
  document.getElementById("detalhe-tarefa-observacao").textContent = t.observacao;
  document.getElementById("detalhe-tarefa-data").textContent = `◷ ${formatarDataTarefa(t.data_prevista)}`;
  renderizarAnexosTarefa(t);
  document.getElementById("editar-detalhe-tarefa").hidden = modoTarefasRealizadas;
  document.getElementById("finalizar-detalhe-tarefa").hidden = modoTarefasRealizadas;
  if (modoTarefasRealizadas) { const b = document.getElementById("finalizar-detalhe-tarefa"); b.hidden = false; b.textContent = "Voltar para Em digitação"; } else document.getElementById("finalizar-detalhe-tarefa").textContent = "Marcar como realizada";
  modalDetalheTarefa.hidden = false;
}
document.getElementById("fechar-detalhe-tarefa")?.addEventListener("click", () => modalDetalheTarefa.hidden = true);

async function abrirModalCriarTarefa(t = null) {
  tarefaEmEdicao = t?.id || null;
  formCriarTarefa.reset();
  mensagemTarefa.textContent = "";

  document.getElementById("modal-tarefa-titulo").textContent =
    t ? "Editar tarefa" : "Criar tarefa";

  document.getElementById("salvar-tarefa").textContent =
    t ? "Salvar alterações" : "Salvar tarefa";

  try {
    await carregarEmpresasTarefa(t?.empresa_id || "");
  } catch (erro) {
    mensagemTarefa.textContent =
      erro.message || "Não foi possível carregar as empresas cadastradas.";
    return;
  }

  if (t) {
    campoTituloTarefa.value = t.titulo;
    campoObservacaoTarefa.value = t.observacao;
    campoDataTarefa.value = t.data_prevista
      ? String(t.data_prevista).slice(0, 10)
      : "";

    campoEmpresaTarefa.value = t.empresa_id
      ? String(t.empresa_id)
      : "";
  }

  document.getElementById("tarefa-contador").textContent =
    `${campoTituloTarefa.value.length}/64 caracteres`;

  modalCriarTarefa.hidden = false;
  campoTituloTarefa.focus();
}

function fecharModalCriarTarefa() { modalCriarTarefa.hidden = true; tarefaEmEdicao = null; }
document.getElementById("criar-tarefa")?.addEventListener("click", () => abrirModalCriarTarefa());
document.getElementById("fechar-modal-tarefa")?.addEventListener("click", fecharModalCriarTarefa);
document.getElementById("cancelar-tarefa")?.addEventListener("click", fecharModalCriarTarefa);
campoTituloTarefa?.addEventListener("input", () => document.getElementById("tarefa-contador").textContent = `${campoTituloTarefa.value.length}/64 caracteres`);
formCriarTarefa?.addEventListener("submit", async e => {
  e.preventDefault(); const titulo = campoTituloTarefa.value.trim(), observacao = campoObservacaoTarefa.value.trim();
  if (!titulo || !observacao || titulo.length > 64) { mensagemTarefa.textContent = "Título e observação são obrigatórios; o título aceita até 64 caracteres."; return; }
  const btn = document.getElementById("salvar-tarefa"); btn.disabled = true;
  try {
    const payload = {
      titulo,
      observacao,
      dataPrevista: campoDataTarefa.value || null,
      empresaId: campoEmpresaTarefa.value || null
    };
    let resultado;
    if (tarefaEmEdicao) resultado = await API.patch(`/api/tarefas/${tarefaEmEdicao}`, payload); else resultado = await API.post("/api/tarefas", payload);
    const id = tarefaEmEdicao || resultado.tarefa.id;
    const files = [...(document.getElementById("tarefa-anexos").files || [])];
    const limite = 50 * 1024 * 1024;
    const arquivoGrande = files.find(file => file.size > limite);
    if (arquivoGrande) throw new Error(`O arquivo "${arquivoGrande.name}" ultrapassa 50 MB.`);
    if (files.length > 20) throw new Error("Selecione no máximo 20 arquivos por envio.");
    if (files.length) {
      const fd = new FormData();
      files.forEach(file => fd.append("arquivos", file));
      await API.upload(`/api/tarefas/${id}/anexos`, fd);
    }
    fecharModalCriarTarefa(); modalDetalheTarefa.hidden = true; await carregarTarefas();
  } catch (err) { mensagemTarefa.textContent = err.message || "Não foi possível salvar a tarefa."; }
  finally { btn.disabled = false; }
});
document.getElementById("editar-detalhe-tarefa")?.addEventListener("click", () => { const t = tarefaSelecionada; modalDetalheTarefa.hidden = true; abrirModalCriarTarefa(t); });
document.getElementById("finalizar-detalhe-tarefa")?.addEventListener("click", async () => {
  if (!tarefaSelecionada) return; const endpoint = modoTarefasRealizadas ? "reabrir" : "finalizar";
  try { await API.patch(`/api/tarefas/${tarefaSelecionada.id}/${endpoint}`, {}); modalDetalheTarefa.hidden = true; await carregarTarefas(); } catch (e) { alert(e.message); }
});
document.getElementById("ver-tarefas-realizadas")?.addEventListener("click", () => {
  modoTarefasRealizadas = !modoTarefasRealizadas;
  document.getElementById("ver-tarefas-realizadas").textContent = modoTarefasRealizadas ? "Voltar às tarefas" : "Tarefas realizadas";
  document.getElementById("criar-tarefa").hidden = modoTarefasRealizadas; carregarTarefas();
});
function definirModoTarefas(modo) { modoVisualizacaoTarefas = modo; const q = modo === "quadros"; document.getElementById("tarefas-modo-quadros").classList.toggle("active", q); document.getElementById("tarefas-modo-lista").classList.toggle("active", !q); document.getElementById("tarefas-modo-quadros").setAttribute("aria-pressed", String(q)); document.getElementById("tarefas-modo-lista").setAttribute("aria-pressed", String(!q)); if (visualizacao === "tarefas") carregarTarefas(); }
document.getElementById("tarefas-modo-quadros")?.addEventListener("click", () => definirModoTarefas("quadros"));
document.getElementById("tarefas-modo-lista")?.addEventListener("click", () => definirModoTarefas("lista"));

document.getElementById("atualizar-indicadores")?.addEventListener("click", carregarIndicadores);

document.getElementById("refresh-button")
  .addEventListener("click", () => {
    if (visualizacao === "usuarios") {
      carregarSetores().then(carregarAnalistas).catch((erro) => {
        mensagemAnalista.textContent = erro.message;
        mensagemAnalista.className = "error-message";
      });
    } else {
      carregarChamados();
    }
  });

document.getElementById("logout-button")
  .addEventListener("click", () => {
    sessionStorage.removeItem("token");
    window.location.href = "/";
  });

function iniciarAtualizacoesTempoReal() {
  if (typeof window.io !== "function") {
    console.warn("Socket.IO não carregado; o painel continuará funcionando com atualização manual.");
    return;
  }

  const token = sessionStorage.getItem("token");
  if (!token) return;

  const socket = window.io({ auth: { token } });
  window.socketAtendimentos = socket;

  socket.on("connect", () => {
    console.info("Atualizações em tempo real conectadas.");
  });

  socket.on("connect_error", (erro) => {
    console.warn("Não foi possível conectar às atualizações em tempo real:", erro.message);
  });

  socket.on("sessao:encerrar", () => {
    sessionStorage.removeItem("token");
    socket.disconnect();
    window.location.replace("/");
  });

  socket.on("atendimentos:atualizar", async (evento) => {
    try {
      if (visualizacao === "inicio") {
        await carregarIndicadores();
      } else if (["fila", "meus"].includes(visualizacao) ||
        (usuarioAtual?.perfil === "supervisor" && visualizacao === "supervisor")) {
        await carregarChamados();
      } else if (visualizacao === "historico") {
        await carregarHistorico();
      } else if (visualizacao === "logs") {
        await carregarLogs();
      }

      if (evento?.tipo === "nova_mensagem" && atendimentoSelecionado?.id) {
        await carregarConversa(atendimentoSelecionado.id);
      }
    } catch (erro) {
      console.warn("Falha ao atualizar a tela após evento em tempo real:", erro.message);
    }
  });
}
async function carregarEmpresasTarefa(empresaSelecionada = "") {
  campoEmpresaTarefa.innerHTML = "";

  const opcaoPadrao = document.createElement("option");
  opcaoPadrao.value = "";
  opcaoPadrao.textContent = "Nenhuma empresa vinculada";
  campoEmpresaTarefa.append(opcaoPadrao);

  const resposta = await API.get("/api/tarefas/clientes");
  const empresas = resposta.empresas || [];

  empresas.forEach(empresa => {
    const opcao = document.createElement("option");
    opcao.value = empresa.id;

    const nome = empresa.nome_fantasia || empresa.razao_social;
    opcao.textContent = `${nome} — CNPJ: ${empresa.cnpj}`;

    campoEmpresaTarefa.append(opcao);
  });

  campoEmpresaTarefa.value = empresaSelecionada
    ? String(empresaSelecionada)
    : "";
}

const modalAbrirAtendimento = document.getElementById("modal-abrir-atendimento");
const formAbrirAtendimento = document.getElementById("form-abrir-atendimento");
const mensagemAbrirAtendimento = document.getElementById("abrir-atendimento-mensagem");
const setorAbrirAtendimento = document.getElementById("novo-atendimento-setor");
const analistaReplicarSelect = document.getElementById("replicar-atendimento-analista");
const cnpjInputEmpresa = document.getElementById("novo-cliente-cnpj");
cnpjInputEmpresa?.addEventListener("blur", async () => {
  const cnpj = cnpjInputEmpresa.value.replace(/\D/g, "");
  const box = document.getElementById("cadastro-empresa-nova");
  if (cnpj.length !== 14) { box.hidden = true; return; }
  try {
    const r = await API.get(`/api/atendimentos/empresa/cnpj/${cnpj}`);
    box.hidden = r.encontrada;
    document.getElementById("nova-empresa-razao").required = !r.encontrada;
    if (r.encontrada) mensagemAbrirAtendimento.textContent = `Empresa identificada: ${r.empresa.razao_social}`;
    else mensagemAbrirAtendimento.textContent = "Empresa não cadastrada. Informe a razão social para cadastrá-la.";
  } catch (e) { mensagemAbrirAtendimento.textContent = e.message; }
});
let modoReplicarAtendimento = null;

async function abrirModalNovoAtendimento() {
  modoReplicarAtendimento = null;
  formAbrirAtendimento.reset();
  document.getElementById("novo-cliente-nome").readOnly = false;
  document.getElementById("novo-cliente-telefone").readOnly = false;
  document.getElementById("novo-cliente-cnpj").readOnly = false;
  mensagemAbrirAtendimento.textContent = "";
  mensagemAbrirAtendimento.className = "";

  const ehSupervisor = usuarioAtual?.perfil === "supervisor";
  document.getElementById("modal-abrir-atendimento-titulo").textContent = "Abrir atendimento";
  document.getElementById("modal-abrir-atendimento-descricao").textContent = "Informe os dados do cliente e descreva o motivo do contato.";
  document.getElementById("abrir-setor-container").hidden = !ehSupervisor;
  document.getElementById("abrir-setor-analista-info").hidden = true;
  document.getElementById("replicar-analista-container").hidden = true;
  setorAbrirAtendimento.required = ehSupervisor;
  document.getElementById("confirmar-abrir-atendimento").textContent = "Abrir e iniciar atendimento";

  if (ehSupervisor) {
    setorAbrirAtendimento.replaceChildren(new Option("Carregando setores...", ""));
    try {
      const resultado = await API.get("/api/analistas/setores");
      const setores = resultado.setores || [];
      setoresDisponiveis = setores;
      setorAbrirAtendimento.replaceChildren(new Option("Selecione um setor", ""));
      setores.forEach((setor) => setorAbrirAtendimento.add(new Option(setor.nome, String(setor.id))));
      if (!setores.length) setorAbrirAtendimento.replaceChildren(new Option("Nenhum setor ativo", ""));
    } catch (erro) {
      mensagemAbrirAtendimento.textContent = erro.message;
      mensagemAbrirAtendimento.className = "error-message";
    }
  }

  modalAbrirAtendimento.hidden = false;
  document.getElementById("novo-cliente-nome").focus();
}

async function abrirModalReplicarAtendimento(chamado) {
  modoReplicarAtendimento = Number(chamado.id);
  formAbrirAtendimento.reset();
  mensagemAbrirAtendimento.textContent = "";
  mensagemAbrirAtendimento.className = "";
  const ehSupervisor = usuarioAtual?.perfil === "supervisor";
  document.getElementById("modal-abrir-atendimento-titulo").textContent = "Replicar atendimento";
  document.getElementById("modal-abrir-atendimento-descricao").textContent = `Os dados do cliente serão reaproveitados do chamado #${chamado.id}. Revise a descrição e escolha o destino.`;
  document.getElementById("novo-cliente-nome").value = chamado.usuario_nome || chamado.nome_usuario || "";
  document.getElementById("novo-cliente-telefone").value = chamado.usuario_telefone || chamado.telefone || "";
  document.getElementById("novo-cliente-cnpj").value = chamado.cnpj || chamado.empresa_cnpj || "";
  document.getElementById("novo-atendimento-descricao").value = chamado.descricao || "";
  document.getElementById("novo-cliente-nome").readOnly = true;
  document.getElementById("novo-cliente-telefone").readOnly = true;
  document.getElementById("novo-cliente-cnpj").readOnly = true;
  document.getElementById("abrir-setor-container").hidden = false;
  document.getElementById("abrir-setor-analista-info").hidden = false;
  document.getElementById("replicar-analista-container").hidden = !ehSupervisor;
  setorAbrirAtendimento.required = true;
  document.getElementById("confirmar-abrir-atendimento").textContent = "Replicar atendimento";
  setorAbrirAtendimento.replaceChildren(new Option("Carregando setores...", ""));
  try {
    const resultado = await API.get("/api/analistas/setores");
    setoresDisponiveis = resultado.setores || [];
    setorAbrirAtendimento.replaceChildren(new Option("Selecione o setor de destino", ""));
    setoresDisponiveis.forEach((setor) => setorAbrirAtendimento.add(new Option(setor.nome, String(setor.id))));
    if (ehSupervisor) {
      const lista = await API.get("/api/analistas");
      const analistas = (lista.analistas || []).filter((a) => a.ativo);
      analistaReplicarSelect.replaceChildren(new Option("Deixar na fila do setor", ""));
      analistas.forEach((a) => analistaReplicarSelect.add(new Option(`${a.nome} — ${a.setor_nome || "Sem setor"}`, String(a.id))));
      setorAbrirAtendimento.onchange = filtrarAnalistasReplicacao;
      analistaReplicarSelect.dataset.analistas = JSON.stringify(analistas);
    }
    const setorOrigem = String(chamado.setor_id || "");
    setorAbrirAtendimento.value = "";
    if (!ehSupervisor && setoresDisponiveis.length === 0) throw new Error("Não há setores ativos disponíveis.");
    if (ehSupervisor) filtrarAnalistasReplicacao();
    modalAbrirAtendimento.hidden = false;
  } catch (erro) {
    modoReplicarAtendimento = null;
    alert(erro.message);
    return;
  }
}

function filtrarAnalistasReplicacao() {
  if (usuarioAtual?.perfil !== "supervisor") return;
  let analistas = [];
  try { analistas = JSON.parse(analistaReplicarSelect.dataset.analistas || "[]"); } catch { }
  const setorId = Number(setorAbrirAtendimento.value);
  const valorAtual = analistaReplicarSelect.value;
  analistaReplicarSelect.replaceChildren(new Option("Deixar na fila do setor", ""));
  analistas.filter((a) => Number(a.setor_id) === setorId).forEach((a) => analistaReplicarSelect.add(new Option(a.nome, String(a.id))));
  if ([...analistaReplicarSelect.options].some((o) => o.value === valorAtual)) analistaReplicarSelect.value = valorAtual;
}

function fecharModalNovoAtendimento() {
  modalAbrirAtendimento.hidden = true;
  formAbrirAtendimento.reset();
  modoReplicarAtendimento = null;
  document.getElementById("novo-cliente-nome").readOnly = false;
  document.getElementById("novo-cliente-telefone").readOnly = false;
  document.getElementById("novo-cliente-cnpj").readOnly = false;
  mensagemAbrirAtendimento.textContent = "";
}

document.getElementById("abrir-atendimento-button").addEventListener("click", abrirModalNovoAtendimento);
document.getElementById("fechar-modal-abrir-atendimento").addEventListener("click", fecharModalNovoAtendimento);
document.getElementById("cancelar-abrir-atendimento").addEventListener("click", fecharModalNovoAtendimento);

formAbrirAtendimento.addEventListener("submit", async (event) => {
  event.preventDefault();
  mensagemAbrirAtendimento.textContent = "Abrindo atendimento...";
  mensagemAbrirAtendimento.className = "";

  const botao = document.getElementById("confirmar-abrir-atendimento");
  botao.disabled = true;

  const dados = new FormData(formAbrirAtendimento);
  const payload = {
    nome: String(dados.get("nome") || "").trim(),
    telefone: String(dados.get("telefone") || "").trim(),
    cnpj: String(dados.get("cnpj") || "").trim(),
    razaoSocial: String(dados.get("razaoSocial") || "").trim(),
    nomeFantasia: String(dados.get("nomeFantasia") || "").trim(),
    descricao: String(dados.get("descricao") || "").trim()
  };
  if (modoReplicarAtendimento) {
    payload.setorId = Number(dados.get("setorId"));
    if (usuarioAtual?.perfil === "supervisor" && dados.get("analistaId")) payload.analistaId = Number(dados.get("analistaId"));
  } else if (usuarioAtual?.perfil === "supervisor") {
    payload.setorId = Number(dados.get("setorId"));
  }

  try {
    const replicando = Boolean(modoReplicarAtendimento);
    const resultado = replicando
      ? await API.post(`/api/atendimentos/${encodeURIComponent(modoReplicarAtendimento)}/replicar`, payload)
      : await API.post("/api/atendimentos/abrir", payload);
    fecharModalNovoAtendimento();

    visualizacao = "fila";
    document.querySelectorAll(".nav-button").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === "fila");
    });
    document.getElementById("abrir-atendimento-button").hidden = false;
    inicioSection.hidden = true;
    usuariosSection.hidden = true;
    historicoSection.hidden = true;
    logsSection.hidden = true;
    ticketsSection.hidden = false;
    document.querySelector(".metrics").hidden = false;
    document.getElementById("refresh-button").hidden = false;
    title.textContent = "Fila de Atendimentos";
    sectionTitle.textContent = "Atendimentos disponíveis";

    await carregarChamados();
  } catch (erro) {
    mensagemAbrirAtendimento.textContent = erro.message;
    mensagemAbrirAtendimento.className = "error-message";
  } finally {
    botao.disabled = false;
    botao.textContent = modoReplicarAtendimento ? "Replicar atendimento" : "Abrir e iniciar atendimento";
  }
});


// Geração de relatórios diretamente na tela administrativa correspondente.
const modalRelatorio = document.getElementById("modal-gerar-relatorio");
const formRelatorio = document.getElementById("form-gerar-relatorio");
const nomeRelatorioInput = document.getElementById("nome-relatorio");
const formatoRelatorioSelect = document.getElementById("formato-relatorio");
const mensagemRelatorio = document.getElementById("mensagem-relatorio");
let tipoRelatorioSelecionado = null;
let filtrosRelatorioSelecionados = {};
const titulosRelatorio = {
  logs: "Tabela de Logs",
  historico: "Histórico de atendimentos",
  usuarios: "Gerenciar usuários"
};

function obterFiltrosAtuaisRelatorio(tipo) {
  if (tipo === "logs") {
    // Garante que os filtros digitados estejam aplicados à tabela antes de exportar.
    document.getElementById("aplicar-filtros-logs")?.click();
    const campos = [...document.querySelectorAll("#logs-lista [data-filtro-coluna-log]")];
    const nomes = ["data", "atendimento", "cliente", "usuario", "acao", "detalhes"];
    const filtros = {};
    campos.forEach((campo) => {
      const nome = nomes[Number(campo.dataset.filtroColunaLog)];
      if (nome) filtros[nome] = campo.value.trim();
    });
    return filtros;
  }
  if (tipo === "historico") {
    document.getElementById("aplicar-filtros-historico")?.click();
    const filtros = {};
    document.querySelectorAll("[data-filtro-historico]").forEach((campo) => {
      filtros[campo.dataset.filtroHistorico] = campo.value.trim();
    });
    return filtros;
  }
  if (tipo === "usuarios") {
    return {
      busca: document.getElementById("filtro-analistas")?.value.trim() || "",
      situacao: document.getElementById("filtro-situacao-analistas")?.value || "todos",
      setor: document.getElementById("filtro-setor-analistas")?.value || "todos"
    };
  }
  return {};
}

function abrirModalRelatorio(tipo) {
  if (usuarioAtual?.perfil !== "supervisor" || !titulosRelatorio[tipo]) return;
  tipoRelatorioSelecionado = tipo;
  filtrosRelatorioSelecionados = obterFiltrosAtuaisRelatorio(tipo);
  document.getElementById("modal-relatorio-titulo").textContent = `Relatório — ${titulosRelatorio[tipo]}`;
  document.getElementById("modal-relatorio-descricao").textContent = "Escolha o nome do arquivo e o formato para baixar os dados desta tabela.";
  formRelatorio.reset();
  formatoRelatorioSelect.value = "xlsx";
  nomeRelatorioInput.value = `${titulosRelatorio[tipo]} - ${new Date().toLocaleDateString("pt-BR").replaceAll("/", "-")}`;
  mensagemRelatorio.textContent = "";
  mensagemRelatorio.className = "";
  modalRelatorio.hidden = false;
  nomeRelatorioInput.focus();
  nomeRelatorioInput.select();
}

function fecharModalRelatorio() {
  modalRelatorio.hidden = true;
  tipoRelatorioSelecionado = null;
  filtrosRelatorioSelecionados = {};
  mensagemRelatorio.textContent = "";
}

document.querySelectorAll("[data-abrir-relatorio]").forEach((botao) => {
  botao.addEventListener("click", () => abrirModalRelatorio(botao.dataset.abrirRelatorio));
});
document.getElementById("fechar-modal-relatorio")?.addEventListener("click", fecharModalRelatorio);
document.getElementById("cancelar-relatorio")?.addEventListener("click", fecharModalRelatorio);

formRelatorio?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (usuarioAtual?.perfil !== "supervisor" || !tipoRelatorioSelecionado) return;

  const nome = nomeRelatorioInput.value.trim();
  const formato = formatoRelatorioSelect.value;
  if (!nome) {
    mensagemRelatorio.textContent = "Informe o nome que deseja usar no arquivo.";
    mensagemRelatorio.className = "error-message";
    nomeRelatorioInput.focus();
    return;
  }

  const botao = document.getElementById("confirmar-relatorio");
  botao.disabled = true;
  botao.textContent = "Gerando...";
  mensagemRelatorio.textContent = "Preparando o arquivo...";
  mensagemRelatorio.className = "";

  try {
    const token = sessionStorage.getItem("token");
    const parametros = new URLSearchParams({
      nome,
      filtros: JSON.stringify(filtrosRelatorioSelecionados || {})
    });
    const url = `/api/relatorios/${encodeURIComponent(tipoRelatorioSelecionado)}/${encodeURIComponent(formato)}?${parametros.toString()}`;
    const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.mensagem || erro.erro || "Não foi possível gerar o relatório.");
    }

    const arquivo = await resposta.blob();
    const extensao = formato === "pdf" ? "pdf" : "xlsx";
    const urlArquivo = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = urlArquivo;
    link.download = `${nome.replace(/[\\/:*?"<>|]/g, "-")}.${extensao}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(urlArquivo), 1000);
    mensagemRelatorio.textContent = "Relatório gerado e download iniciado.";
    mensagemRelatorio.className = "success-message";
    setTimeout(fecharModalRelatorio, 900);
  } catch (erro) {
    mensagemRelatorio.textContent = erro.message || "Falha ao gerar o relatório. Tente novamente.";
    mensagemRelatorio.className = "error-message";
  } finally {
    botao.disabled = false;
    botao.textContent = "Gerar arquivo";
  }
});

async function iniciarPainel() {
  if (!sessionStorage.getItem("token")) {
    window.location.href = "/";
    return;
  }

  try {
    await carregarPerfil();
    iniciarAtualizacoesTempoReal();

    if (usuarioAtual?.deve_redefinir_senha === true) {
      abrirModalTrocarSenha();
      return;
    }

    if (visualizacao === "inicio") {
      inicioSection.hidden = false;
      ticketsSection.hidden = true;
      document.querySelector(".metrics").hidden = true;
      document.getElementById("refresh-button").hidden = true;
      document.getElementById("abrir-atendimento-button").hidden = true;
      await carregarIndicadores();
    } else {
      await carregarChamados();
    }
  } catch (erro) {
    ticketList.replaceChildren(
      criarElemento("p", erro.message, "error-message")
    );

    document.getElementById("usuario-nome").textContent =
      "Não foi possível carregar o perfil";
  }
}

async function carregarSetores() {
  selectSetor.replaceChildren(
    new Option("Carregando setores...", "")
  );

  try {
    const resultado = await API.get("/api/analistas/setores");
    const setores = resultado.setores || [];
    setoresDisponiveis = setores;

    selectSetor.replaceChildren(
      new Option("Selecione um setor", "")
    );

    setores.forEach((setor) => {
      selectSetor.add(
        new Option(setor.nome, String(setor.id))
      );
    });

    if (setores.length === 0) {
      selectSetor.replaceChildren(
        new Option("Nenhum setor ativo encontrado", "")
      );
    }
  } catch (erro) {
    selectSetor.replaceChildren(
      new Option("Erro ao carregar setores", "")
    );

    throw erro;
  }
}

async function cadastrarAnalista(event) {
  event.preventDefault();

  mensagemAnalista.textContent = "";
  mensagemAnalista.className = "";

  const botao = document.getElementById("salvar-analista");
  const dados = new FormData(formAnalista);

  const analista = {
    nome: dados.get("nome").trim(),
    email: dados.get("email").trim(),
    username: dados.get("username").trim(),
    senha: dados.get("senha"),
    perfil: "analista",
    setorId: Number(dados.get("setorId"))
  };

  botao.disabled = true;
  botao.textContent = "Cadastrando...";

  try {
    const resultado = await API.post("/api/analistas", analista);

    mensagemAnalista.textContent =
      resultado.mensagem || "Analista cadastrado com sucesso.";
    mensagemAnalista.className = "success-message";

    formAnalista.reset();
    await carregarSetores();
    await carregarAnalistas();
  } catch (erro) {
    mensagemAnalista.textContent = erro.message;
    mensagemAnalista.className = "error-message";
  } finally {
    botao.disabled = false;
    botao.textContent = "Cadastrar analista";
  }
}


async function carregarAnalistas() {
  analistasLista.replaceChildren(
    criarElemento("p", "Carregando analistas...")
  );

  try {
    const resultado = await API.get("/api/analistas");
    const analistas = resultado.analistas || [];

    renderizarAnalistas(analistas);
  } catch (erro) {
    analistasLista.replaceChildren(
      criarElemento("p", erro.message, "error-message")
    );
  }
}

function abrirModalRedefinicaoSenha(nome, senhaTemporaria) {
  const modal = document.getElementById("modal-redefinir-senha");
  const usuario = document.getElementById("modal-redefinir-usuario");
  const senha = document.getElementById("senha-temporaria");
  const mensagem = document.getElementById("copiar-senha-mensagem");

  usuario.textContent = `Usuário: ${nome}`;
  senha.value = senhaTemporaria;
  mensagem.textContent = "";

  modal.hidden = false;
}

function fecharModalRedefinicaoSenha() {
  const modal = document.getElementById("modal-redefinir-senha");
  const senha = document.getElementById("senha-temporaria");
  const mensagem = document.getElementById("copiar-senha-mensagem");

  senha.value = "";
  mensagem.textContent = "";
  modal.hidden = true;
}

async function copiarSenhaTemporaria() {
  const senha = document.getElementById("senha-temporaria").value;
  const mensagem = document.getElementById("copiar-senha-mensagem");

  if (!senha) return;

  try {
    await navigator.clipboard.writeText(senha);
    mensagem.textContent = "Senha copiada.";
    mensagem.className = "success-message";
  } catch (erro) {
    mensagem.textContent =
      "Não foi possível copiar automaticamente. Selecione e copie a senha.";
    mensagem.className = "error-message";
  }
}

function abrirModalTrocarSenha() {
  const modal = document.getElementById("modal-trocar-senha");
  const form = document.getElementById("form-trocar-senha");
  const mensagem = document.getElementById("mensagem-trocar-senha");

  form.reset();
  mensagem.textContent = "";
  mensagem.className = "";

  modal.hidden = false;

  setTimeout(() => {
    document.getElementById("nova-senha").focus();
  }, 100);
}

document
  .getElementById("form-trocar-senha")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const novaSenha = document.getElementById("nova-senha").value;
    const confirmarNovaSenha =
      document.getElementById("confirmar-nova-senha").value;

    const mensagem = document.getElementById("mensagem-trocar-senha");
    const botao = event.target.querySelector("button[type='submit']");

    mensagem.textContent = "";
    mensagem.className = "";

    if (novaSenha.length < 4) {
      mensagem.textContent =
        "A nova senha deve ter pelo menos 4 caracteres.";
      mensagem.className = "error-message";
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      mensagem.textContent = "As senhas não conferem.";
      mensagem.className = "error-message";
      return;
    }

    botao.disabled = true;
    botao.textContent = "Alterando...";

    try {
      await API.post("/api/auth/trocar-minha-senha", {
        senha: novaSenha
      });

      mensagem.textContent = "Senha alterada com sucesso.";
      mensagem.className = "success-message";

      setTimeout(async () => {
        document.getElementById("modal-trocar-senha").hidden = true;
        if (visualizacao === "inicio") await carregarIndicadores();
      }, 800);
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "error-message";
    } finally {
      botao.disabled = false;
      botao.textContent = "Alterar senha";
    }
  });

function renderizarAnalistas(analistas) {
  listaAnalistasCompleta = Array.isArray(analistas) ? analistas : [];
  atualizarFiltroSetoresAnalistas();
  desenharTabelaAnalistas();
}

function atualizarFiltroSetoresAnalistas() {
  if (!filtroSetorAnalistas) return;
  const valorAtual = filtroSetorAnalistas.value || "todos";
  const setores = new Map();
  listaAnalistasCompleta.forEach((analista) => {
    if (analista.setor_id && analista.setor_nome) {
      setores.set(String(analista.setor_id), analista.setor_nome);
    }
  });
  filtroSetorAnalistas.replaceChildren(new Option("Todos os setores", "todos"));
  Array.from(setores.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .forEach(([id, nome]) => filtroSetorAnalistas.add(new Option(nome, id)));
  if ([...filtroSetorAnalistas.options].some((opcao) => opcao.value === valorAtual)) {
    filtroSetorAnalistas.value = valorAtual;
  }
}

function desenharTabelaAnalistas() {
  analistasLista.replaceChildren();
  const termo = (filtroAnalistas?.value || "").trim().toLocaleLowerCase("pt-BR");
  const situacaoFiltro = filtroSituacaoAnalistas?.value || "todos";
  const setorFiltro = filtroSetorAnalistas?.value || "todos";

  const filtrados = listaAnalistasCompleta.filter((analista) => {
    const busca = [analista.nome, analista.username, analista.email, analista.setor_nome]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    const correspondeTermo = !termo || busca.includes(termo);
    const ativo = analista.ativo === true;
    const correspondeSituacao = situacaoFiltro === "todos" ||
      (situacaoFiltro === "ativo" && ativo) ||
      (situacaoFiltro === "inativo" && !ativo);
    const correspondeSetor = setorFiltro === "todos" || String(analista.setor_id || "") === setorFiltro;
    return correspondeTermo && correspondeSituacao && correspondeSetor;
  });

  const totalPaginas = itensPorPaginaAnalistas === Infinity
    ? 1
    : Math.max(1, Math.ceil(filtrados.length / itensPorPaginaAnalistas));
  paginaAnalistas = Math.min(paginaAnalistas, totalPaginas);
  const inicio = itensPorPaginaAnalistas === Infinity ? 0 : (paginaAnalistas - 1) * itensPorPaginaAnalistas;
  const pagina = itensPorPaginaAnalistas === Infinity
    ? filtrados
    : filtrados.slice(inicio, inicio + itensPorPaginaAnalistas);
  const fim = filtrados.length === 0 ? 0 : (itensPorPaginaAnalistas === Infinity ? filtrados.length : Math.min(inicio + pagina.length, filtrados.length));

  if (analistasResumo) {
    const ativos = listaAnalistasCompleta.filter((item) => item.ativo === true).length;
    analistasResumo.textContent = `${listaAnalistasCompleta.length} analista(s) · ${ativos} ativo(s) · ${listaAnalistasCompleta.length - ativos} inativo(s) · ${filtrados.length} resultado(s)`;
  }

  if (!filtrados.length) {
    analistasLista.append(criarElemento("p", "Nenhum analista encontrado com os filtros selecionados."));
    return;
  }

  const tabelaWrapper = criarElemento("div", "", "analistas-tabela-wrapper");
  const tabela = criarElemento("table", "", "analistas-tabela");
  const thead = document.createElement("thead");
  const cabecalho = document.createElement("tr");
  ["Analista", "Login", "E-mail", "Setor", "Situação", "Ações"].forEach((texto) => {
    cabecalho.append(criarElemento("th", texto));
  });
  thead.append(cabecalho);
  const tbody = document.createElement("tbody");

  pagina.forEach((analista) => {
    const linha = document.createElement("tr");
    linha.append(criarElemento("td", analista.nome || "Sem nome"));
    linha.append(criarElemento("td", analista.username || "Não informado"));
    linha.append(criarElemento("td", analista.email || "Não informado"));

    const setorCelula = document.createElement("td");
    const setorSelect = document.createElement("select");
    setorSelect.className = "analista-setor-select";
    setorSelect.setAttribute("aria-label", `Novo setor de ${analista.nome || "analista"}`);
    Array.from(selectSetor.options).filter((opcao) => opcao.value !== "").forEach((opcao) => {
      setorSelect.add(new Option(opcao.textContent, opcao.value));
    });
    setorSelect.value = String(analista.setor_id || "");
    const salvarSetor = criarElemento("button", "Salvar setor", "secondary-button analista-acao-secundaria");
    salvarSetor.type = "button";
    salvarSetor.disabled = setorSelect.options.length === 0;
    salvarSetor.addEventListener("click", async () => {
      const setorId = Number(setorSelect.value);
      if (!setorId) return alert("Selecione um setor válido.");
      salvarSetor.disabled = true;
      salvarSetor.textContent = "Salvando...";
      try {
        await API.post(`/api/analistas/${encodeURIComponent(analista.id)}/setor`, { setorId });
        await carregarAnalistas();
      } catch (erro) {
        alert(erro.message);
        salvarSetor.disabled = false;
        salvarSetor.textContent = "Salvar setor";
      }
    });
    setorCelula.append(setorSelect, salvarSetor);
    linha.append(setorCelula);

    const ativo = analista.ativo === true;
    const situacaoCelula = document.createElement("td");
    situacaoCelula.append(criarElemento("span", ativo ? "Ativo" : "Inativo", ativo ? "status-ativo" : "status-inativo"));
    linha.append(situacaoCelula);

    const acoes = criarElemento("td", "", "analista-acoes");
    const alterarSituacao = criarElemento("button", ativo ? "Desativar" : "Ativar", ativo ? "secondary-button" : "primary-button");
    alterarSituacao.type = "button";
    alterarSituacao.addEventListener("click", async () => {
      const novaSituacao = !ativo;
      if (!confirm(novaSituacao ? `Deseja ativar a conta de ${analista.nome}?` : `Deseja desativar a conta de ${analista.nome}?`)) return;
      alterarSituacao.disabled = true;
      alterarSituacao.textContent = "Atualizando...";
      try {
        await API.post(`/api/analistas/${encodeURIComponent(analista.id)}/situacao`, { ativo: novaSituacao });
        await carregarAnalistas();
      } catch (erro) {
        alert(erro.message);
        alterarSituacao.disabled = false;
        alterarSituacao.textContent = ativo ? "Desativar" : "Ativar";
      }
    });

    const redefinirSenha = criarElemento("button", "Redefinir senha", "secondary-button");
    redefinirSenha.type = "button";
    redefinirSenha.disabled = !ativo;
    redefinirSenha.title = ativo ? "Gerar senha temporária" : "Usuário inativo";
    redefinirSenha.addEventListener("click", async () => {
      if (!confirm(`Deseja realmente redefinir a senha de ${analista.nome}?\n\nUma nova senha temporária será gerada e a senha atual deixará de funcionar.`)) return;
      redefinirSenha.disabled = true;
      redefinirSenha.textContent = "Gerando...";
      try {
        const resultado = await API.post(`/api/analistas/${encodeURIComponent(analista.id)}/redefinir-senha`, {});
        abrirModalRedefinicaoSenha(analista.nome, resultado.senhaTemporaria);
      } catch (erro) {
        alert(erro.message);
      } finally {
        redefinirSenha.disabled = !ativo;
        redefinirSenha.textContent = "Redefinir senha";
      }
    });
    acoes.append(alterarSituacao, redefinirSenha);
    linha.append(acoes);
    tbody.append(linha);
  });

  tabela.append(thead, tbody);
  tabelaWrapper.append(tabela);
  analistasLista.append(tabelaWrapper);

  const paginacao = criarElemento("div", "", "analistas-paginacao");
  const resumoIntervalo = criarElemento("span", `Exibindo ${inicio + (filtrados.length ? 1 : 0)}–${fim} de ${filtrados.length} analista(s)`, "analistas-paginacao-resumo");
  const limiteLabel = document.createElement("label");
  limiteLabel.htmlFor = "quantidade-analistas";
  limiteLabel.textContent = "Por página:";
  const limiteSelect = document.createElement("select");
  limiteSelect.id = "quantidade-analistas";
  limiteSelect.setAttribute("aria-label", "Quantidade de analistas por página");
  [
    { texto: "10", valor: "10" },
    { texto: "20", valor: "20" },
    { texto: "50", valor: "50" },
    { texto: "Todos", valor: "todos" }
  ].forEach(({ texto, valor }) => limiteSelect.add(new Option(texto, valor)));
  limiteSelect.value = itensPorPaginaAnalistas === Infinity ? "todos" : String(itensPorPaginaAnalistas);
  limiteSelect.addEventListener("change", () => {
    itensPorPaginaAnalistas = limiteSelect.value === "todos" ? Infinity : Number(limiteSelect.value);
    paginaAnalistas = 1;
    desenharTabelaAnalistas();
  });
  const paginaInfo = criarElemento("span", `Página ${paginaAnalistas} de ${totalPaginas}`, "analistas-paginacao-pagina");
  const anterior = criarElemento("button", "Anterior", "secondary-button");
  anterior.type = "button";
  anterior.disabled = paginaAnalistas <= 1;
  anterior.addEventListener("click", () => { paginaAnalistas--; desenharTabelaAnalistas(); });
  const proxima = criarElemento("button", "Próxima", "secondary-button");
  proxima.type = "button";
  proxima.disabled = paginaAnalistas >= totalPaginas;
  proxima.addEventListener("click", () => { paginaAnalistas++; desenharTabelaAnalistas(); });
  const controles = criarElemento("div", "", "analistas-paginacao-controles");
  controles.append(paginaInfo, anterior, proxima);
  paginacao.append(resumoIntervalo, limiteLabel, limiteSelect, controles);
  analistasLista.append(paginacao);
}

[filtroAnalistas, filtroSituacaoAnalistas, filtroSetorAnalistas].forEach((controle) => {
  if (!controle) return;
  controle.addEventListener("input", () => { paginaAnalistas = 1; desenharTabelaAnalistas(); });
  controle.addEventListener("change", () => { paginaAnalistas = 1; desenharTabelaAnalistas(); });
});

// Limpa todos os critérios de busca da tela Gerenciar usuários.
document.getElementById("limpar-filtros-analistas")?.addEventListener("click", () => {
  if (filtroAnalistas) filtroAnalistas.value = "";
  if (filtroSituacaoAnalistas) filtroSituacaoAnalistas.value = "todos";
  if (filtroSetorAnalistas) filtroSetorAnalistas.value = "todos";
  paginaAnalistas = 1;
  desenharTabelaAnalistas();
});

document
  .getElementById("fechar-modal-redefinir")
  .addEventListener("click", fecharModalRedefinicaoSenha);

document
  .getElementById("ok-modal-redefinir")
  .addEventListener("click", fecharModalRedefinicaoSenha);

document
  .getElementById("copiar-senha-temporaria")
  .addEventListener("click", copiarSenhaTemporaria);


formAnalista.addEventListener("submit", cadastrarAnalista);

atualizarAnalistasBotao.addEventListener("click", carregarAnalistas);

abrirCadastroAnalistaBotao.addEventListener(
  "click",
  abrirModalCadastroAnalista
);

fecharCadastroAnalistaBotao.addEventListener(
  "click",
  fecharModalCadastroAnalista
);

cancelarCadastroAnalistaBotao.addEventListener(
  "click",
  fecharModalCadastroAnalista
);


chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!atendimentoSelecionado) {
    chatMensagemStatus.textContent =
      "Selecione um atendimento primeiro.";
    chatMensagemStatus.className = "error-message";
    return;
  }

  const conteudo = chatInput.value.trim();

  if (!conteudo) {
    return;
  }

  chatEnviar.disabled = true;
  chatInput.disabled = true;
  chatEnviar.textContent = "Enviando...";
  chatMensagemStatus.textContent = "";
  chatMensagemStatus.className = "";

  try {
    const mensagem = await API.post(
      `/api/atendimentos/${encodeURIComponent(
        atendimentoSelecionado.id
      )}/mensagens`,
      {
        conteudo
      }
    );

    if (mensagem) {
      mensagensAtendimento.push(mensagem);
    }

    chatInput.value = "";
    renderizarMensagens();
    chatInput.focus();
  } catch (erro) {
    chatMensagemStatus.textContent = erro.message;
    chatMensagemStatus.className = "error-message";
  } finally {
    chatEnviar.disabled = false;
    chatInput.disabled = false;
    chatEnviar.textContent = "Enviar";
  }
});


async function carregarHistorico() {
  historicoLista.replaceChildren(criarElemento("p", "Carregando atendimentos históricos..."));
  try {
    const resultado = await API.get("/api/atendimentos/historico");
    const atendimentos = Array.isArray(resultado.atendimentos) ? resultado.atendimentos : [];
    historicoLista.replaceChildren();
    historicoLista.classList.add("historico-lista-compacta");
    if (atendimentos.length === 0) {
      historicoLista.append(criarElemento("p", "Nenhum atendimento finalizado ou arquivado encontrado."));
      return;
    }
    atendimentos.forEach((atendimento) => {
      const card = criarElemento("article", "", "ticket-card historico-ticket-compacto");
      const dataFinalizacao = atendimento.finalizado_em ? new Date(atendimento.finalizado_em) : null;
      card.dataset.filtroId = String(atendimento.id || "").toLowerCase();
      card.dataset.filtroProtocolo = String(atendimento.protocolo || "").toLowerCase();
      card.dataset.filtroCliente = String(atendimento.usuario_nome || "").toLowerCase();
      card.dataset.filtroAnalista = String(atendimento.analista_nome || "").toLowerCase();
      card.dataset.filtroSetor = String(atendimento.setor_nome || "").toLowerCase();
      card.dataset.filtroData = dataFinalizacao && !Number.isNaN(dataFinalizacao.getTime()) ? `${dataFinalizacao.getFullYear()}-${String(dataFinalizacao.getMonth() + 1).padStart(2, "0")}-${String(dataFinalizacao.getDate()).padStart(2, "0")}` : "";
      const info = criarElemento("div", "", "historico-ticket-info");
      info.append(
        criarElemento("h3", `#${atendimento.id} · ${atendimento.protocolo || "Sem protocolo"}`),
        criarElemento("p", `${atendimento.usuario_nome || "Cliente não informado"} · ${atendimento.setor_nome || "Sem setor"}`),
        criarElemento("p", `Responsável: ${atendimento.analista_nome || "Não atribuído"} · ${atendimento.arquivado ? "Arquivado" : "Realizado"} · ${Number(atendimento.total_mensagens || 0)} mensagens`)
      );
      const acoes = criarElemento("div", "", "historico-ticket-acoes");
      const botao = criarElemento("button", "Visualizar conversa", "secondary-button");
      botao.type = "button";
      botao.addEventListener("click", async () => {
        modalHistorico.hidden = false;
        modalHistoricoTitulo.textContent = `Conversa do atendimento #${atendimento.id} · ${atendimento.protocolo || "Sem protocolo"}`;
        modalHistoricoMensagens.replaceChildren(criarElemento("p", "Carregando mensagens..."));
        botao.disabled = true;
        try {
          const conversa = await API.get(`/api/atendimentos/historico/${encodeURIComponent(atendimento.id)}/conversa`);
          const mensagens = Array.isArray(conversa.mensagens) ? conversa.mensagens : [];
          modalHistoricoMensagens.replaceChildren();
          if (!mensagens.length) {
            modalHistoricoMensagens.append(criarElemento("p", "Nenhuma mensagem encontrada."));
          } else {
            mensagens.forEach((mensagem) => {
              const bloco = criarElemento("div", "", `chat-mensagem ${obterClasseMensagem(mensagem)}`);
              bloco.append(
                criarElemento("span", obterNomeRemetente(mensagem), "chat-remetente"),
                criarElemento("p", mensagem.conteudo || "[Mensagem sem conteúdo]", "chat-conteudo"),
                criarElemento("span", mensagem.criado_em ? new Date(mensagem.criado_em).toLocaleString("pt-BR") : "Data não informada", "chat-horario")
              );
              if (mensagem.direcao === "interna") bloco.append(criarElemento("span", "Mensagem interna", "chat-remetente"));
              modalHistoricoMensagens.append(bloco);
            });
          }
        } catch (erro) {
          modalHistoricoMensagens.replaceChildren(criarElemento("p", erro.message, "error-message"));
        } finally {
          botao.disabled = false;
        }
      });
      acoes.append(botao);

      // O supervisor pode reabrir um atendimento realizado para que o analista
      // continue o trabalho. Atendimentos arquivados permanecem somente para consulta.
      if (atendimento.status === "realizado" && atendimento.arquivado !== true) {
        const botaoRetomar = criarElemento("button", "Voltar para Pendente", "secondary-button");
        botaoRetomar.type = "button";
        botaoRetomar.addEventListener("click", async () => {
          const confirmar = confirm(
            `Deseja voltar o atendimento #${atendimento.id} para Pendente? Ele sairá do histórico e voltará para Meus atendimentos do responsável.`
          );
          if (!confirmar) return;

          botaoRetomar.disabled = true;
          botaoRetomar.textContent = "Atualizando...";
          try {
            await API.patch(`/api/atendimentos/${encodeURIComponent(atendimento.id)}/status`, {
              status: "pendente"
            });
            await carregarHistorico();
          } catch (erro) {
            alert(erro.message || "Não foi possível reabrir o atendimento.");
            botaoRetomar.disabled = false;
            botaoRetomar.textContent = "Voltar para Pendente";
          }
        });
        acoes.append(botaoRetomar);
      }

      card.append(info, acoes);
      historicoLista.append(card);
    });
    aplicarFiltrosHistorico();
  } catch (erro) {
    historicoLista.replaceChildren(criarElemento("p", erro.message, "error-message"));
  }
}

let paginaHistorico = 1;
let tamanhoPaginaHistorico = 10;
function aplicarFiltrosHistorico() {
  const filtros = [...document.querySelectorAll("[data-filtro-historico]")];
  const cards = [...historicoLista.querySelectorAll(".historico-ticket-compacto")];
  const correspondentes = cards.filter((card) => filtros.every((campo) => {
    const valor = campo.value.trim().toLocaleLowerCase("pt-BR");
    if (!valor) return true;
    const chave = campo.dataset.filtroHistorico;
    const dado = card.dataset[`filtro${chave.charAt(0).toUpperCase()}${chave.slice(1)}`] || "";
    return campo.type === "date" ? dado === valor : dado.toLocaleLowerCase("pt-BR").includes(valor);
  }));
  const totalPaginas = tamanhoPaginaHistorico === "todos" ? 1 : Math.max(1, Math.ceil(correspondentes.length / Number(tamanhoPaginaHistorico)));
  paginaHistorico = Math.min(paginaHistorico, totalPaginas);
  const inicio = tamanhoPaginaHistorico === "todos" ? 0 : (paginaHistorico - 1) * Number(tamanhoPaginaHistorico);
  const fim = tamanhoPaginaHistorico === "todos" ? correspondentes.length : inicio + Number(tamanhoPaginaHistorico);
  const visiveis = new Set(correspondentes.slice(inicio, fim));
  cards.forEach((card) => { card.hidden = !visiveis.has(card); });
  const resumo = document.getElementById("historico-paginacao-resumo");
  const pagina = document.getElementById("historico-pagina-atual");
  const anterior = document.getElementById("historico-pagina-anterior");
  const proxima = document.getElementById("historico-pagina-proxima");
  if (resumo) resumo.textContent = `${correspondentes.length ? inicio + 1 : 0}–${Math.min(fim, correspondentes.length)} de ${correspondentes.length} registros`;
  if (pagina) pagina.textContent = `Página ${paginaHistorico} de ${totalPaginas}`;
  if (anterior) anterior.disabled = paginaHistorico <= 1;
  if (proxima) proxima.disabled = paginaHistorico >= totalPaginas;
}
document.getElementById("aplicar-filtros-historico")?.addEventListener("click", () => { paginaHistorico = 1; aplicarFiltrosHistorico(); });
document.getElementById("limpar-filtros-historico")?.addEventListener("click", () => {
  document.querySelectorAll("[data-filtro-historico]").forEach((campo) => { campo.value = ""; });
  paginaHistorico = 1;
  aplicarFiltrosHistorico();
});
document.getElementById("historico-tamanho-pagina")?.addEventListener("change", (event) => {
  tamanhoPaginaHistorico = event.target.value === "todos" ? "todos" : Number(event.target.value);
  paginaHistorico = 1; aplicarFiltrosHistorico();
});
document.getElementById("historico-pagina-anterior")?.addEventListener("click", () => { paginaHistorico = Math.max(1, paginaHistorico - 1); aplicarFiltrosHistorico(); });
document.getElementById("historico-pagina-proxima")?.addEventListener("click", () => { paginaHistorico += 1; aplicarFiltrosHistorico(); });

fecharModalHistorico?.addEventListener("click", () => { modalHistorico.hidden = true; });

async function carregarLogs() {
  logsLista.replaceChildren(criarElemento("p", "Carregando logs do sistema..."));

  try {
    const resultado = await API.get("/api/atendimentos/logs");
    const registros = Array.isArray(resultado.logs) ? resultado.logs : [];
    logsLista.replaceChildren();

    if (registros.length === 0) {
      logsLista.append(criarElemento("p", "Nenhum registro de auditoria encontrado."));
      return;
    }

    const tabelaWrapper = criarElemento("div", "", "analistas-tabela-wrapper");
    const tabela = criarElemento("table", "", "analistas-tabela");
    const thead = document.createElement("thead");
    const linhaCabecalho = document.createElement("tr");
    ["Data e hora", "Atendimento", "Cliente", "Usuário responsável", "Ação", "Detalhes"].forEach(
      (texto) => linhaCabecalho.append(criarElemento("th", texto))
    );
    thead.append(linhaCabecalho);
    const linhaFiltros = document.createElement("tr");
    linhaFiltros.className = "filtros-logs-linha";
    ["data", "atendimento", "cliente", "usuario", "acao", "detalhes"].forEach((campo, indice) => {
      const th = document.createElement("th");
      const input = document.createElement("input");
      input.type = "search";
      input.placeholder = "Filtrar...";
      input.setAttribute("aria-label", `Filtrar coluna ${["Data e hora", "Atendimento", "Cliente", "Usuário responsável", "Ação", "Detalhes"][indice]}`);
      input.dataset.filtroColunaLog = String(indice);
      th.append(input); linhaFiltros.append(th);
    });
    thead.append(linhaFiltros);

    const tbody = document.createElement("tbody");
    let paginaLogs = 1;
    let tamanhoPaginaLogs = 10;

    const nomesAcoes = {
      atendimento_criado: "Atendimento criado",
      atendimento_assumido: "Atendimento assumido",
      atendimento_atribuido: "Atendimento atribuído",
      atendimento_devolvido: "Devolvido à fila",
      atendimento_transferido: "Transferência de setor",
      status_alterado: "Alteração de status",
      mensagem_enviada: "Mensagem enviada",
      mensagem_recebida: "Mensagem recebida"
    };

    function formatarContexto(contexto) {
      if (!contexto || typeof contexto !== "object") {
        return "Sem detalhes adicionais";
      }

      return Object.entries(contexto)
        .map(([chave, valor]) => {
          const nome = chave
            .replaceAll("_", " ")
            .replace(/^./, letra => letra.toUpperCase());

          const conteudo = typeof valor === "object" && valor !== null
            ? JSON.stringify(valor)
            : String(valor);

          return `${nome}: ${conteudo}`;
        })
        .join(" · ");
    }

    registros.forEach((registro) => {
      const linha = document.createElement("tr");

      const data = registro.criado_em
        ? new Date(registro.criado_em).toLocaleString("pt-BR")
        : "Data não informada";

      const atendimento = registro.atendimento_id
        ? `#${registro.atendimento_id}${registro.protocolo ? ` · ${registro.protocolo}` : ""}`
        : "Sem atendimento vinculado";

      const cliente = registro.cliente_nome ||
        (registro.contexto?.usuario_cliente_id
          ? `Cliente #${registro.contexto.usuario_cliente_id}`
          : "Não identificado");

      const responsavel = registro.usuario_sistema_nome || "Sistema";

      const acao = nomesAcoes[registro.evento] ||
        registro.evento ||
        "Ação não identificada";

      const detalhes = [
        registro.mensagem,
        registro.origem ? `Origem: ${registro.origem}` : "",
        registro.nivel ? `Nível: ${registro.nivel}` : "",
        formatarContexto(registro.contexto)
      ].filter(Boolean).join(" · ");

      [
        data,
        atendimento,
        cliente,
        responsavel,
        acao,
        detalhes
      ].forEach((texto) => {
        linha.append(criarElemento("td", texto));
      });

      tbody.append(linha);
    });


    tabela.append(thead, tbody);
    tabelaWrapper.append(tabela);
    logsLista.append(tabelaWrapper);

    const aplicarFiltrosLogs = () => {
      const filtros = [...tabela.querySelectorAll("[data-filtro-coluna-log]")];
      const linhas = [...tbody.rows];
      const correspondentes = linhas.filter((row) => filtros.every((f) => {
        const valor = f.value.trim().toLocaleLowerCase("pt-BR");
        return !valor || (row.cells[Number(f.dataset.filtroColunaLog)]?.textContent || "").toLocaleLowerCase("pt-BR").includes(valor);
      }));
      const totalPaginas = tamanhoPaginaLogs === "todos" ? 1 : Math.max(1, Math.ceil(correspondentes.length / Number(tamanhoPaginaLogs)));
      paginaLogs = Math.min(paginaLogs, totalPaginas);
      const inicio = tamanhoPaginaLogs === "todos" ? 0 : (paginaLogs - 1) * Number(tamanhoPaginaLogs);
      const fim = tamanhoPaginaLogs === "todos" ? correspondentes.length : inicio + Number(tamanhoPaginaLogs);
      const visiveis = new Set(correspondentes.slice(inicio, fim));
      linhas.forEach((row) => { row.hidden = !visiveis.has(row); });
      const resumo = document.getElementById("logs-paginacao-resumo");
      const pagina = document.getElementById("logs-pagina-atual");
      const anterior = document.getElementById("logs-pagina-anterior");
      const proxima = document.getElementById("logs-pagina-proxima");
      if (resumo) resumo.textContent = `${correspondentes.length ? inicio + 1 : 0}–${Math.min(fim, correspondentes.length)} de ${correspondentes.length} registros`;
      if (pagina) pagina.textContent = `Página ${paginaLogs} de ${totalPaginas}`;
      if (anterior) anterior.disabled = paginaLogs <= 1;
      if (proxima) proxima.disabled = paginaLogs >= totalPaginas;
    };
    const botaoAplicarLogs = document.getElementById("aplicar-filtros-logs");
    if (botaoAplicarLogs) botaoAplicarLogs.onclick = () => { paginaLogs = 1; aplicarFiltrosLogs(); };
    const botaoLimparLogs = document.getElementById("limpar-filtros-logs");
    if (botaoLimparLogs) botaoLimparLogs.onclick = () => {
      tabela.querySelectorAll("[data-filtro-coluna-log]").forEach((campo) => { campo.value = ""; });
      paginaLogs = 1; aplicarFiltrosLogs();
    };
    document.getElementById("logs-tamanho-pagina")?.addEventListener("change", (event) => {
      tamanhoPaginaLogs = event.target.value === "todos" ? "todos" : Number(event.target.value);
      paginaLogs = 1; aplicarFiltrosLogs();
    }, { once: true });
    document.getElementById("logs-pagina-anterior")?.addEventListener("click", () => { paginaLogs = Math.max(1, paginaLogs - 1); aplicarFiltrosLogs(); }, { once: true });
    document.getElementById("logs-pagina-proxima")?.addEventListener("click", () => { paginaLogs += 1; aplicarFiltrosLogs(); }, { once: true });
    aplicarFiltrosLogs();
  } catch (erro) {
    logsLista.replaceChildren(criarElemento("p", erro.message, "error-message"));
  }
}

iniciarPainel();