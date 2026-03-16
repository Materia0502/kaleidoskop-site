const playerPanel = document.getElementById("playerPanel");
const player = document.getElementById("mainPlayer");
const playerTitle = document.getElementById("playerTitle");
const backHomeBtn = document.getElementById("backHomeBtn");
const list = document.getElementById("videoList");
const itemTemplate = document.getElementById("videoItemTemplate");

let videos = [];

async function api(path) {
  const response = await fetch(path);
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

function renderVideos() {
  list.innerHTML = "";

  videos.forEach((video) => {
    const node = itemTemplate.content.cloneNode(true);
    const button = node.querySelector(".video-item");

    button.querySelector(".video-item__title").textContent = video.title;
    button.querySelector(".video-item__meta").textContent = video.meta;

    button.addEventListener("click", async () => {
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

async function loadVideos() {
  const videoData = await api("/api/videos");
  videos = videoData.videos;
  renderVideos();
}

backHomeBtn.addEventListener("click", showHomeView);

loadVideos().catch((error) => showToast(error.message, "error"));
