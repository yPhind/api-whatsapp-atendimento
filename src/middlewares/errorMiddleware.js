function errorMiddleware(erro, req, res, next) {
  console.error(erro);

  if (res.headersSent) {
    return next(erro);
  }

  res.status(500).json({
    mensagem: "Ocorreu um erro interno."
  });
}

module.exports = errorMiddleware;