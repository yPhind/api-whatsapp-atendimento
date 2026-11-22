const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),

  secure: false,

  requireTLS: true,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

async function enviarRecuperacao(email, token) {
  const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Recuperação de senha",
    text:
      `Recebemos uma solicitação para redefinir sua senha.\n\n` +
      `Acesse o link abaixo para criar uma nova senha:\n` +
      `${link}\n\n` +
      `Este link é válido por 30 minutos.`
  });
}

module.exports = {
  enviarRecuperacao
};