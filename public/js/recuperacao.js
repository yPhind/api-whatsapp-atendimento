const recuperacaoForm = document.getElementById(
  "recuperacao-form"
);

const recuperacaoEmail = document.getElementById(
  "recuperacao-email"
);

const recuperacaoButton = document.getElementById(
  "recuperacao-button"
);

const recuperacaoMensagem = document.getElementById(
  "recuperacao-mensagem"
);

recuperacaoForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    recuperacaoMensagem.textContent = "";
    recuperacaoMensagem.className = "";

    recuperacaoButton.disabled = true;
    recuperacaoButton.textContent = "Enviando...";

    const email = recuperacaoEmail.value
      .trim()
      .toLowerCase();

    try {
      const resultado = await API.post(
        "/api/auth/recuperar-senha",
        {
          email
        }
      );

      recuperacaoMensagem.textContent =
        resultado.mensagem ||
        "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.";

      recuperacaoMensagem.className =
        "success-message";

      recuperacaoForm.reset();

    } catch (erro) {
      recuperacaoMensagem.textContent =
        erro.message;

      recuperacaoMensagem.className =
        "error-message";

    } finally {
      recuperacaoButton.disabled = false;
      recuperacaoButton.textContent = "Enviar";
    }
  }
);