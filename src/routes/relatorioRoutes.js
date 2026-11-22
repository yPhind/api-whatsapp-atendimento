const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const relatorioController = require("../controllers/relatorioController");

router.use(authMiddleware);
router.use(permitirPerfis("supervisor"));

router.get("/:tipo/:formato", relatorioController.gerar);

module.exports = router;
