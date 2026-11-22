const { Pool } = require("pg");

function criarPool(database, identificacao, max = 5) {
  if (!database) {
    throw new Error(`Banco não configurado: ${identificacao}`);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3051),
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on("error", error => {
    console.error(`Erro no banco ${identificacao}:`, error.message);
  });

  return pool;
}

module.exports = {
  atendimento: criarPool(
    process.env.DB_ATENDIMENTO || process.env.DB_NAME,
    "Atendimento",
    10
  ),
  clientes: criarPool(process.env.DB_CLIENTES, "Clientes"),
  tarefas: criarPool(process.env.DB_TAREFAS, "Tarefas"),
  logs: criarPool(process.env.DB_LOGS, "Logs")
};