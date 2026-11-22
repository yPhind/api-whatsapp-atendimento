
const { Pool } = require("pg");

function obterConfiguracao() {
  const obrigatorias = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD"
  ];

  const ausentes = obrigatorias.filter(
    (variavel) => !process.env[variavel]
  );

  if (ausentes.length > 0) {
    throw new Error(
      `Configurações ausentes no .env: ${ausentes.join(", ")}`
    );
  }

  const porta = Number(process.env.DB_PORT || 3051);

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("DB_PORT precisa ser uma porta válida.");
  }

  return {
    host: process.env.DB_HOST,
    port: porta,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  };
}

const configuracao = obterConfiguracao();

function criarPool(database, identificacao, max = 5) {
  if (!database) {
    throw new Error(
      `Banco não configurado: ${identificacao}. Verifique o arquivo .env.`
    );
  }

  const pool = new Pool({
    ...configuracao,
    database,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on("error", (error) => {
    console.error(
      `[DATABASE] Erro inesperado no banco ${identificacao}:`,
      error.message
    );
  });

  return pool;
}

const pools = {
  atendimento: criarPool(
    process.env.DB_ATENDIMENTO || process.env.DB_NAME,
    "Atendimento",
    10
  ),

  clientes: criarPool(
    process.env.DB_CLIENTES,
    "Clientes"
  ),

  tarefas: criarPool(
    process.env.DB_TAREFAS,
    "Tarefas"
  ),

  logs: criarPool(
    process.env.DB_LOGS,
    "Logs"
  )
};

async function encerrarPools() {
  const resultados = await Promise.allSettled(
    Object.entries(pools).map(async ([identificacao, pool]) => {
      await pool.end();

      console.log(
        `[DATABASE] Conexões encerradas: ${identificacao}`
      );
    })
  );

  const falhas = resultados.filter(
    (resultado) => resultado.status === "rejected"
  );

  if (falhas.length > 0) {
    throw new Error(
      `${falhas.length} pool(s) não puderam ser encerrados corretamente.`
    );
  }
}

module.exports = {
  ...pools,
  encerrarPools
};
