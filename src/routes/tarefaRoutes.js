
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const perfis = require("../middlewares/permissionMiddleware");
const controller = require("../controllers/tarefaController");

const DIRETORIO_ANEXOS = path.resolve(
  process.cwd(),
  "storage",
  "tarefas"
);

const LIMITE_ARQUIVO = 50 * 1024 * 1024;
const MAX_ARQUIVOS = 20;

const TIPOS_PERMITIDOS = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

fs.mkdirSync(DIRETORIO_ANEXOS, { recursive: true });

const armazenamento = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, DIRETORIO_ANEXOS);
  },

  filename: (req, file, callback) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    const nomeSeguro = `${crypto.randomUUID()}${extensao}`;

    callback(null, nomeSeguro);
  }
});

const upload = multer({
  storage: armazenamento,

  limits: {
    fileSize: LIMITE_ARQUIVO,
    files: MAX_ARQUIVOS
  },

  fileFilter: (req, file, callback) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    const mimeEsperado = TIPOS_PERMITIDOS[extensao];

    if (!mimeEsperado || file.mimetype !== mimeEsperado) {
      return callback(
        Object.assign(
          new Error("Formato inválido. Envie PDF, JPG, JPEG ou PNG."),
          { status: 415 }
        )
      );
    }

    callback(null, true);
  }
});

function uploadTarefa(req, res, next) {
  upload.array("arquivos", MAX_ARQUIVOS)(
    req,
    res,
    (erro) => {
      if (!erro) {
        return next();
      }

      if (erro instanceof multer.MulterError) {
        if (erro.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            mensagem: "Cada arquivo pode ter no máximo 50 MB."
          });
        }

        if (erro.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            mensagem: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`
          });
        }

        if (erro.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            mensagem: "Campo de arquivo inválido. Utilize o campo 'arquivos'."
          });
        }

        return res.status(400).json({
          mensagem: "Não foi possível processar os arquivos enviados."
        });
      }

      if (erro.status === 415) {
        return res.status(415).json({
          mensagem: erro.message
        });
      }

      next(erro);
    }
  );
}

// Todas as rotas exigem autenticação e perfil autorizado.
router.use(auth);
router.use(perfis("analista", "supervisor"));

// Consultas e gerenciamento de tarefas.
router.get("/clientes", controller.listarEmpresas);

router.get("/", controller.listar);
router.get("/realizadas", controller.realizadas);

router.post("/", controller.criar);
router.patch("/:id", controller.atualizar);

router.patch("/:id/finalizar", controller.finalizar);
router.patch("/:id/reabrir", controller.reabrir);

// Gerenciamento de anexos.
router.post("/:id/anexos", uploadTarefa, (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      mensagem: "Selecione pelo menos um arquivo."
    });
  }

  controller.anexar(req, res, next);
});

router.get(
  "/anexos/:anexoId/visualizar",
  controller.visualizarAnexo
);

router.get(
  "/anexos/:anexoId",
  controller.baixarAnexo
);

router.delete(
  "/anexos/:anexoId",
  controller.removerAnexo
);

module.exports = router;