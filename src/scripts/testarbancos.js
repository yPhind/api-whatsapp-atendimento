
require("dotenv").config();

const bancos = require("../config/database");

async function testarConexoes() {
  const conexoes = [
    ["Atendimento", bancos.atendimento],
    ["Clientes", bancos.clientes],
    ["Tarefas", bancos.tarefas],
    ["Logs", bancos.logs]
  ];

  let houveErro = false;

  try {
    for (const [nome, pool] of conexoes) {
      try {
        const resultado = await pool.query(
          "SELECT current_database() AS banco"
        );

        console.log(
          `[OK] ${nome}: ${resultado.rows[0].banco}`
        );
      } catch (error) {
        houveErro = true;

        console.error(
          `[ERRO] ${nome}: ${error.message}`
        );
      }
    }
  } finally {
    await Promise.all(
      conexoes.map(([, pool]) => pool.end())
    );
  }

  if (houveErro) {
    process.exitCode = 1;
  }
}

testarConexoes();
