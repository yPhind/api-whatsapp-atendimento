const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginErro = document.getElementById("login-erro");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginErro.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  const login = document
    .getElementById("login")
    .value
    .trim();

  const senha = document.getElementById("senha").value;

  try {
    const resultado = await API.post(
      "/api/auth/login",
      {
        login,
        senha
      }
    );

    if (!resultado.token) {
      throw new Error(
        "A API não retornou um token de acesso."
      );
    }

    sessionStorage.setItem(
      "token",
      resultado.token
    );

    window.location.href = "/dashboard.html";

  } catch (erro) {
    loginErro.textContent = erro.message;

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "ENTRAR";
  }
});