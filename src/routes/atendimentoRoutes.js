
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const { exigirPermissao } = require("../middlewares/permissaoMiddleware");
const controller = require("../controllers/atendimentoController");

router.use(authMiddleware);

// Consulta de empresa
router.get(
  "/empresa/cnpj/:cnpj",
  exigirPermissao("clientes.visualizar"),
  controller.consultarEmpresaCnpj
);

// Abertura manual de atendimento
router.post(
  "/abrir",
  exigirPermissao("fila.executar"),
  controller.abrirManual
);

// Fila de atendimentos
router.get(
  "/fila",
  exigirPermissao("fila.visualizar"),
  controller.listarFila
);

// Atendimentos do analista
router.get(
  "/meus",
  exigirPermissao("meus.visualizar"),
  controller.listarMeusAtendimentos
);

// Visão exclusiva do supervisor
router.get(
  "/supervisor",
  permitirPerfis("supervisor"),
  controller.listarAtendimentosSupervisor
);

// Histórico
router.get(
  "/historico",
  exigirPermissao("historico.visualizar"),
  controller.listarHistorico
);

router.get(
  "/historico/:id/conversa",
  exigirPermissao("historico.visualizar"),
  controller.obterConversaHistorica
);

// Logs
router.get(
  "/logs",
  exigirPermissao("logs.visualizar"),
  controller.listarLogs
);

// Conversa do atendimento
router.get(
  "/:id",
  exigirPermissao("meus.visualizar"),
  controller.obterConversa
);

// Replicar atendimento
router.post(
  "/:id/replicar",
  exigirPermissao("meus.executar"),
  controller.replicarAtendimento
);

// Assumir atendimento da fila
router.post(
  "/:id/assumir",
  exigirPermissao("fila.executar"),
  controller.assumir
);

// Atribuição exclusiva do supervisor
router.post(
  "/:id/atribuir",
  permitirPerfis("supervisor"),
  controller.atribuirParaAnalista
);

// Devolver atendimento para a fila
router.post(
  "/:id/devolver-fila",
  exigirPermissao("meus.executar"),
  controller.devolverParaFila
);

// Alteração de setor exclusiva do supervisor
router.post(
  "/:id/setor",
  permitirPerfis("supervisor"),
  controller.alterarSetorAtendimento
);

// Alterar status
router.patch(
  "/:id/status",
  exigirPermissao("meus.executar"),
  controller.alterarStatus
);

// Editar atendimento
router.patch(
  "/:id/editar",
  exigirPermissao("meus.executar"),
  controller.editarAtendimento
);

// Enviar mensagem interna
router.post(
  "/:id/mensagens",
  exigirPermissao("meus.executar"),
  controller.enviarMensagemInterna
);

module.exports = router;
