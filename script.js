const playerPanel = document.getElementById("playerPanel");
const player = document.getElementById("mainPlayer");
const playerTitle = document.getElementById("playerTitle");
const backHomeBtn = document.getElementById("backHomeBtn");
const list = document.getElementById("videoList");
const gateMessage = document.getElementById("gateMessage");
const itemTemplate = document.getElementById("videoItemTemplate");

const guestBox = document.getElementById("guestBox");
const userBox = document.getElementById("userBox");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const activateBtn = document.getElementById("activateBtn");
const userEmail = document.getElementById("userEmail");
const subStatus = document.getElementById("subStatus");

let currentUser = null;
let videos = [];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }

  return data;
}

function showToast(message, type = "ok") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function showHomeView() {
  player.src = "about:blank";
  playerTitle.textContent = "";
  playerPanel.classList.add("is-hidden");
  list.querySelectorAll(".video-item").forEach((item) => item.classList.remove("is-active"));
}

function renderAuth() {
  if (!currentUser) {
    guestBox.classList.remove("is-hidden");
    userBox.classList.add("is-hidden");
    gateMessage.textContent = "Войдите в аккаунт и активируйте подписку, чтобы смотреть видео.";
    return;
  }

  guestBox.classList.add("is-hidden");
  userBox.classList.remove("is-hidden");
  userEmail.textContent = currentUser.email;

  if (currentUser.subscriptionActive) {
    subStatus.textContent = `Подписка активна до ${new Date(currentUser.subscriptionExpiresAt).toLocaleDateString("ru-RU")}`;
    activateBtn.classList.add("is-hidden");
    gateMessage.textContent = "Подписка активна. Выберите видео из списка.";
  } else {
    subStatus.textContent = "Подписка не активна";
    activateBtn.classList.remove("is-hidden");
    gateMessage.textContent = "Оформите подписку, чтобы открыть просмотр.";
  }
}

function renderVideos() {
  list.innerHTML = "";

  videos.forEach((video) => {
    const node = itemTemplate.content.cloneNode(true);
    const button = node.querySelector(".video-item");
    button.querySelector(".video-item__title").textContent = video.locked ? `${video.title} (закрыто)` : video.title;
    button.querySelector(".video-item__meta").textContent = video.meta;

    if (video.locked) {
      button.classList.add("is-locked");
    }

    button.addEventListener("click", async () => {
      if (video.locked) {
        showToast("Нужна активная подписка", "error");
        return;
      }

      try {
        const data = await api(`/api/videos/${video.id}/embed`);
        player.src = data.embedUrl;
        playerTitle.textContent = data.title;
        playerPanel.classList.remove("is-hidden");

        list.querySelectorAll(".video-item").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    list.appendChild(node);
  });
}

async function refreshSessionAndVideos() {
  const me = await api("/api/auth/me");
  currentUser = me.user;

  const videoData = await api("/api/videos");
  videos = videoData.videos;

  if (!videoData.canWatch) {
    showHomeView();
  }

  renderAuth();
  renderVideos();
}

async function authAction(type) {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast("Введите email и пароль", "error");
    return;
  }

  try {
    await api(`/api/auth/${type}`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    passwordInput.value = "";
    await refreshSessionAndVideos();
    showToast(type === "login" ? "Вход выполнен" : "Регистрация успешна", "ok");
  } catch (error) {
    showToast(error.message, "error");
  }
}

loginBtn.addEventListener("click", () => authAction("login"));
registerBtn.addEventListener("click", () => authAction("register"));

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    currentUser = null;
    await refreshSessionAndVideos();
    showToast("Вы вышли из аккаунта", "ok");
  } catch (error) {
    showToast(error.message, "error");
  }
});

activateBtn.addEventListener("click", async () => {
  try {
    const result = await api("/api/subscription/activate", { method: "POST" });
    currentUser = result.user;
    await refreshSessionAndVideos();
    showToast("Подписка активирована", "ok");
  } catch (error) {
    showToast(error.message, "error");
  }
});

backHomeBtn.addEventListener("click", showHomeView);

refreshSessionAndVideos().catch((error) => showToast(error.message, "error"));
