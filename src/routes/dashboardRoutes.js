const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const controller = require("../controllers/dashboardController");

router.use(authMiddleware);
router.get("/indicadores", permitirPerfis("analista", "supervisor"), controller.obterIndicadores);

module.exports = router;
