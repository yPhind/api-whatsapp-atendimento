const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const controller = require("../controllers/analistaController");

router.use(authMiddleware);

// Consulta de setores: permitida para analistas e supervisores.
router.get(
  "/setores",
  permitirPerfis("analista", "supervisor"),
  controller.listarSetores
);

// Demais operações administrativas: somente supervisor.
router.use(permitirPerfis("supervisor"));

router.get("/", controller.listar);
router.post("/", controller.criar);
router.post("/:id/setor", controller.atualizarSetor);
router.post("/:id/situacao", controller.atualizarSituacao);
router.post("/:id/redefinir-senha", controller.redefinirSenha);

module.exports = router;