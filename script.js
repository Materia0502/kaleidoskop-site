const serials = [];

const grid = document.getElementById("serialGrid");
const template = document.getElementById("cardTemplate");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const chips = document.getElementById("categoryChips");

let activeCategory = "all";
let searchTerm = "";

function render() {
  const term = searchTerm.trim().toLowerCase();
  const filtered = serials.filter((item) => {
    const byCategory = activeCategory === "all" || item.category === activeCategory;
    const bySearch = item.title.toLowerCase().includes(term);
    return byCategory && bySearch;
  });

  grid.innerHTML = "";

  if (!filtered.length) {
    return;
  }

  filtered.forEach((item) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".card__title").textContent = item.title;
    node.querySelector(".card__meta").textContent = `${item.episodes} эпизодов • ${item.views} • ${item.category}`;
    node.querySelector(".card__desc").textContent = item.desc;
    node.querySelector(".thumb").style.background = `linear-gradient(135deg, ${item.colorA}, ${item.colorB})`;
    grid.appendChild(node);
  });
}

searchBtn.addEventListener("click", () => {
  searchTerm = searchInput.value;
  render();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchTerm = searchInput.value;
    render();
  }
});

chips.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  activeCategory = target.dataset.category || "all";

  chips.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("chip--active"));
  target.classList.add("chip--active");
  render();
});

render();

