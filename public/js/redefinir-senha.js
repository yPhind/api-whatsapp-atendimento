const redefinirForm = document.getElementById("redefinir-form");
const novaSenha = document.getElementById("nova-senha");
const confirmarSenha = document.getElementById("confirmar-senha");
const redefinirButton = document.getElementById("redefinir-button");
const redefinirMensagem = document.getElementById("redefinir-mensagem");

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

if (!token) {
  redefinirMensagem.textContent =
    "Link de recuperação inválido ou incompleto.";
  redefinirMensagem.className = "error-message";
  redefinirButton.disabled = true;
}

redefinirForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  redefinirMensagem.textContent = "";
  redefinirMensagem.className = "";

  const senha = novaSenha.value;
  const confirmacao = confirmarSenha.value;

  if (!token) {
    redefinirMensagem.textContent =
      "Link de recuperação inválido ou incompleto.";
    redefinirMensagem.className = "error-message";
    return;
  }

  if (senha.length < 4) {
    redefinirMensagem.textContent =
      "A senha deve ter pelo menos 4 caracteres.";
    redefinirMensagem.className = "error-message";
    return;
  }

  if (senha !== confirmacao) {
    redefinirMensagem.textContent =
      "As senhas não coincidem.";
    redefinirMensagem.className = "error-message";
    return;
  }

  redefinirButton.disabled = true;
  redefinirButton.textContent = "Redefinindo...";

  try {
    const resultado = await API.post(
      "/api/auth/redefinir-senha",
      {
        token,
        novaSenha: senha
      }
    );

    redefinirMensagem.textContent =
      resultado.mensagem || "Senha redefinida com sucesso.";

    redefinirMensagem.className = "success-message";

    redefinirForm.reset();

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 2000);

  } catch (erro) {
    redefinirMensagem.textContent = erro.message;
    redefinirMensagem.className = "error-message";
  } finally {
    redefinirButton.disabled = false;
    redefinirButton.textContent = "Redefinir senha";
  }
});