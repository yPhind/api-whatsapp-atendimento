/**
 * Gerencia conexões Socket.IO quando as permissões de um usuário mudam.
 */
async function desconectarUsuario(io, usuarioId, motivo = "sessao_encerrada") {
  const id = Number(usuarioId);
  if (!io || !Number.isInteger(id) || id <= 0) return;

  const sockets = await io.in(`usuario:${id}`).fetchSockets();
  for (const socket of sockets) {
    // O evento explícito permite ao navegador limpar o token e sair do painel.
    socket.emit("sessao:encerrar", { motivo });
  }

  // Dá tempo para o evento chegar antes de fechar os sockets no servidor.
  if (sockets.length) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const socket of sockets) {
      socket.disconnect(true);
    }
  }
}

async function atualizarSetorUsuario(io, usuarioId, setorId) {
  const id = Number(usuarioId);
  const novoSetorId = setorId == null ? null : Number(setorId);
  if (!io || !Number.isInteger(id) || id <= 0) return;

  const sockets = await io.in(`usuario:${id}`).fetchSockets();
  for (const socket of sockets) {
    for (const sala of socket.rooms) {
      if (typeof sala === "string" && sala.startsWith("setor:")) {
        await socket.leave(sala);
      }
    }
    if (socket.usuarioSistema) {
      socket.usuarioSistema.setorId = novoSetorId;
    }
    if (novoSetorId && socket.usuarioSistema?.perfil === "analista") {
      await socket.join(`setor:${novoSetorId}`);
    }
  }
}

module.exports = { desconectarUsuario, atualizarSetorUsuario };
