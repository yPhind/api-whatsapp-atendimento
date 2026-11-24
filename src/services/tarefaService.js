const repo = require("../repositories/tarefaRepository");

const STATUS = {
  EM_DIGITACAO: "em_digitacao",
  REALIZADA: "realizada"
};

const TIPOS_ANEXOS = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];

const SEVERIDADES_VALIDAS = ["normal", "moderada", "urgente", "grave"];

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function validarId(valor, campo = "Identificador") {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id <= 0) throw erro(`${campo} inválido.`);
  return id;
}

function dataValida(data) {
  if (!data) return true;
  if (typeof data !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(data)) return false;
  const convertida = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(convertida.getTime()) && convertida.toISOString().slice(0, 10) === data;
}

function validarDados(dados = {}) {
  const titulo = String(dados.titulo || "").trim();
  const observacao = String(dados.observacao || "").trim();
  const dataPrevista = dados.dataPrevista || null;
  const severidade = String(dados.severidade || "normal").toLowerCase();
  const empresaId = dados.empresaId == null || dados.empresaId === "" ? null : validarId(dados.empresaId, "Empresa");

  if (!titulo || titulo.length > 64) throw erro("O título é obrigatório e deve ter até 64 caracteres.");
  if (!observacao) throw erro("A observação da tarefa é obrigatória.");
  if (!dataValida(dataPrevista)) throw erro("A data prevista informada é inválida.");
  if (!SEVERIDADES_VALIDAS.includes(severidade)) throw erro("A severidade informada é inválida.");

  return { titulo, observacao, dataPrevista, severidade, empresaId };
}

async function listarPorUsuario(usuarioId, realizadas = false, todosUsuarios = false, filtros = {}) {
  return repo.listarPorUsuario(validarId(usuarioId, "Usuário"), Boolean(realizadas), Boolean(todosUsuarios), filtros);
}

async function criar({ usuarioId, ...dados }) {
  return repo.criar({ usuarioId: validarId(usuarioId, "Usuário"), ...validarDados(dados) });
}

async function atualizar({ id, usuarioId, ...dados }) {
  return repo.atualizar({ id: validarId(id, "Tarefa"), usuarioId: validarId(usuarioId, "Usuário"), ...validarDados(dados) });
}

async function finalizar(id, usuarioId) {
  return repo.alterarStatus(validarId(id, "Tarefa"), validarId(usuarioId, "Usuário"), STATUS.REALIZADA);
}

async function reabrir(id, usuarioId) {
  return repo.alterarStatus(validarId(id, "Tarefa"), validarId(usuarioId, "Usuário"), STATUS.EM_DIGITACAO);
}

async function adicionarAnexos({ tarefaId, usuarioId, arquivos }) {
  validarId(tarefaId, "Tarefa");
  validarId(usuarioId, "Usuário");
  if (!Array.isArray(arquivos) || !arquivos.length) throw erro("Selecione pelo menos um arquivo.");
  for (const arquivo of arquivos) if (!TIPOS_ANEXOS.includes(arquivo.mimetype)) throw erro("Tipo de arquivo não permitido.");
  return repo.adicionarAnexos({ tarefaId, usuarioId, arquivos });
}

async function buscarAnexo(id, usuarioId) {
  return repo.buscarAnexo(validarId(id, "Anexo"), validarId(usuarioId, "Usuário"));
}

async function removerAnexo(id, usuarioId) {
  return repo.removerAnexo(validarId(id, "Anexo"), validarId(usuarioId, "Usuário"));
}

module.exports = {
  STATUS,
  TIPOS_ANEXOS,
  SEVERIDADES_VALIDAS,
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
