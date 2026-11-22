
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const configurarSockets = require("./realtime/socketServer");
const { encerrarPools } = require("./config/database");

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: false
  }
});

app.set("io", io);

configurarSockets(io);

let encerrando = false;

async function encerrarServidor(sinal) {
  if (encerrando) return;

  encerrando = true;

  console.log(
    `\n[SERVER] Sinal ${sinal} recebido. Encerrando aplicação...`
  );

  server.close(async (erro) => {
    if (erro) {
      console.error(
        "[SERVER] Erro ao encerrar servidor HTTP:",
        erro.message
      );
    }

    try {
      await encerrarPools();

      console.log("[SERVER] Aplicação encerrada corretamente.");

      process.exitCode = erro ? 1 : 0;
    } catch (erroBanco) {
      console.error(
        "[SERVER] Erro ao encerrar conexões:",
        erroBanco.message
      );

      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => {
  encerrarServidor("SIGINT");
});

process.once("SIGTERM", () => {
  encerrarServidor("SIGTERM");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] Servidor rodando na porta ${PORT}`);
});
