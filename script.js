const serials = [
  {
    title: "Пять минут до полуночи",
    category: "триллер",
    episodes: 8,
    views: "1,2 млн просмотров",
    desc: "Журналистка расследует исчезновение людей в пригороде и находит связь с закрытым архивом.",
    colorA: "#353c66",
    colorB: "#111a38"
  },
  {
    title: "Соседи сверху",
    category: "комедия",
    episodes: 6,
    views: "740 тыс. просмотров",
    desc: "Две семьи случайно меняются квартирами на неделю и попадают в череду абсурдных ситуаций.",
    colorA: "#704214",
    colorB: "#37200b"
  },
  {
    title: "Точка возврата",
    category: "драма",
    episodes: 10,
    views: "2,1 млн просмотров",
    desc: "После аварии пианист возвращается в родной город, чтобы восстановить карьеру и отношения с братом.",
    colorA: "#5d3747",
    colorB: "#2a1820"
  },
  {
    title: "Код 404",
    category: "детектив",
    episodes: 7,
    views: "950 тыс. просмотров",
    desc: "Команда киберполиции ищет преступника, который предсказывает цифровые атаки за сутки до взлома.",
    colorA: "#184f59",
    colorB: "#0d2730"
  },
  {
    title: "Последний дубль",
    category: "драма",
    episodes: 5,
    views: "530 тыс. просмотров",
    desc: "Режиссер-дебютант снимает сериал мечты, но съемки оказываются полем для старых конфликтов.",
    colorA: "#60551e",
    colorB: "#2e270f"
  },
  {
    title: "Тихий коридор",
    category: "триллер",
    episodes: 9,
    views: "1,7 млн просмотров",
    desc: "В закрытой клинике пациенты начинают помнить то, чего никогда не переживали.",
    colorA: "#244a3a",
    colorB: "#11251d"
  }
];

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
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "По вашему запросу ничего не найдено. Попробуйте другую категорию или слово.";
    grid.appendChild(empty);
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
