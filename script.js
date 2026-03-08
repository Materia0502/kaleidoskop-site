const videos = [
  {
    title: "Калейдоскоп — Выпуск 1",
    meta: "VK Video",
    embedUrl: "https://vk.com/video_ext.php?oid=-222378310&id=456239380&access_key=e2ac15f282f4b995dd&hd=2"
  }
];

const videoWrap = document.getElementById("videoWrap");
const player = document.getElementById("mainPlayer");
const playerTitle = document.getElementById("playerTitle");
const placeholder = document.getElementById("playerPlaceholder");
const list = document.getElementById("videoList");
const itemTemplate = document.getElementById("videoItemTemplate");

function playVideo(video, activeButton) {
  player.src = video.embedUrl;
  playerTitle.textContent = video.title;
  videoWrap.classList.remove("is-hidden");
  placeholder.classList.add("is-hidden");

  list.querySelectorAll(".video-item").forEach((item) => item.classList.remove("is-active"));
  if (activeButton) {
    activeButton.classList.add("is-active");
  }
}

function renderList() {
  list.innerHTML = "";

  videos.forEach((video) => {
    const node = itemTemplate.content.cloneNode(true);
    const button = node.querySelector(".video-item");
    button.querySelector(".video-item__title").textContent = video.title;
    button.querySelector(".video-item__meta").textContent = video.meta;
    button.addEventListener("click", () => playVideo(video, button));
    list.appendChild(node);
  });
}

renderList();
