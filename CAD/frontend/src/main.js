// вход, инициализация UI
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("health-btn");
  const out = document.getElementById("health-output");

  btn.addEventListener("click", async () => {
    try {
      const res = await fetch("http://localhost:8000/health");
      const json = await res.json();
      out.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      out.textContent = "Ошибка запроса: " + e;
    }
  });
});
