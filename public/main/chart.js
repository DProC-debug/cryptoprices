// Coin price chart: area chart with range buttons, crosshair tooltip and up/down colouring.
(() => {
  const COLORS = {
    up: "22, 163, 74",
    down: "220, 38, 38",
    text: "#6b6b6b",
    grid: "rgba(24, 28, 20, 0.08)",
    crosshair: "rgba(24, 28, 20, 0.35)",
  };

  const canvas = document.getElementById("cryptoChart");
  const changeEl = document.getElementById("chart-change");
  const statusEl = document.getElementById("chart-status");
  const wrap = canvas.closest(".chart-canvas-wrap");
  const buttons = [...document.querySelectorAll(".range-button")];
  const initial = JSON.parse(document.getElementById("chart-data").textContent);

  const coinId = initial.coinId;
  let days = initial.days;
  let controller;

  // ---------- Formatting ----------

  const usd = (options) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...options });
  const USD_LARGE = usd({ maximumFractionDigits: 0 });
  const USD_STANDARD = usd({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const USD_SMALL = usd({ maximumSignificantDigits: 4 });
  const PERCENT = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });

  function formatPrice(value) {
    const magnitude = Math.abs(value);
    if (magnitude >= 1000) return USD_LARGE.format(value);
    if (magnitude >= 1) return USD_STANDARD.format(value);
    return USD_SMALL.format(value);
  }

  function formatAxisTime(timestamp) {
    const date = new Date(timestamp);
    if (days <= 1) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (days <= 90) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    // "Nov '25" rather than "Nov 25", which reads like a day of the month.
    const month = date.toLocaleDateString("en-US", { month: "short" });
    return `${month} '${String(date.getFullYear()).slice(-2)}`;
  }

  function formatTooltipTime(timestamp) {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(days <= 90 && { hour: "numeric", minute: "2-digit" }),
    });
  }

  // ---------- Chart ----------

  const toPoints = (prices) => prices.map(([x, y]) => ({ x, y }));
  const trendColor = (points) => (points.at(-1)?.y >= points[0]?.y ? COLORS.up : COLORS.down);

  function areaGradient(context) {
    const { chart } = context;
    const { chartArea, ctx } = chart;
    if (!chartArea) return "transparent";

    const rgb = chart.data.datasets[0].trendColor;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `rgba(${rgb}, 0.28)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    return gradient;
  }

  // Vertical line under the cursor while the tooltip is visible.
  const crosshair = {
    id: "crosshair",
    afterDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements();
      if (!active?.length) return;

      const { ctx, chartArea } = chart;
      const x = active[0].element.x;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.crosshair;
      ctx.stroke();
      ctx.restore();
    },
  };

  const isSmallScreen = window.matchMedia("(max-width: 600px)").matches;
  const tickFont = { family: "Ubuntu, sans-serif", size: isSmallScreen ? 10 : 12 };
  const initialPoints = toPoints(initial.prices);

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          data: initialPoints,
          trendColor: trendColor(initialPoints),
          borderColor: (context) => `rgb(${context.chart.data.datasets[0].trendColor})`,
          backgroundColor: areaGradient,
          fill: true,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 400 },
      interaction: { mode: "nearest", axis: "x", intersect: false },
      layout: { padding: { top: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181C14",
          titleColor: "#b5b5b5",
          bodyColor: "#f7f4f4",
          titleFont: { family: "Ubuntu, sans-serif", size: 12, weight: "normal" },
          bodyFont: { family: "Ubuntu, sans-serif", size: 15, weight: "bold" },
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items) => formatTooltipTime(items[0].parsed.x),
            label: (item) => formatPrice(item.parsed.y),
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          bounds: "data",
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: COLORS.text,
            font: tickFont,
            maxRotation: 0,
            autoSkipPadding: 24,
            maxTicksLimit: isSmallScreen ? 4 : 7,
            callback: (value) => formatAxisTime(value),
          },
        },
        y: {
          position: "right",
          grace: "5%",
          grid: { color: COLORS.grid },
          border: { display: false },
          ticks: {
            color: COLORS.text,
            font: tickFont,
            maxTicksLimit: 5,
            callback: (value) => formatPrice(value),
          },
        },
      },
    },
    plugins: [crosshair],
  });

  // ---------- Header & range switching ----------

  function updateChange(points) {
    const first = points[0]?.y;
    const last = points.at(-1)?.y;
    if (!first || last == null) {
      changeEl.textContent = "";
      return;
    }
    const change = (last - first) / first;
    const label = buttons.find((button) => Number(button.dataset.days) === days)?.textContent ?? "";
    changeEl.textContent = `${PERCENT.format(change)} (${label})`;
    changeEl.className = `chart-change ${change >= 0 ? "positive" : "negative"}`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
    statusEl.hidden = !message;
  }

  async function loadRange(newDays) {
    if (newDays === days) return;

    controller?.abort();
    const currentController = new AbortController();
    controller = currentController;

    buttons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.days) === newDays)));
    wrap.classList.add("is-loading");
    setStatus("");

    try {
      const response = await fetch(`/api/coins/${encodeURIComponent(coinId)}/market-chart?days=${newDays}`, {
        signal: currentController.signal,
      });
      if (!response.ok) throw new Error(`Chart request failed with status ${response.status}`);

      const { prices } = await response.json();
      const points = toPoints(prices);
      days = newDays;

      const dataset = chart.data.datasets[0];
      dataset.data = points;
      dataset.trendColor = trendColor(points);
      chart.update();
      updateChange(points);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error(error);
      buttons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.days) === days)));
      setStatus("Couldn't load this range. Please try again.");
    } finally {
      if (controller === currentController) wrap.classList.remove("is-loading");
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => loadRange(Number(button.dataset.days)));
  });

  updateChange(initialPoints);
})();
