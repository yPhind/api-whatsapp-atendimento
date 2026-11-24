const empresaRepository = require("../repositories/empresaRepository");
const fs = require("fs");
const path = require("path");
const repo = require("../repositories/tarefaRepository");
const usuarioSistemaRepository = require("../repositories/usuarioSistemaRepository");

function dataValida(data) {
  if (!data) return true;

  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data)
  ) {
    return false;
  }

  const convertida = new Date(`${data}T00:00:00Z`);

  return (
    !Number.isNaN(convertida.getTime()) &&
    convertida.toISOString().slice(0, 10) === data
  );
}

function validar(body = {}) {
  const titulo = String(body.titulo || "").trim();
  const observacao = String(body.observacao || "").trim();
  const dataPrevista = body.dataPrevista || null;
  const severidade = String(body.severidade || "normal").toLowerCase();
  const severidadesValidas = ["normal", "moderada", "urgente", "grave"];

  let empresaId = null;

  if (
    body.empresaId !== undefined &&
    body.empresaId !== null &&
    body.empresaId !== ""
  ) {
    empresaId = Number(body.empresaId);

    if (!Number.isSafeInteger(empresaId) || empresaId <= 0) {
      throw erroHttp("Empresa selecionada inválida.");
    }
  }

  if (
    !titulo ||
    titulo.length > 64 ||
    !observacao ||
    !dataValida(dataPrevista) ||
    !severidadesValidas.includes(severidade)
  ) {
    throw erroHttp(
      "Confira o título, a observação, a data prevista e a severidade."
    );
  }

  return {
    titulo,
    observacao,
    dataPrevista,
    severidade,
    empresaId
  };
}

const DIRETORIO_ANEXOS = path.resolve(
  process.cwd(),
  "storage",
  "tarefas"
);

const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];

function erroHttp(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

async function limparArquivos(files = []) {
  await Promise.all(
    files.map(async (file) => {
      if (!file?.path) return;

      try {
        await fs.promises.unlink(file.path);
      } catch (erro) {
        if (erro.code !== "ENOENT") {
          console.error(
            "[TAREFAS] Falha ao limpar arquivo temporário:",
            erro.message
          );
        }
      }
    })
  );
}

function obterUsuarioId(req) {
  const usuarioId = Number(req.usuarioSistema?.id);

  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    throw erroHttp("Usuário autenticado inválido.", 401);
  }

  return usuarioId;
}

function obterIdParametro(valor, nome) {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw erroHttp(`${nome} inválido.`);
  }

  return id;
}

async function validarEmpresa(empresaId) {
  if (!empresaId) return null;

  const empresa = await empresaRepository.buscarPorId(empresaId);

  if (!empresa || empresa.status !== "Ativa") {
    throw erroHttp(
      "A empresa selecionada não existe ou está inativa."
    );
  }

  return empresa.id;
}

async function incluirDadosEmpresas(tarefas) {
  if (!tarefas.length) return tarefas;

  const ids = [...new Set(
    tarefas
      .map(tarefa => tarefa.empresa_id)
      .filter(id => id !== null && id !== undefined)
      .map(Number)
  )];

  if (!ids.length) {
    return tarefas.map(tarefa => ({ ...tarefa, empresa: null }));
  }

  const empresas = await empresaRepository.buscarPorIds(ids);
  const empresasPorId = new Map(
    empresas.map(empresa => [String(empresa.id), empresa])
  );

  return tarefas.map(tarefa => ({
    ...tarefa,
    empresa: tarefa.empresa_id
      ? empresasPorId.get(String(tarefa.empresa_id)) || null
      : null
  }));
}

async function incluirDadosCriadores(tarefas) {
  if (!tarefas.length) return tarefas;

  const ids = [...new Set(
    tarefas
      .map(tarefa => Number(tarefa.usuario_id))
      .filter(id => Number.isSafeInteger(id) && id > 0)
  )];

  const usuarios = await Promise.all(
    ids.map(id => usuarioSistemaRepository.buscarPorId(id))
  );

  const nomesPorId = new Map(
    usuarios.filter(Boolean).map(usuario => [String(usuario.id), usuario.nome])
  );

  return tarefas.map(tarefa => ({
    ...tarefa,
    criador_nome: nomesPorId.get(String(tarefa.usuario_id)) || null
  }));
}

async function listarEmpresas(req, res, next) {
  try {
    const empresas = await empresaRepository.listarAtivas();
    res.json({ empresas });
  } catch (erro) {
    next(erro);
  }
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatarDataImpressao(valor) {
  if (!valor) return "Não informada";
  const data = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(data.getTime())) return "Não informada";
  return data.toLocaleDateString("pt-BR");
}

async function imprimir(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);
    const ehSupervisor = req.usuarioSistema?.perfil === "supervisor";
    const idsTexto = String(req.query.ids || "");
    const ids = [...new Set(idsTexto.split(",").map(valor => {
      const id = Number(valor.trim());
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw erroHttp("Identificador de tarefa inválido.");
      }
      return id;
    }))];

    if (!ids.length || ids.length > 50) {
      throw erroHttp("Selecione entre 1 e 50 tarefas para imprimir.");
    }

    const tarefas = await repo.listarParaImpressao(ids, usuarioId, ehSupervisor);
    if (tarefas.length !== ids.length) {
      return res.status(404).json({ mensagem: "Uma ou mais tarefas não foram encontradas ou não estão disponíveis para seu usuário." });
    }

    const tarefasComEmpresas = await incluirDadosEmpresas(tarefas);
    const tarefasComDados = ehSupervisor
      ? await incluirDadosCriadores(tarefasComEmpresas)
      : tarefasComEmpresas;

    const paginas = tarefasComDados.map((tarefa, indice) => `
      <section class="pagina">
        <header><div class="sistema">SISTEMA DE ATENDIMENTO</div><h1>RELATÓRIO DE TAREFA</h1></header>
        <div class="campo"><strong>Tarefa</strong><div>${escaparHtml(tarefa.titulo)}</div></div>
        <div class="campo"><strong>Empresa vinculada</strong><div>${escaparHtml(tarefa.empresa?.razao_social || tarefa.empresa?.nome_fantasia || "Não vinculada")}</div></div>
        ${ehSupervisor ? `<div class="campo"><strong>Criada por</strong><div>${escaparHtml(tarefa.criador_nome || "Não identificado")}</div></div>` : ""}
        <div class="campo observacao"><strong>Observação</strong><div>${escaparHtml(tarefa.observacao).replace(/\r?\n/g, "<br>")}</div></div>
        <div class="campo"><strong>Data de início</strong><div>${escaparHtml(formatarDataImpressao(tarefa.criado_em))}</div></div>
        <div class="campo"><strong>Severidade</strong><div>${escaparHtml(tarefa.severidade || "normal")}</div></div>
        <div class="campo"><strong>Data prevista</strong><div>${escaparHtml(formatarDataImpressao(tarefa.data_prevista))}</div></div>
        <footer>Documento ${indice + 1} de ${tarefasComDados.length} · Gerado em ${new Date().toLocaleString("pt-BR")}</footer>
      </section>
    `).join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de tarefas</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;margin:0;background:#fff}.pagina{width:210mm;min-height:297mm;padding:22mm 20mm;margin:0 auto;position:relative;page-break-after:always}.pagina:last-child{page-break-after:auto}header{text-align:center;border-bottom:2px solid #333;padding-bottom:18px;margin-bottom:30px}.sistema{font-size:10px;letter-spacing:2px;color:#666}h1{font-size:21px;margin:12px 0 0}.campo{margin:0 0 22px;line-height:1.5}.campo strong{display:block;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:5px}.campo div{font-size:14px;white-space:normal;overflow-wrap:anywhere}.observacao{min-height:90px}.observacao div{white-space:normal;line-height:1.7}footer{position:absolute;bottom:18mm;left:20mm;right:20mm;border-top:1px solid #ddd;padding-top:10px;color:#777;font-size:10px;text-align:center}@page{size:A4;margin:0}@media print{body{margin:0}.pagina{margin:0;box-shadow:none}}
      </style></head><body>${paginas}<script>window.addEventListener('load',()=>window.print());</script></body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    res.send(html);
  } catch (erro) {
    next(erro);
  }
}

function obterFiltrosTarefas(req, ehSupervisor) {
  const empresaId = req.query.empresaId || null;
  const dataPrevista = req.query.dataPrevista || null;
  const analistaId = req.query.analistaId || null;

  if (empresaId) {
    const id = Number(empresaId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw erroHttp("Cliente selecionado inválido.");
    }
  }

  if (dataPrevista && !dataValida(dataPrevista)) {
    throw erroHttp("Data prevista inválida.");
  }

  let usuarioId = null;

  // Somente supervisor pode selecionar outro analista.
  if (ehSupervisor && analistaId) {
    usuarioId = obterIdParametro(analistaId, "Analista");
  }

  return {
    empresaId: empresaId ? Number(empresaId) : null,
    dataPrevista,
    usuarioId
  };
}

async function listar(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);
    const ehSupervisor =
      req.usuarioSistema?.perfil === "supervisor";

    const filtros = obterFiltrosTarefas(req, ehSupervisor);

    const tarefas = await repo.listarPorUsuario(
      usuarioId,
      false,
      ehSupervisor,
      filtros
    );

    let tarefasComEmpresas = await incluirDadosEmpresas(tarefas);

    if (ehSupervisor) {
      tarefasComEmpresas = await incluirDadosCriadores(
        tarefasComEmpresas
      );
    }

    res.json({ tarefas: tarefasComEmpresas });
  } catch (erro) {
    next(erro);
  }
}

async function realizadas(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);
    const ehSupervisor =
      req.usuarioSistema?.perfil === "supervisor";

    const filtros = obterFiltrosTarefas(req, ehSupervisor);

    const tarefas = await repo.listarPorUsuario(
      usuarioId,
      true,
      ehSupervisor,
      filtros
    );

    let tarefasComEmpresas = await incluirDadosEmpresas(tarefas);

    if (ehSupervisor) {
      tarefasComEmpresas = await incluirDadosCriadores(
        tarefasComEmpresas
      );
    }

    res.json({ tarefas: tarefasComEmpresas });
  } catch (erro) {
    next(erro);
  }
}

async function criar(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);
    const dados = validar(req.body);
    dados.empresaId = await validarEmpresa(dados.empresaId);
    const tarefa = await repo.criar({
      usuarioId,
      ...dados
    });

    res.status(201).json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function atualizar(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);
    const id = obterIdParametro(req.params.id, "Tarefa");
    const dados = validar(req.body);
    dados.empresaId = await validarEmpresa(dados.empresaId);
    const tarefa = await repo.atualizar({
      id,
      usuarioId,
      ...dados
    });

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function finalizar(req, res, next) {
  try {
    const id = obterIdParametro(req.params.id, "Tarefa");
    const usuarioId = obterUsuarioId(req);

    const tarefa = await repo.alterarStatus(
      id,
      usuarioId,
      "realizada"
    );

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function reabrir(req, res, next) {
  try {
    const id = obterIdParametro(req.params.id, "Tarefa");
    const usuarioId = obterUsuarioId(req);

    const tarefa = await repo.alterarStatus(
      id,
      usuarioId,
      "em_digitacao"
    );

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function anexar(req, res, next) {
  const files = req.files || [];

  try {
    const tarefaId = obterIdParametro(
      req.params.id,
      "Tarefa"
    );

    const usuarioId = obterUsuarioId(req);

    if (files.length === 0) {
      throw erroHttp("Selecione pelo menos um arquivo.");
    }

    for (const file of files) {
      if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
        throw erroHttp(
          "Tipo de arquivo não permitido. Utilize PDF, JPEG ou PNG."
        );
      }
    }

    // A propriedade e a situação da tarefa são verificadas
    // dentro da transação do repositório.
    const anexos = await repo.adicionarAnexos({
      tarefaId,
      usuarioId,
      arquivos: files
    });

    res.status(201).json({ anexos });
  } catch (erro) {
    await limparArquivos(files);
    next(erro);
  }
}

async function baixarAnexo(req, res, next) {
  try {
    const anexoId = obterIdParametro(
      req.params.anexoId,
      "Anexo"
    );

    const usuarioId = obterUsuarioId(req);

    const anexo = await repo.buscarAnexo(
      anexoId,
      usuarioId
    );

    if (!anexo) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    const arquivo = path.join(
      DIRETORIO_ANEXOS,
      path.basename(anexo.nome_arquivo)
    );

    res.download(arquivo, anexo.nome_original, (erro) => {
      if (erro && !res.headersSent) {
        next(erro);
      }
    });
  } catch (erro) {
    next(erro);
  }
}

async function visualizarAnexo(req, res, next) {
  try {
    const anexoId = obterIdParametro(
      req.params.anexoId,
      "Anexo"
    );

    const usuarioId = obterUsuarioId(req);

    const anexo = await repo.buscarAnexo(
      anexoId,
      usuarioId
    );

    if (!anexo) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    if (!TIPOS_PERMITIDOS.includes(anexo.mime_type)) {
      return res.status(415).json({
        mensagem: "Tipo de arquivo não permitido para visualização."
      });
    }

    const arquivo = path.join(
      DIRETORIO_ANEXOS,
      path.basename(anexo.nome_arquivo)
    );

    try {
      await fs.promises.access(arquivo);
    } catch {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado no armazenamento."
      });
    }

    res.setHeader("Content-Type", anexo.mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(anexo.nome_original)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.sendFile(arquivo, (erro) => {
      if (erro && !res.headersSent) {
        next(erro);
      }
    });
  } catch (erro) {
    next(erro);
  }
}

async function removerAnexo(req, res, next) {
  try {
    const anexoId = obterIdParametro(
      req.params.anexoId,
      "Anexo"
    );

    const usuarioId = obterUsuarioId(req);

    // Primeiro remove o registro, respeitando a propriedade.
    const removido = await repo.removerAnexo(
      anexoId,
      usuarioId
    );

    if (!removido) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    const arquivo = path.join(
      DIRETORIO_ANEXOS,
      path.basename(removido.nome_arquivo)
    );

    // A falha física não desfaz a exclusão já confirmada no banco.
    try {
      await fs.promises.unlink(arquivo);
    } catch (erroArquivo) {
      if (erroArquivo.code !== "ENOENT") {
        console.error(
          "[TAREFAS] Registro removido, mas houve falha ao excluir o arquivo:",
          erroArquivo.message
        );
      }
    }

    res.json({
      mensagem: "Anexo removido com sucesso."
    });
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  listar,
  realizadas,
  listarEmpresas,
  imprimir,
  criar,
  atualizar,
  finalizar,
  reabrir,
  anexar,
  baixarAnexo,
  visualizarAnexo,
  removerAnexo,
  obterFiltrosTarefas,
  incluirDadosEmpresas,
  incluirDadosCriadores
};
