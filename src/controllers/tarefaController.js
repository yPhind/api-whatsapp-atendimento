const empresaRepository = require("../repositories/empresaRepository");
const fs = require("fs");
const path = require("path");
const repo = require("../repositories/tarefaRepository");

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
    !dataValida(dataPrevista)
  ) {
    throw erroHttp(
      "Confira o título, a observação e a data prevista."
    );
  }

  return {
    titulo,
    observacao,
    dataPrevista,
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

  const ids = [
    ...new Set(
      tarefas
        .map(t => t.empresa_id)
        .filter(id => id !== null && id !== undefined)
        .map(Number)
    )
  ];

  if (!ids.length) {
    return tarefas.map(t => ({
      ...t,
      empresa: null
    }));
  }

  const empresas = await empresaRepository.buscarPorIds(ids);

  const empresasPorId = new Map(
    empresas.map(empresa => [String(empresa.id), empresa])
  );

  return tarefas.map(t => ({
    ...t,
    empresa: t.empresa_id
      ? empresasPorId.get(String(t.empresa_id)) || null
      : null
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

async function listar(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);

    const tarefas = await repo.listarPorUsuario(
      usuarioId,
      false
    );

    const tarefasComEmpresas = await incluirDadosEmpresas(tarefas);

    res.json({ tarefas: tarefasComEmpresas });
  } catch (erro) {
    next(erro);
  }
}

async function realizadas(req, res, next) {
  try {
    const usuarioId = obterUsuarioId(req);

    const tarefas = await repo.listarPorUsuario(
      usuarioId,
      true
    );

    const tarefasComEmpresas = await incluirDadosEmpresas(tarefas);

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
  criar,
  atualizar,
  finalizar,
  reabrir,
  anexar,
  baixarAnexo,
  visualizarAnexo,
  removerAnexo
};
