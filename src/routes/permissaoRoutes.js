const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const exigirSupervisor = require("../middlewares/exigirSupervisorMiddleware");
const controller = require("../controllers/permissaoController");

router.use(authMiddleware, exigirSupervisor);

// Configuração padrão aplicada ao papel Analista.
router.get("/analista", controller.listarPermissoesAnalista);
router.put("/analista", controller.atualizarPermissoesAnalista);

// Exceções individuais: true concede, false bloqueia e null volta a herdar do papel.
router.get("/usuarios/:usuarioId", controller.listarPermissoesUsuario);
router.put("/usuarios/:usuarioId", controller.atualizarPermissoesUsuario);

module.exports = router;
