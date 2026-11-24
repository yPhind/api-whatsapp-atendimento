const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require("path");

const authRoutes = require('./routes/authRoutes');
const analistaRoutes = require('./routes/analistaRoutes');
const atendimentoRoutes = require('./routes/atendimentoRoutes');
const whatsappWebhookRoutes = require('./routes/whatsappWebhookRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const tarefaRoutes = require('./routes/tarefaRoutes');
const permissaoRoutes = require('./routes/permissaoRoutes');
const empresaRoutes = require('./routes/empresaRoutes');


const app = express();

app.use(helmet());

const origensPermitidas = (process.env.CORS_ORIGENS || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origem, callback) => {

    if (!origem || origensPermitidas.includes(origem)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));

app.use(express.json({
  limit: "1mb",
  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: "55mb"
}));

app.use('/api/auth', authRoutes);
app.use('/api/analistas', analistaRoutes);
app.use('/api/atendimentos', atendimentoRoutes);
app.use('/webhooks/whatsapp', whatsappWebhookRoutes);
app.use("/api/relatorios", relatorioRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tarefas", tarefaRoutes);
app.use("/api/permissoes", permissaoRoutes);
app.use("/api/empresas", empresaRoutes);

app.use((error, req, res, next) => {
  console.error('Erro na API:', error.message);

  res.status(error.status || 500).json({
    erro: error.status ? error.message : 'Erro interno do servidor.'
  });
});

app.use(express.static(path.join(__dirname, "../public")));

module.exports = app;
