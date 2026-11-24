(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const criar = (tag, texto, classe) => {
    const el = document.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    if (classe) el.className = classe;
    return el;
  };

  const modulos = {
    inicio: "Início",
    fila: "Fila de atendimentos",
    meus: "Meus atendimentos",
    historico: "Histórico",
    logs: "Logs",
    clientes: "Clientes",
    usuarios: "Usuários",
    tarefas: "Tarefas"
  };

  let empresas = [];
  let papel = null;
  let analistas = [];
  let permissoesIndividuais = [];

  function mensagem(el, texto, tipo = "") {
    if (!el) return;
    el.textContent = texto;
    el.className = tipo;
  }

  function formatarCnpj(valor) {
    const n = String(valor || "").replace(/\D/g, "");
    if (n.length !== 14) return valor || "Não informado";
    return n.replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  function abrirPacotesEmpresa(empresa) {
    const overlay = criar("div", "", "cliente-pacotes-overlay");
    overlay.setAttribute("role", "presentation");
    const dialog = criar("div", "", "cliente-pacotes-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `Pacotes contratados - ${empresa.razao_social || empresa.nome_fantasia || "Cliente"}`);
    const topo = criar("div", "", "cliente-pacotes-topo");
    const titulo = criar("h3", "Pacotes contratados");
    const fechar = criar("button", "×", "cliente-pacotes-fechar");
    fechar.type = "button";
    fechar.setAttribute("aria-label", "Fechar janela de pacotes");
    fechar.addEventListener("click", () => overlay.remove());
    topo.append(titulo, fechar);
    dialog.append(topo, criar("p", empresa.razao_social || empresa.nome_fantasia || "Cliente", "cliente-pacotes-cliente"));
    const lista = criar("ul", "", "cliente-pacotes-lista");
    const pacotes = Array.isArray(empresa.modulos) ? empresa.modulos : [];
    if (!pacotes.length) {
      lista.append(criar("li", "Nenhum pacote contratado informado."));
    } else {
      pacotes.forEach((modulo) => lista.append(criar("li", modulo.nome || modulo.codigo || "Módulo sem identificação")));
    }
    dialog.append(lista);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.addEventListener("keydown", function esc(event) {
      if (event.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", esc); }
    });
    document.body.append(overlay);
    fechar.focus();
  }

  function renderizarClientes() {
    const corpo = $("clientes-lista");
    const resumo = $("clientes-resumo");
    if (!corpo) return;
    const termo = ($("clientes-busca")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const filtradas = empresas.filter((empresa) => {
      const texto = [
        empresa.cnpj, empresa.razao_social, empresa.nome_fantasia, empresa.status,
        empresa.chave, empresa.max_licencas, empresa.quantidade_notas,
        ...(Array.isArray(empresa.modulos) ? empresa.modulos.map((modulo) => modulo.nome) : [])
      ].filter((v) => v !== null && v !== undefined).join(" ").toLocaleLowerCase("pt-BR");
      return !termo || texto.includes(termo);
    });

    corpo.replaceChildren();
    if (resumo) resumo.textContent = `${filtradas.length} empresa(s) encontrada(s) · ${empresas.length} empresa(s) sincronizada(s)`;
    if (!filtradas.length) {
      corpo.append(criar("p", termo ? "Nenhum cliente corresponde à busca." : "Nenhum cliente sincronizado."));
      return;
    }

    const wrapper = criar("div", "", "analistas-tabela-wrapper clientes-tabela-wrapper");
    const tabela = criar("table", "", "analistas-tabela clientes-tabela");
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    ["Razão social", "Nome fantasia", "CNPJ", "Chave (dias)", "Status", "Licenças", "Quantidade de Notas", "Pacotes"].forEach((t) => trHead.append(criar("th", t)));
    trHead.append(criar("th", ""));
    thead.append(trHead);
    const tbody = document.createElement("tbody");

    filtradas.forEach((empresa) => {
      const tr = document.createElement("tr");
      const statusAtivo = Number(empresa.chave) > 0;
      const status = criar("span", statusAtivo ? "Ativo" : "Inativo", `cliente-status ${statusAtivo ? "ativo" : "inativo"}`);
      const chave = empresa.chave === null || empresa.chave === undefined || empresa.chave === "" ? "—" : String(empresa.chave);
      tr.append(
        criar("td", empresa.razao_social || "Não informada"),
        criar("td", empresa.nome_fantasia || "—"),
        criar("td", formatarCnpj(empresa.cnpj)),
        criar("td", chave),
        (() => { const td = document.createElement("td"); td.append(status); return td; })(),
        criar("td", empresa.max_licencas ?? "—"),
        criar("td", empresa.quantidade_notas === null || empresa.quantidade_notas === undefined || empresa.quantidade_notas === "" ? "—" : String(empresa.quantidade_notas))
      );
      const tdPacotes = criar("td", Array.isArray(empresa.modulos) && empresa.modulos.length ? `${empresa.modulos.length} pacote(s)` : "Não informado");
      tr.append(tdPacotes);
      const tdAcao = criar("td", "", "cliente-pacotes-acao");
      const botao = criar("button", "▣", "cliente-pacotes-botao");
      botao.type = "button";
      botao.title = "Visualizar pacotes contratados";
      botao.setAttribute("aria-label", `Visualizar pacotes contratados de ${empresa.razao_social || empresa.nome_fantasia || "cliente"}`);
      botao.addEventListener("click", () => abrirPacotesEmpresa(empresa));
      tdAcao.append(botao);
      tr.append(tdAcao);
      tbody.append(tr);
    });

    tabela.append(thead, tbody);
    wrapper.append(tabela);
    corpo.append(wrapper);
  }

  async function carregarClientes() {
    const corpo = $("clientes-lista");
    if (corpo) corpo.replaceChildren(criar("p", "Carregando clientes..."));
    try {
      const resposta = await API.get("/api/empresas");
      empresas = Array.isArray(resposta.empresas) ? resposta.empresas : [];
      renderizarClientes();
    } catch (erro) {
      if (corpo) corpo.replaceChildren(criar("p", erro.message || "Não foi possível carregar os clientes.", "error-message"));
    }
  }

  function agruparPorModulo(lista) {
    const grupos = new Map();
    lista.forEach((item) => {
      const modulo = item.modulo || item.codigo.split(".")[0];
      if (!grupos.has(modulo)) grupos.set(modulo, []);
      grupos.get(modulo).push(item);
    });
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }

  function montarTabelaPermissoes(lista, modo) {
    const area = $("permissoes-lista");
    if (!area) return;
    area.replaceChildren();

    agruparPorModulo(lista).forEach(([modulo, itens]) => {
      const grupo = criar("section", "", "permissao-grupo");
      grupo.append(criar("h3", modulos[modulo] || modulo));
      const tabela = criar("table", "", "analistas-tabela permissao-tabela");
      const thead = document.createElement("thead");
      const th = document.createElement("tr");
      ["Permissão", "Descrição", modo === "individual" ? "Acesso individual" : "Permitido no perfil"].forEach((t) => th.append(criar("th", t)));
      thead.append(th);
      const tbody = document.createElement("tbody");

      itens.forEach((item) => {
        const tr = document.createElement("tr");
        tr.append(criar("td", item.codigo), criar("td", item.descricao || item.acao || "—"));
        const td = document.createElement("td");
        if (modo === "individual") {
          const select = document.createElement("select");
          select.className = "permissao-individual-select";
          select.dataset.codigo = item.codigo;
          [
            ["null", "Herdar do perfil Analista"],
            ["true", "Liberar"],
            ["false", "Bloquear"]
          ].forEach(([value, label]) => select.add(new Option(label, value)));
          select.value = item.override === null ? "null" : String(item.override);
          td.append(select);
          const origem = criar("small", item.origem === "individual" ? "Configuração individual" : "Padrão do perfil");
          origem.className = "permissao-origem";
          td.append(origem);
        } else {
          const label = criar("label", "", "permissao-check-label");
          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = item.permitido === true;
          check.dataset.codigo = item.codigo;
          label.append(check, criar("span", "Liberada"));
          td.append(label);
        }
        tr.append(td);
        tbody.append(tr);
      });

      tabela.append(thead, tbody);
      grupo.append(tabela);
      area.append(grupo);
    });
  }

  async function carregarPerfilAnalista() {
    mensagem($("permissoes-mensagem"), "Carregando permissões do perfil...");
    try {
      const resposta = await API.get("/api/permissoes/analista");
      papel = resposta.papel;
      montarTabelaPermissoes(papel.permissoes || [], "papel");
      mensagem($("permissoes-mensagem"), `Perfil ${papel.nome}: ${papel.permissoes.filter(p => p.permitido).length} permissão(ões) liberada(s).`, "success-message");
    } catch (erro) {
      mensagem($("permissoes-mensagem"), erro.message, "error-message");
    }
  }

  async function salvarPerfilAnalista() {
    const checks = [...document.querySelectorAll("#permissoes-lista input[type=checkbox][data-codigo]")];
    const permissoes = checks.map((check) => ({ codigo: check.dataset.codigo, permitido: check.checked }));
    const botao = $("salvar-permissoes-perfil");
    botao.disabled = true;
    try {
      const resposta = await API.request("/api/permissoes/analista", { method: "PUT", body: JSON.stringify({ permissoes }) });
      papel = resposta.papel;
      montarTabelaPermissoes(papel.permissoes || [], "papel");
      mensagem($("permissoes-mensagem"), resposta.mensagem || "Permissões do perfil Analista salvas.", "success-message");
    } catch (erro) {
      mensagem($("permissoes-mensagem"), erro.message, "error-message");
    } finally {
      botao.disabled = false;
    }
  }

  async function carregarListaAnalistas() {
    const select = $("permissoes-analista");
    if (!select) return;
    try {
      const resposta = await API.get("/api/analistas");
      analistas = (resposta.analistas || []).filter((a) => a.perfil !== "supervisor");
      select.replaceChildren(new Option("Selecione um analista", ""));
      analistas.forEach((a) => select.add(new Option(`${a.nome} · ${a.ativo ? "Ativo" : "Inativo"}`, String(a.id))));
    } catch (erro) {
      mensagem($("permissoes-individual-mensagem"), erro.message, "error-message");
    }
  }

  async function carregarPermissoesIndividuais() {
    const id = $("permissoes-analista")?.value;
    const area = $("permissoes-individual-lista");
    if (!id) {
      area?.replaceChildren(criar("p", "Selecione um analista para visualizar as permissões."));
      return;
    }
    area?.replaceChildren(criar("p", "Carregando permissões individuais..."));
    try {
      const resposta = await API.get(`/api/permissoes/usuarios/${encodeURIComponent(id)}`);
      permissoesIndividuais = resposta.permissoes || [];
      montarTabelaPermissoesIndividuais(permissoesIndividuais);
      mensagem($("permissoes-individual-mensagem"), `Configuração de ${resposta.usuario?.nome || "analista"} carregada.`);
    } catch (erro) {
      area?.replaceChildren(criar("p", erro.message, "error-message"));
    }
  }

  function montarTabelaPermissoesIndividuais(lista) {
    const area = $("permissoes-individual-lista");
    if (!area) return;
    area.replaceChildren();
    agruparPorModulo(lista).forEach(([modulo, itens]) => {
      const grupo = criar("section", "", "permissao-grupo");
      grupo.append(criar("h3", modulos[modulo] || modulo));
      const tabela = criar("table", "", "analistas-tabela permissao-tabela");
      const thead = document.createElement("thead");
      const linha = document.createElement("tr");
      ["Permissão", "Descrição", "Acesso individual"].forEach((t) => linha.append(criar("th", t)));
      thead.append(linha);
      const tbody = document.createElement("tbody");
      itens.forEach((item) => {
        const tr = document.createElement("tr");
        tr.append(criar("td", item.codigo), criar("td", item.descricao || item.acao || "—"));
        const td = document.createElement("td");
        const select = document.createElement("select");
        select.className = "permissao-individual-select";
        select.dataset.codigo = item.codigo;
        [["null", "Herdar do perfil Analista"], ["true", "Liberar"], ["false", "Bloquear"]]
          .forEach(([value, label]) => select.add(new Option(label, value)));
        select.value = item.override === null ? "null" : String(item.override);
        td.append(select, criar("small", item.origem === "individual" ? "Configuração individual" : "Padrão do perfil", "permissao-origem"));
        tr.append(td);
        tbody.append(tr);
      });
      tabela.append(thead, tbody);
      grupo.append(tabela);
      area.append(grupo);
    });
  }

  async function salvarPermissoesIndividuais() {
    const id = $("permissoes-analista")?.value;
    if (!id) return mensagem($("permissoes-individual-mensagem"), "Selecione um analista.", "error-message");
    const permissoes = [...document.querySelectorAll("#permissoes-individual-lista select[data-codigo]")]
      .map((select) => ({
        codigo: select.dataset.codigo,
        permitido: select.value === "null" ? null : select.value === "true"
      }));
    const botao = $("salvar-permissoes-individuais");
    botao.disabled = true;
    try {
      const resposta = await API.request(`/api/permissoes/usuarios/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ permissoes }) });
      permissoesIndividuais = resposta.permissoes || [];
      montarTabelaPermissoesIndividuais(permissoesIndividuais);
      mensagem($("permissoes-individual-mensagem"), resposta.mensagem || "Permissões individuais salvas.", "success-message");
    } catch (erro) {
      mensagem($("permissoes-individual-mensagem"), erro.message, "error-message");
    } finally {
      botao.disabled = false;
    }
  }

  function abrirTela(view) {
    const secaoClientes = $("clientes-section");
    const secaoPermissoes = $("permissoes-section");
    const demais = [
      "inicio-section", "tickets-section", "tarefas-section", "usuarios-section",
      "historico-section", "logs-section"
    ];
    demais.forEach((id) => { if ($(id)) $(id).hidden = true; });
    if (secaoClientes) secaoClientes.hidden = view !== "clientes";
    if (secaoPermissoes) secaoPermissoes.hidden = view !== "permissoes";
    document.querySelector(".metrics")?.setAttribute("hidden", "");
    $("abrir-atendimento-button") && ($("abrir-atendimento-button").hidden = true);
    $("refresh-button") && ($("refresh-button").hidden = true);
    document.querySelectorAll(".nav-button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    if ($("view-title")) $("view-title").textContent = view === "clientes" ? "Clientes" : "Permissões";
    if (view === "clientes") carregarClientes();
    else {
      carregarPerfilAnalista();
      carregarListaAnalistas().then(carregarPermissoesIndividuais);
    }
  }

  document.addEventListener("click", (event) => {
    const botao = event.target.closest(".nav-button[data-view]");
    if (!botao || !["clientes", "permissoes"].includes(botao.dataset.view)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    abrirTela(botao.dataset.view);
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    $("clientes-busca")?.addEventListener("input", renderizarClientes);
    $("clientes-atualizar")?.addEventListener("click", carregarClientes);
    $("salvar-permissoes-perfil")?.addEventListener("click", salvarPerfilAnalista);
    $("permissoes-analista")?.addEventListener("change", carregarPermissoesIndividuais);
    $("salvar-permissoes-individuais")?.addEventListener("click", salvarPermissoesIndividuais);
  });

  window.PainelClientesPermissoes = {
    carregarClientes,
    carregarPerfilAnalista,
    carregarPermissoesIndividuais
  };
})();
