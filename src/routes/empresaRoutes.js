const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const { exigirPermissao } = require("../middlewares/permissaoMiddleware");
const controller = require("../controllers/empresaController");

router.use(authMiddleware);

// Consulta somente leitura: a edição/cadastro de empresas não foi habilitada
// porque o catálogo atual possui clientes.visualizar, mas não clientes.executar.
router.get("/", exigirPermissao("clientes.visualizar"), controller.listar);

module.exports = router;
