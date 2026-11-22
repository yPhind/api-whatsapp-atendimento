require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const configurarSockets = require("./realtime/socketServer");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false }
});

app.set("io", io);
configurarSockets(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
