const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const controller = require("../controllers/analistaController");

router.use(authMiddleware);
router.use(permitirPerfis("supervisor"));

router.get("/setores", controller.listarSetores);
router.get("/", controller.listar);
router.post("/", controller.criar);
router.post("/:id/setor", controller.atualizarSetor);
router.post("/:id/situacao", controller.atualizarSituacao);
router.post("/:id/redefinir-senha", controller.redefinirSenha);

module.exports = router;