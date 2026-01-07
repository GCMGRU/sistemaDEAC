const VALID_USER = "Admin";
const VALID_PASSWORD = "AdminDeac@26";

function handleLogin(event) {
  event.preventDefault();

  const userInput = document.getElementById("usuario");
  const passInput = document.getElementById("senha");
  const errorEl = document.getElementById("loginError");

  if (!userInput || !passInput || !errorEl) return;

  const username = userInput.value.trim();
  const password = passInput.value;

  if (username === VALID_USER && password === VALID_PASSWORD) {
    errorEl.textContent = "";
    errorEl.classList.remove("is-visible");
    sessionStorage.setItem("deac-auth", "true");
    window.location.href = "dashboard/dashboard.html";
    return;
  }

  errorEl.textContent = "Usuário ou senha incorretos. Tente novamente.";
  errorEl.classList.add("is-visible");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", handleLogin);
});
