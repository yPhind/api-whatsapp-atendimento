require("dotenv").config();

const readline = require("readline");
const bcrypt = require("bcrypt");
const { atendimento } = require("../config/database");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function perguntar(pergunta) {
  return new Promise(resolve => rl.question(pergunta, resolve));
}

async function main() {
  try {
    const nome = (await perguntar("Nome do supervisor: ")).trim();
    const email = (await perguntar("E-mail: ")).trim().toLowerCase();
    const username = (await perguntar("Usuário: ")).trim().toLowerCase();
    const senha = await perguntar("Senha (mínimo 4 caracteres): ");

    if (!nome || !email || !username || senha.length < 4) {
      throw new Error("Dados inválidos ou senha muito curta.");
    }

    const existentes = await atendimento.query(
      `SELECT COUNT(*)::int AS total
         FROM wb_usuarios_sistema
        WHERE perfil = 'supervisor'`
    );

    if (existentes.rows[0].total > 0) {
      throw new Error(
        "Já existe um supervisor. Use o painel para cadastrar outros usuários."
      );
    }

    const senhaHash = await bcrypt.hash(senha, 4);

    const resultado = await atendimento.query(
      `INSERT INTO wb_usuarios_sistema
         (nome, email, username, senha_hash, perfil, setor_id)
       VALUES ($1, $2, $3, $4, 'supervisor', NULL)
       RETURNING id, nome, email, username, perfil`,
      [nome, email, username, senhaHash]
    );

    console.log("Supervisor criado:", resultado.rows[0]);
  } catch (erro) {
    console.error("Não foi possível criar o supervisor:", erro.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await atendimento.end();
  }
}

main();
