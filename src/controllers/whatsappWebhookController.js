const crypto = require("crypto");
const webhookService = require("../services/whatsappWebhookService");
const logService = require("../services/logService");

function obterIdentificadorCorrelacao(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  return (
    value?.messages?.[0]?.id ||
    value?.statuses?.[0]?.id ||
    null
  );
}

function verificarAssinatura(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const assinatura = req.headers["x-hub-signature-256"];

  if (!appSecret || !assinatura || !req.rawBody) {
    return false;
  }

  const assinaturaEsperada =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(req.rawBody)
      .digest("hex");

  const recebidaBuffer = Buffer.from(assinatura);
  const esperadaBuffer = Buffer.from(assinaturaEsperada);

  if (recebidaBuffer.length !== esperadaBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    recebidaBuffer,
    esperadaBuffer
  );
}

async function verificarWebhook(req, res) {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const desafio = req.query["hub.challenge"];

  if (
    modo === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).send(desafio);
  }

  return res.sendStatus(403);
}

async function receberWebhook(req, res) {
  if (!verificarAssinatura(req)) {
    await logService.warn({
      origem: "whatsappWebhookController",
      evento: "webhook_assinatura_rejeitada",
      mensagem: "Webhook rejeitado por falha na validação da assinatura.",
      contexto: {
        motivo: "assinatura_ausente_ou_invalida"
      }
    });

    return res.sendStatus(401);
  }

  if (req.body?.object !== "whatsapp_business_account") {
    await logService.warn({
      origem: "whatsappWebhookController",
      evento: "webhook_objeto_invalido",
      mensagem: "Webhook recebido com objeto diferente do esperado.",
      contexto: {
        objeto: req.body?.object || null
      }
    });

    return res.sendStatus(404);
  }

  const correlacaoId = obterIdentificadorCorrelacao(req.body);

  try {
    await webhookService.processarWebhook(
      req.body,
      req.app.get("io")
    );

    return res.sendStatus(200);

  } catch (erro) {
    await logService.error({
      origem: "whatsappWebhookController",
      evento: "webhook_processamento_falhou",
      mensagem: "Falha ao processar evento recebido da Meta.",
      correlacao_id: correlacaoId,
      contexto: {
        erro: String(erro.message || "Erro desconhecido").slice(0, 500)
      }
    });

    console.error(
      "Erro ao processar webhook do WhatsApp:",
      erro.message
    );

    return res.sendStatus(500);
  }
}

module.exports = {
  verificarWebhook,
  receberWebhook
};