
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const controller = require("../controllers/atendimentoController");

router.use(authMiddleware);

router.get(
  "/empresa/cnpj/:cnpj",
  permitirPerfis("analista", "supervisor"),
  controller.consultarEmpresaCnpj
);

router.post(
  "/abrir",
  permitirPerfis("analista", "supervisor"),
  controller.abrirManual
);

router.get(
  "/fila",
  permitirPerfis("analista", "supervisor"),
  controller.listarFila
);

router.get(
  "/meus",
  permitirPerfis("analista", "supervisor"),
  controller.listarMeusAtendimentos
);

router.get(
  "/supervisor",
  permitirPerfis("supervisor"),
  controller.listarAtendimentosSupervisor
);

router.get(
  "/historico",
  permitirPerfis("analista", "supervisor"),
  controller.listarHistorico
);

router.get(
  "/historico/:id/conversa",
  permitirPerfis("analista", "supervisor"),
  controller.obterConversaHistorica
);

router.get(
  "/logs",
  permitirPerfis("supervisor"),
  controller.listarLogs
);

router.get(
  "/:id",
  permitirPerfis("analista", "supervisor"),
  controller.obterConversa
);

router.post(
  "/:id/replicar",
  permitirPerfis("analista", "supervisor"),
  controller.replicarAtendimento
);

router.post(
  "/:id/assumir",
  permitirPerfis("analista", "supervisor"),
  controller.assumir
);

router.post(
  "/:id/atribuir",
  permitirPerfis("supervisor"),
  controller.atribuirParaAnalista
);

router.post(
  "/:id/devolver-fila",
  permitirPerfis("analista", "supervisor"),
  controller.devolverParaFila
);

router.post(
  "/:id/setor",
  permitirPerfis("supervisor"),
  controller.alterarSetorAtendimento
);

router.patch(
  "/:id/status",
  permitirPerfis("analista", "supervisor"),
  controller.alterarStatus
);

router.patch(
  "/:id/editar",
  permitirPerfis("analista", "supervisor"),
  controller.editarAtendimento
);

router.post(
  "/:id/mensagens",
  permitirPerfis("analista", "supervisor"),
  controller.enviarMensagemInterna
);

module.exports = router;