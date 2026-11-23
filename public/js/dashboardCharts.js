(function () {
  const SERIES = [
    { key: "aguardando", label: "Aguardando", color: "#ef4444" },
    { key: "pendente", label: "Pendente", color: "#d97706" },
    { key: "em_atendimento", label: "Em atendimento", color: "#2563eb" },
    { key: "realizado", label: "Realizados", color: "#16a34a" }
  ];

  const SVG_NS = "http://www.w3.org/2000/svg";

  function elementoSvg(tag, atributos = {}, texto = null) {
    const elemento = document.createElementNS(SVG_NS, tag);
    Object.entries(atributos).forEach(([chave, valor]) => elemento.setAttribute(chave, String(valor)));
    if (texto !== null) elemento.textContent = texto;
    return elemento;
  }

  function criarSvg(viewBox, classe) {
    return elementoSvg("svg", {
      viewBox,
      role: "presentation",
      focusable: "false",
      class: classe || "inicio-svg-grafico",
      preserveAspectRatio: "xMidYMid meet"
    });
  }

  function textoSvg(svg, x, y, texto, atributos = {}) {
    svg.append(elementoSvg("text", {
      x, y,
      fill: atributos.fill || "#64748b",
      "font-size": atributos.fontSize || 12,
      "font-weight": atributos.fontWeight || 400,
      "text-anchor": atributos.anchor || "middle"
    }, texto));
  }

  function limparArea(id) {
    const area = document.getElementById(id);
    if (area) area.replaceChildren();
    return area;
  }

  function formatarMes(anoMes) {
    const [ano, mes] = String(anoMes).split("-").map(Number);
    const data = new Date(ano, (mes || 1) - 1, 1);
    return data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(" de ", "/").replace(".", "");
  }

  function renderizarBarras(setores) {
    const area = limparArea("grafico-atendimentos-setor");
    if (!area) return;
    if (!setores.length) {
      area.append(document.createTextNode("Nenhum setor disponível para exibir."));
      return;
    }

    const largura = 1000;
    const altura = 390;
    const margem = { top: 24, right: 24, bottom: 88, left: 58 };
    const plotW = largura - margem.left - margem.right;
    const plotH = altura - margem.top - margem.bottom;
    const maximo = Math.max(1, ...setores.flatMap((s) => SERIES.map((serie) => Number(s[serie.key] || 0))));
    const passo = Math.max(1, Math.ceil(maximo / 4));
    const topo = passo * 4;
    const svg = criarSvg(`0 0 ${largura} ${altura}`);

    for (let i = 0; i <= 4; i++) {
      const valor = topo - i * passo;
      const y = margem.top + (plotH * i / 4);
      svg.append(elementoSvg("line", { x1: margem.left, y1: y, x2: largura - margem.right, y2: y, stroke: "#e2e8f0", "stroke-width": 1 }));
      textoSvg(svg, margem.left - 12, y + 4, String(valor), { anchor: "end", fontSize: 11 });
    }

    const larguraGrupo = plotW / setores.length;
    const larguraBarra = Math.min(34, larguraGrupo * 0.15);
    const gap = Math.max(3, Math.min(8, larguraGrupo * 0.025));
    setores.forEach((setor, indice) => {
      const centro = margem.left + larguraGrupo * (indice + 0.5);
      const totalLargura = SERIES.length * larguraBarra + (SERIES.length - 1) * gap;
      SERIES.forEach((serie, j) => {
        const valor = Number(setor[serie.key] || 0);
        const h = (valor / topo) * plotH;
        const x = centro - totalLargura / 2 + j * (larguraBarra + gap);
        const y = margem.top + plotH - h;
        svg.append(elementoSvg("rect", { x, y, width: larguraBarra, height: Math.max(0, h), rx: 4, fill: serie.color }));
        if (valor > 0) textoSvg(svg, x + larguraBarra / 2, Math.max(13, y - 6), String(valor), { fontSize: 10, fill: "#334155", fontWeight: 600 });
      });
      const nome = String(setor.setor_nome || "Setor");
      const nomeCurto = nome.length > 22 ? `${nome.slice(0, 20)}…` : nome;
      textoSvg(svg, centro, margem.top + plotH + 24, nomeCurto, { fontSize: 12, fill: "#334155", fontWeight: 600 });
    });

    const legendaY = altura - 22;
    const larguraLegenda = 205;
    const inicioLegenda = (largura - SERIES.length * larguraLegenda) / 2;
    SERIES.forEach((serie, i) => {
      const x = inicioLegenda + i * larguraLegenda;
      svg.append(elementoSvg("rect", { x, y: legendaY - 10, width: 11, height: 11, rx: 2, fill: serie.color }));
      textoSvg(svg, x + 17, legendaY, serie.label, { anchor: "start", fontSize: 11, fill: "#475569" });
    });
    area.append(svg);
  }

  function caminhoFatia(cx, cy, raio, inicio, fim) {
    const x1 = cx + raio * Math.cos(inicio);
    const y1 = cy + raio * Math.sin(inicio);
    const x2 = cx + raio * Math.cos(fim);
    const y2 = cy + raio * Math.sin(fim);
    const grande = fim - inicio > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${raio} ${raio} 0 ${grande} 1 ${x2} ${y2} Z`;
  }

  function renderizarPizza(setores) {
    const area = limparArea("grafico-distribuicao-status");
    if (!area) return;
    const totais = SERIES.map((serie) => ({ ...serie, total: setores.reduce((soma, setor) => soma + Number(setor[serie.key] || 0), 0) }));
    const totalGeral = totais.reduce((soma, serie) => soma + serie.total, 0);
    const svg = criarSvg("0 0 620 320");
    const cx = 170, cy = 158, raio = 112;

    if (!totalGeral) {
      svg.append(elementoSvg("circle", { cx, cy, r: raio, fill: "none", stroke: "#e2e8f0", "stroke-width": 34 }));
      textoSvg(svg, cx, cy + 5, "Sem dados", { fontSize: 15, fill: "#64748b", fontWeight: 600 });
    } else {
      let angulo = -Math.PI / 2;
      totais.forEach((serie) => {
        if (!serie.total) return;
        const fim = angulo + (serie.total / totalGeral) * Math.PI * 2;
        svg.append(elementoSvg("path", { d: caminhoFatia(cx, cy, raio, angulo, fim), fill: serie.color, stroke: "#fff", "stroke-width": 2 }));
        angulo = fim;
      });
      svg.append(elementoSvg("circle", { cx, cy, r: 67, fill: "#fff" }));
      textoSvg(svg, cx, cy - 2, String(totalGeral), { fontSize: 29, fill: "#0f172a", fontWeight: 750 });
      textoSvg(svg, cx, cy + 20, "atendimentos", { fontSize: 11, fill: "#64748b" });
    }

    totais.forEach((serie, indice) => {
      const y = 92 + indice * 48;
      svg.append(elementoSvg("rect", { x: 340, y: y - 12, width: 13, height: 13, rx: 3, fill: serie.color }));
      textoSvg(svg, 363, y, serie.label, { anchor: "start", fontSize: 13, fill: "#334155", fontWeight: 600 });
      textoSvg(svg, 575, y, String(serie.total), { anchor: "end", fontSize: 13, fill: "#0f172a", fontWeight: 700 });
    });
    area.append(svg);
  }

  function renderizarLinhaPorSetor(mensal, setores) {
    const area = limparArea("graficos-mensais-setor");
    if (!area) return;
    area.replaceChildren();
    if (!setores.length) {
      area.append(document.createTextNode("Nenhum setor disponível para exibir."));
      return;
    }

    const meses = [...new Set(mensal.map((item) => item.mes))].sort();

    const ordemSetores = [
      "suporte expresso",
      "suporte tecnico",
      "treinamento",
      "financeiro"
    ];

    const normalizarNomeSetor = (nome) =>
      String(nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const setoresOrdenados = [...setores].sort((a, b) => {
      const indiceA = ordemSetores.indexOf(normalizarNomeSetor(a.setor_nome));
      const indiceB = ordemSetores.indexOf(normalizarNomeSetor(b.setor_nome));

      return (indiceA === -1 ? 999 : indiceA) -
        (indiceB === -1 ? 999 : indiceB);
    });

    setoresOrdenados.forEach((setor) => {
      const card = document.createElement("section");
      card.className = "inicio-mensal-setor";
      const titulo = document.createElement("h4");
      titulo.textContent = setor.setor_nome || "Setor";
      card.append(titulo);

      const svg = criarSvg("0 0 1000 350", "inicio-svg-grafico inicio-svg-linha");
      const margem = { top: 20, right: 24, bottom: 64, left: 58 };
      const plotW = 1000 - margem.left - margem.right;
      const plotH = 350 - margem.top - margem.bottom;
      const registrosSetor = mensal.filter((item) => Number(item.setor_id) === Number(setor.setor_id));
      const maximo = Math.max(1, ...registrosSetor.map((item) => Number(item.total || 0)));
      const passo = Math.max(1, Math.ceil(maximo / 4));
      const topo = passo * 4;

      for (let i = 0; i <= 4; i++) {
        const valor = topo - i * passo;
        const y = margem.top + plotH * i / 4;
        svg.append(elementoSvg("line", { x1: margem.left, y1: y, x2: 1000 - margem.right, y2: y, stroke: "#e2e8f0", "stroke-width": 1 }));
        textoSvg(svg, margem.left - 12, y + 4, String(valor), { anchor: "end", fontSize: 11 });
      }

      const x = (indice) => margem.left + (meses.length <= 1 ? plotW / 2 : (plotW * indice / (meses.length - 1)));
      const y = (valor) => margem.top + plotH - (Number(valor || 0) / topo) * plotH;

      SERIES.forEach((serie) => {
        const porMes = new Map(registrosSetor.filter((item) => item.status === serie.key).map((item) => [item.mes, Number(item.total || 0)]));
        const pontos = meses.map((mes, indice) => ({ mes, x: x(indice), y: y(porMes.get(mes) || 0), total: porMes.get(mes) || 0 }));
        const d = pontos.map((ponto, indice) => `${indice ? "L" : "M"} ${ponto.x} ${ponto.y}`).join(" ");
        svg.append(elementoSvg("path", { d, fill: "none", stroke: serie.color, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        pontos.forEach((ponto) => svg.append(elementoSvg("circle", { cx: ponto.x, cy: ponto.y, r: 4, fill: serie.color, stroke: "#fff", "stroke-width": 1.5 })));
      });

      meses.forEach((mes, indice) => {
        if (meses.length > 8 && indice % 2 !== 0) return;
        textoSvg(svg, x(indice), margem.top + plotH + 24, formatarMes(mes), { fontSize: 11, fill: "#475569" });
      });

      const legendaY = 338;
      const larguraLegenda = 205;
      const inicioLegenda = (1000 - SERIES.length * larguraLegenda) / 2;
      SERIES.forEach((serie, indice) => {
        const lx = inicioLegenda + indice * larguraLegenda;
        svg.append(elementoSvg("line", { x1: lx, y1: legendaY - 4, x2: lx + 18, y2: legendaY - 4, stroke: serie.color, "stroke-width": 3 }));
        textoSvg(svg, lx + 25, legendaY, serie.label, { anchor: "start", fontSize: 11, fill: "#475569" });
      });

      card.append(svg);
      area.append(card);
    });
  }

  function renderizar(indicadores) {
    const setores = Array.isArray(indicadores?.setores) ? indicadores.setores : [];
    const mensal = Array.isArray(indicadores?.mensal) ? indicadores.mensal : [];
    const totais = Object.fromEntries(SERIES.map((serie) => [serie.key, setores.reduce((soma, setor) => soma + Number(setor[serie.key] || 0), 0)]));

    const ids = {
      aguardando: "inicio-total-aguardando",
      pendente: "inicio-total-pendente",
      em_atendimento: "inicio-total-em-atendimento",
      realizado: "inicio-total-realizado"
    };
    Object.entries(ids).forEach(([status, id]) => {
      const elemento = document.getElementById(id);
      if (elemento) elemento.textContent = String(totais[status] || 0);
    });

    renderizarBarras(setores);
    renderizarPizza(setores);
    renderizarLinhaPorSetor(mensal, setores);
  }

  window.DashboardCharts = { renderizar };
})();
