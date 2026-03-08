const playerPanel = document.getElementById("playerPanel");
const player = document.getElementById("mainPlayer");
const playerTitle = document.getElementById("playerTitle");
const videoIdInput = document.getElementById("videoIdInput");
const loadVideoBtn = document.getElementById("loadVideoBtn");

function setVideo(videoId, title = "Ваше видео") {
  const cleanId = String(videoId || "").trim();
  if (!cleanId) return;
  player.src = `https://www.youtube.com/embed/${cleanId}`;
  playerTitle.textContent = title;
  playerPanel.classList.remove("is-hidden");
}

loadVideoBtn.addEventListener("click", () => {
  setVideo(videoIdInput.value);
});

videoIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    setVideo(videoIdInput.value);
  }
});

window.setVideo = setVideo;
