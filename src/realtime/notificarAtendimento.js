function notificarAtendimento(req, atendimento, tipo, setorAnteriorId = null) {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    tipo,
    atendimentoId: atendimento?.id ? Number(atendimento.id) : null,
    setorId: atendimento?.setor_id ? Number(atendimento.setor_id) : null,
    analistaId: atendimento?.analista_id ? Number(atendimento.analista_id) : null,
    em: new Date().toISOString()
  };

  // O evento não contém texto de mensagem, telefone ou outros dados do cliente.
  io.to("supervisores").emit("atendimentos:atualizar", payload);
  if (payload.setorId) io.to(`setor:${payload.setorId}`).emit("atendimentos:atualizar", payload);
  if (setorAnteriorId && Number(setorAnteriorId) !== payload.setorId) {
    io.to(`setor:${Number(setorAnteriorId)}`).emit("atendimentos:atualizar", { ...payload, setorAnteriorId: Number(setorAnteriorId) });
  }
  if (payload.analistaId) io.to(`usuario:${payload.analistaId}`).emit("atendimentos:atualizar", payload);
}

module.exports = notificarAtendimento;
