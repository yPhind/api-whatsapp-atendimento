
const fs = require("fs");
const path = require("path");

const repo = require("../repositories/tarefaRepository");
const logService = require("../services/logService");

function dataValida(data) {
  if (!data) return true;

  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data)
  ) {
    return false;
  }

  const dataConvertida = new Date(`${data}T00:00:00Z`);

  return (
    !Number.isNaN(dataConvertida.getTime()) &&
    dataConvertida.toISOString().slice(0, 10) === data
  );
}

function validar(body) {
  const titulo = String(body.titulo || "").trim();
  const observacao = String(body.observacao || "").trim();
  const dataPrevista = body.dataPrevista || null;

  if (
    !titulo ||
    titulo.length > 64 ||
    !observacao ||
    !dataValida(dataPrevista)
  ) {
    throw Object.assign(
      new Error("Confira título, observação e data prevista."),
      { status: 400 }
    );
  }

  return {
    titulo,
    observacao,
    dataPrevista
  };
}

async function limparArquivos(files = []) {
  await Promise.all(
    files.map(file =>
      fs.promises.unlink(file.path).catch(() => {})
    )
  );
}

async function registrarAuditoria({
  usuarioId,
  evento,
  mensagem,
  tarefaId = null,
  contexto = {}
}) {
  await logService.info({
    origem: "tarefaController",
    evento,
    mensagem,
    usuario_sistema_id: usuarioId,
    contexto: {
      tarefa_id: tarefaId,
      ...contexto
    }
  });
}

async function listar(req, res, next) {
  try {
    const tarefas = await repo.listarPorUsuario(
      req.usuarioSistema.id,
      false
    );

    res.json({ tarefas });
  } catch (erro) {
    next(erro);
  }
}

async function realizadas(req, res, next) {
  try {
    const tarefas = await repo.listarPorUsuario(
      req.usuarioSistema.id,
      true
    );

    res.json({ tarefas });
  } catch (erro) {
    next(erro);
  }
}

async function criar(req, res, next) {
  try {
    const dados = validar(req.body);

    const tarefa = await repo.criar({
      usuarioId: req.usuarioSistema.id,
      ...dados
    });

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_criada",
      mensagem: "Nova tarefa criada.",
      tarefaId: tarefa.id,
      contexto: {
        data_prevista: tarefa.data_prevista || null
      }
    });

    res.status(201).json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = validar(req.body);

    const tarefa = await repo.atualizar({
      id: Number(req.params.id),
      usuarioId: req.usuarioSistema.id,
      ...dados
    });

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada ou não está em digitação."
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_atualizada",
      mensagem: "Dados de uma tarefa foram atualizados.",
      tarefaId: tarefa.id,
      contexto: {
        data_prevista: tarefa.data_prevista || null
      }
    });

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function finalizar(req, res, next) {
  try {
    const tarefa = await repo.alterarStatus(
      Number(req.params.id),
      req.usuarioSistema.id,
      "realizada"
    );

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_finalizada",
      mensagem: "Tarefa marcada como realizada.",
      tarefaId: tarefa.id,
      contexto: {
        status_novo: tarefa.status
      }
    });

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function reabrir(req, res, next) {
  try {
    const tarefa = await repo.alterarStatus(
      Number(req.params.id),
      req.usuarioSistema.id,
      "em_digitacao"
    );

    if (!tarefa) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_reaberta",
      mensagem: "Tarefa reaberta para edição.",
      tarefaId: tarefa.id,
      contexto: {
        status_novo: tarefa.status
      }
    });

    res.json({ tarefa });
  } catch (erro) {
    next(erro);
  }
}

async function anexar(req, res, next) {
  const files = req.files || [];

  try {
    const tarefa = await repo.buscar(
      Number(req.params.id),
      req.usuarioSistema.id
    );

    if (!tarefa || tarefa.status !== "em_digitacao") {
      await limparArquivos(files);

      return res.status(404).json({
        mensagem: "Tarefa não encontrada ou não está em digitação."
      });
    }

    // Registra todos os anexos em uma única transação.
    const anexos = await repo.adicionarAnexos({
      tarefaId: tarefa.id,
      arquivos: files
    });

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_anexos_adicionados",
      mensagem: "Arquivos anexados à tarefa.",
      tarefaId: tarefa.id,
      contexto: {
        quantidade_anexos: anexos.length,
        anexos: anexos.map(anexo => ({
          anexo_id: anexo.id,
          mime_type: anexo.mime_type,
          tamanho: anexo.tamanho
        }))
      }
    });

    res.status(201).json({ anexos });
  } catch (erro) {
    await limparArquivos(files);
    next(erro);
  }
}

async function baixarAnexo(req, res, next) {
  try {
    const anexo = await repo.buscarAnexo(
      Number(req.params.anexoId),
      req.usuarioSistema.id
    );

    if (!anexo) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    const arquivo = path.join(
      process.cwd(),
      "storage",
      "tarefas",
      path.basename(anexo.nome_arquivo)
    );

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_anexo_baixado",
      mensagem: "Anexo de tarefa solicitado para download.",
      tarefaId: anexo.tarefa_id,
      contexto: {
        anexo_id: anexo.id
      }
    });

    res.download(arquivo, anexo.nome_original);
  } catch (erro) {
    next(erro);
  }
}

async function visualizarAnexo(req, res, next) {
  try {
    const anexo = await repo.buscarAnexo(
      Number(req.params.anexoId),
      req.usuarioSistema.id
    );

    if (!anexo) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    const arquivo = path.join(
      process.cwd(),
      "storage",
      "tarefas",
      path.basename(anexo.nome_arquivo)
    );

    if (!fs.existsSync(arquivo)) {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado no armazenamento."
      });
    }

    if (
      ![
        "application/pdf",
        "image/jpeg",
        "image/png"
      ].includes(anexo.mime_type)
    ) {
      return res.status(415).json({
        mensagem: "Tipo de arquivo não permitido para visualização."
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_anexo_visualizado",
      mensagem: "Anexo de tarefa solicitado para visualização.",
      tarefaId: anexo.tarefa_id,
      contexto: {
        anexo_id: anexo.id
      }
    });

    res.setHeader("Content-Type", anexo.mime_type);

    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(anexo.nome_original)}`
    );

    res.setHeader("X-Content-Type-Options", "nosniff");

    res.sendFile(arquivo);
  } catch (erro) {
    next(erro);
  }
}

async function removerAnexo(req, res, next) {
  try {
    const anexo = await repo.removerAnexo(
      Number(req.params.anexoId),
      req.usuarioSistema.id
    );

    if (!anexo) {
      return res.status(404).json({
        mensagem: "Anexo não encontrado."
      });
    }

    const arquivo = path.join(
      process.cwd(),
      "storage",
      "tarefas",
      path.basename(anexo.nome_arquivo)
    );

    try {
      await fs.promises.unlink(arquivo);
    } catch (erroArquivo) {
      if (erroArquivo.code !== "ENOENT") {
        console.error(
          "Erro ao remover arquivo:",
          erroArquivo.message
        );
      }
    }

    await registrarAuditoria({
      usuarioId: req.usuarioSistema.id,
      evento: "tarefa_anexo_removido",
      mensagem: "Anexo removido de uma tarefa.",
      tarefaId: anexo.tarefa_id,
      contexto: {
        anexo_id: anexo.id
      }
    });

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
  criar,
  atualizar,
  finalizar,
  reabrir,
  anexar,
  baixarAnexo,
  visualizarAnexo,
  removerAnexo
};
