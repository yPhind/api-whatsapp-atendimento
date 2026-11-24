
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const permitirPerfis = require("../middlewares/permissionMiddleware");
const { exigirPermissao } = require("../middlewares/permissaoMiddleware");
const controller = require("../controllers/analistaController");

router.use(authMiddleware);

// Consulta de setores: analistas e supervisores
router.get(
  "/setores",
  permitirPerfis("analista", "supervisor"),
  controller.listarSetores
);

// Listagem de usuários
router.get(
  "/",
  exigirPermissao("usuarios.visualizar"),
  controller.listar
);

// Criar usuário
router.post(
  "/",
  exigirPermissao("usuarios.executar"),
  controller.criar
);

// Alterar setor do analista
router.post(
  "/:id/setor",
  exigirPermissao("usuarios.executar"),
  controller.atualizarSetor
);

// Alterar situação do analista
router.post(
  "/:id/situacao",
  exigirPermissao("usuarios.executar"),
  controller.atualizarSituacao
);

// Redefinir senha
router.post(
  "/:id/redefinir-senha",
  exigirPermissao("usuarios.executar"),
  controller.redefinirSenha
);

module.exports = router;
