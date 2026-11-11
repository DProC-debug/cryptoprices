// Live coin search: debounced suggestions with keyboard navigation.
(() => {
  const DEBOUNCE_MS = 250;

  const container = document.querySelector(".search-container");
  const form = container.querySelector(".search-form");
  const input = document.getElementById("search");
  const list = document.getElementById("suggestions");
  const spinner = container.querySelector(".search-spinner");

  let coins = [];
  let activeIndex = -1;
  let debounceTimer;
  let controller;

  const detailUrl = (id) => `/search?search=${encodeURIComponent(id)}`;

  function openList() {
    list.classList.add("is-open");
    input.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    list.classList.remove("is-open");
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  }

  function setActive(index) {
    const items = list.querySelectorAll(".suggestion");
    items.forEach((item, i) => {
      const isActive = i === index;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });
    activeIndex = index;

    if (index >= 0 && items[index]) {
      input.setAttribute("aria-activedescendant", items[index].id);
      items[index].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function showMessage(text) {
    coins = [];
    const item = document.createElement("li");
    item.className = "suggestion-message";
    item.textContent = text;
    list.replaceChildren(item);
    setActive(-1);
    openList();
  }

  function renderSuggestions(results, query) {
    if (results.length === 0) {
      showMessage(`No coins match "${query}"`);
      return;
    }

    coins = results;
    list.replaceChildren(
      ...results.map((coin, index) => {
        const item = document.createElement("li");
        item.className = "suggestion";
        item.id = `suggestion-${index}`;
        item.setAttribute("role", "option");
        item.addEventListener("mouseenter", () => setActive(index));

        const link = document.createElement("a");
        link.href = detailUrl(coin.id);
        link.tabIndex = -1;

        const image = document.createElement("img");
        image.className = "searchimage";
        image.src = coin.thumb;
        image.alt = "";
        image.width = 24;
        image.height = 24;

        const name = document.createElement("span");
        name.className = "suggestion-name";
        name.textContent = coin.name;

        const symbol = document.createElement("span");
        symbol.className = "suggestion-symbol";
        symbol.textContent = coin.symbol;

        link.append(image, name, symbol);

        if (coin.rank) {
          const rank = document.createElement("span");
          rank.className = "suggestion-rank";
          rank.textContent = `#${coin.rank}`;
          link.append(rank);
        }

        item.append(link);
        return item;
      }),
    );
    setActive(-1);
    openList();
  }

  async function fetchSuggestions(query) {
    controller?.abort();
    const currentController = new AbortController();
    controller = currentController;
    spinner.hidden = false;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: currentController.signal,
      });
      if (!response.ok) throw new Error(`Search failed with status ${response.status}`);

      const { coins: results } = await response.json();
      renderSuggestions(results, query);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error(error);
      showMessage("Search is unavailable right now. Please try again.");
    } finally {
      if (controller === currentController) spinner.hidden = true;
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (!query) {
      controller?.abort();
      spinner.hidden = true;
      coins = [];
      list.replaceChildren();
      closeList();
      return;
    }

    debounceTimer = setTimeout(() => fetchSuggestions(query), DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (event) => {
    const isOpen = list.classList.contains("is-open");

    switch (event.key) {
      case "ArrowDown":
        if (!coins.length) return;
        event.preventDefault();
        openList();
        setActive(isOpen ? (activeIndex + 1) % coins.length : 0);
        break;
      case "ArrowUp":
        if (!coins.length) return;
        event.preventDefault();
        openList();
        setActive(activeIndex <= 0 ? coins.length - 1 : activeIndex - 1);
        break;
      case "Enter":
        if (isOpen && activeIndex >= 0) {
          event.preventDefault();
          window.location.href = detailUrl(coins[activeIndex].id);
        }
        break;
      case "Escape":
        closeList();
        break;
    }
  });

  input.addEventListener("focus", () => {
    if (input.value.trim() && list.children.length) openList();
  });

  // Typing a coin's exact name or symbol and pressing Enter opens it directly.
  form.addEventListener("submit", (event) => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      event.preventDefault();
      input.focus();
      return;
    }

    const exactMatch = coins.find(
      (coin) => coin.name.toLowerCase() === query || coin.symbol.toLowerCase() === query,
    );
    if (exactMatch) {
      event.preventDefault();
      window.location.href = detailUrl(exactMatch.id);
    }
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) closeList();
  });

  // Press "/" anywhere on the page to jump to the search box.
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (event.key === "/" && !isTyping) {
      event.preventDefault();
      input.focus();
    }
  });
})();
