const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const perfis = require("../middlewares/permissionMiddleware");
const c = require("../controllers/tarefaController");

const dir = path.join(process.cwd(), "storage", "tarefas");
fs.mkdirSync(dir, { recursive: true });

const LIMITE_ARQUIVO = 50 * 1024 * 1024;
const MAX_ARQUIVOS = 20;
const TIPOS_PERMITIDOS = new Set(["application/pdf", "image/jpeg", "image/png"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(
      null,
      `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`
    )
  }),
  limits: { fileSize: LIMITE_ARQUIVO, files: MAX_ARQUIVOS },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(null, true);
  }
});

function uploadTarefa(req, res, next) {
  upload.array("arquivos", MAX_ARQUIVOS)(req, res, (erro) => {
    if (erro instanceof multer.MulterError) {
      if (erro.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ mensagem: "Cada arquivo pode ter no máximo 50 MB." });
      }
      if (erro.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ mensagem: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.` });
      }
      if (erro.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ mensagem: "Arquivo ou campo inválido. Envie PDF, JPG, JPEG ou PNG no campo 'arquivos'." });
      }
      return res.status(400).json({ mensagem: "Erro ao enviar os arquivos." });
    }
    if (erro) return next(erro);
    next();
  });
}

router.use(auth, perfis("analista", "supervisor"));

router.get("/", c.listar);
router.get("/realizadas", c.realizadas);
router.post("/", c.criar);
router.patch("/:id", c.atualizar);
router.patch("/:id/finalizar", c.finalizar);
router.patch("/:id/reabrir", c.reabrir);

router.post("/:id/anexos", uploadTarefa, (req, res, next) => {
  if (!req.files?.length) {
    return res.status(400).json({ mensagem: "Selecione ao menos um arquivo PDF, JPG, JPEG ou PNG de até 50 MB cada." });
  }
  c.anexar(req, res, next);
});

router.get("/anexos/:anexoId/visualizar", c.visualizarAnexo);
router.get("/anexos/:anexoId", c.baixarAnexo);
router.delete("/anexos/:anexoId", c.removerAnexo);

module.exports = router;
