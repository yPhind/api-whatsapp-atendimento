const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();
const controller = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    mensagem: "Muitas tentativas. Tente novamente mais tarde."
  }
});

const recuperacaoLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

router.post("/login", loginLimit, controller.login);

router.get("/perfil", authMiddleware, controller.perfil);

router.post(
  "/recuperar-senha",
  recuperacaoLimit,
  controller.solicitarRecuperacao
);

router.post(
  "/redefinir-senha",
  recuperacaoLimit,
  controller.redefinirSenha
);

router.post(
  "/trocar-minha-senha",
  authMiddleware,
  controller.trocarMinhaSenha
);

module.exports = router;