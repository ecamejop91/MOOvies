// ====== TMDB wiring for your UI ======
const $ = (id) => document.getElementById(id);
const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const descriptionInput = $("descriptionInput");
const recommendBtn = $("recommendBtn");
const recommendationsStatus = $("recommendationsStatus");
const recommendationsList = $("recommendationsList");

const movieTitle = $("movieTitle");
const movieOverview = $("movieOverview");
const movieRating = $("movieRating");
const reviewsContainer = $("reviewsContainer");
const castGrid = $("castGrid");

const IMG_BASE = "https://image.tmdb.org/t/p";
const IMG_CAST = `${IMG_BASE}/w185`;
const RECOMMEND_ENDPOINT = "/api/recommend";
const MOVIE_ENDPOINT = "/api/movie";

const overviewBg = document.querySelector("#overview .bg");
const heroBackdrop = document.getElementById("heroBackdrop");

function setOverviewBg(path) {
  const IMG_BG = `${IMG_BASE}/w780`;
  [overviewBg, heroBackdrop]
    .filter(Boolean)
    .forEach((el) => {
      if (path) {
        el.style.backgroundImage = `url(${IMG_BG}${path})`;
        el.style.display = "block";
      } else {
        el.style.backgroundImage = "none";
        el.style.display = "none";
      }
    });
}

// Generic fetch helper
async function getMovieData(query) {
  const res = await fetch(
    `${MOVIE_ENDPOINT}?query=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Lookup failed for ${query}`);
  }
  return data;
}

// Render helpers
function setText(el, value, empty = "—") {
  el.textContent = value && String(value).trim() ? value : empty;
}

function clearUI() {
  setText(movieTitle, "Awaiting Selection");
  setText(movieOverview, "—");
  setText(movieRating, "—");
  reviewsContainer.innerHTML = "—";
  castGrid.innerHTML = "";
  setOverviewBg(null);
}

function renderReviews(reviews) {
  if (!reviews || reviews.length === 0) {
    reviewsContainer.textContent = "No user reviews found.";
    return;
  }
  const top = reviews.slice(0, 3);
  reviewsContainer.innerHTML = top
    .map((r) => {
      const snippet = (r.content || "").trim().slice(0, 400);
      return `
        <div style="margin-bottom:12px;">
          <div style="font-weight:600">${r.author || "Anonymous"}</div>
          <div style="white-space:pre-wrap; line-height:1.35">${snippet}${
        r.content && r.content.length > 400 ? "…" : ""
      }</div>
        </div>
      `;
    })
    .join("");
}

function renderCast(cast) {
  castGrid.innerHTML = "";
  if (!cast || cast.length === 0) {
    castGrid.innerHTML = `<div class="cast-card">pic.</div>`;
    return;
  }
  cast.slice(0, 8).forEach((p) => {
    const url = p.profile_path ? `${IMG_CAST}${p.profile_path}` : null;
    const card = document.createElement("div");
    card.className = "cast-card";
    card.title = p.name || "";

    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = p.name || "cast";
      card.appendChild(img);
    } else {
      card.textContent = "pic.";
    }

    castGrid.appendChild(card);
  });
}

// Main search flow
async function searchAndFill(query) {
  clearUI();
  if (!query) {
    setText(movieTitle, "Type a movie name above.");
    return;
  }

  try {
    const data = await getMovieData(query);
    const movie = data.movie;
    if (!movie) {
      setText(movieTitle, `No results for "${query}"`);
      return;
    }
    const year = (movie.release_date || "").slice(0, 4);
    setText(movieTitle, year ? `${movie.title} (${year})` : movie.title);
    setText(movieOverview, movie.overview);
    setText(
      movieRating,
      movie.vote_average
        ? `${movie.vote_average.toFixed(1)} / 10 (${movie.vote_count} votes)`
        : "—"
    );
    setOverviewBg(movie.backdrop_path || movie.poster_path);

    renderCast(data.credits);
    renderReviews(data.reviews);
  } catch (err) {
    setText(movieTitle, "Error fetching data.");
    console.error(err);
  }
}

// Recommendation flow
function setRecommendationStatus(text) {
  if (recommendationsStatus) {
    recommendationsStatus.textContent = text;
  }
}

function renderRecommendations(items) {
  recommendationsList.innerHTML = "";
  if (!items || items.length === 0) {
    setRecommendationStatus("No recommendations found.");
    return;
  }
  setRecommendationStatus("");
  items.forEach((title) => {
    const li = document.createElement("li");
    li.className = "recommendation-pill";
    li.textContent = title;
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      searchInput.value = title;
      searchAndFill(title);
      searchInput.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        li.click();
      }
    });
    recommendationsList.appendChild(li);
  });
}

async function getRecommendations(description) {
  setRecommendationStatus("Fetching recommendations…");
  recommendationsList.innerHTML = "";
  try {
    const res = await fetch(RECOMMEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed.");
    }
    renderRecommendations(data.recommendations || []);
  } catch (err) {
    console.error(err);
    setRecommendationStatus(
      "Could not fetch recommendations. Please try again."
    );
  }
}

// Wire the button + Enter key
searchBtn.addEventListener("click", () =>
  searchAndFill(searchInput.value.trim())
);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchAndFill(searchInput.value.trim());
});

recommendBtn.addEventListener("click", () => {
  const description = descriptionInput.value.trim();
  if (!description) {
    setRecommendationStatus("Please describe a movie first.");
    return;
  }
  getRecommendations(description);
});

descriptionInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter") {
    recommendBtn.click();
  }
});

// Optional: initial demo
// searchAndFill("Titanic");
