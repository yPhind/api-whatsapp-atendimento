const service = require("../services/tarefaService");

const STATUS = {
  EM_DIGITACAO: "em_digitacao",
  REALIZADA: "realizada"
};

const TIPOS_ANEXOS = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function validarId(valor, campo = "Identificador") {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw erro(`${campo} inválido.`);
  }

  return id;
}

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

function validarDados(dados = {}) {
  const titulo = String(dados.titulo || "").trim();
  const observacao = String(dados.observacao || "").trim();
  const dataPrevista = dados.dataPrevista || null;

  if (!titulo || titulo.length > 64) {
    throw erro("O título é obrigatório e deve ter até 64 caracteres.");
  }

  if (!observacao) {
    throw erro("A observação da tarefa é obrigatória.");
  }

  if (!dataValida(dataPrevista)) {
    throw erro("A data prevista informada é inválida.");
  }

  return {
    titulo,
    observacao,
    dataPrevista
  };
}

async function listarPorUsuario(usuarioId, realizadas = false) {
  const id = validarId(usuarioId, "Usuário");
  return repo.listarPorUsuario(id, Boolean(realizadas));
}

async function criar({ usuarioId, ...dados }) {
  const id = validarId(usuarioId, "Usuário");
  const tarefa = validarDados(dados);

  return repo.criar({
    usuarioId: id,
    ...tarefa
  });
}

async function atualizar({ id, usuarioId, ...dados }) {
  const tarefaId = validarId(id, "Tarefa");
  const usuario = validarId(usuarioId, "Usuário");
  const tarefa = validarDados(dados);

  return repo.atualizar({
    id: tarefaId,
    usuarioId: usuario,
    ...tarefa
  });
}

async function finalizar(id, usuarioId) {
  return repo.alterarStatus(
    validarId(id, "Tarefa"),
    validarId(usuarioId, "Usuário"),
    STATUS.REALIZADA
  );
}

async function reabrir(id, usuarioId) {
  return repo.alterarStatus(
    validarId(id, "Tarefa"),
    validarId(usuarioId, "Usuário"),
    STATUS.EM_DIGITACAO
  );
}

async function adicionarAnexos({ tarefaId, usuarioId, arquivos }) {
  const id = validarId(tarefaId, "Tarefa");
  const usuario = validarId(usuarioId, "Usuário");

  if (!Array.isArray(arquivos) || arquivos.length === 0) {
    throw erro("Selecione pelo menos um arquivo.");
  }

  for (const arquivo of arquivos) {
    if (!TIPOS_ANEXOS.includes(arquivo.mimetype)) {
      throw erro("Tipo de arquivo não permitido.");
    }
  }

  return repo.adicionarAnexos({
    tarefaId: id,
    usuarioId: usuario,
    arquivos
  });
}

async function buscarAnexo(id, usuarioId) {
  return repo.buscarAnexo(
    validarId(id, "Anexo"),
    validarId(usuarioId, "Usuário")
  );
}

async function removerAnexo(id, usuarioId) {
  return repo.removerAnexo(
    validarId(id, "Anexo"),
    validarId(usuarioId, "Usuário")
  );
}

module.exports = {
  STATUS,
  TIPOS_ANEXOS,
  validarDados,
  listarPorUsuario,
  criar,
  atualizar,
  finalizar,
  reabrir,
  adicionarAnexos,
  buscarAnexo,
  removerAnexo
};
