const express = require('express');
const controller = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/', controller.verificarWebhook);
router.post('/', controller.receberWebhook);

module.exports = router;