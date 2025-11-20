// ====== TMDB wiring for your UI ======
const $ = (id) => document.getElementById(id);
const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const descriptionInput = $("descriptionInput");
const recommendBtn = $("recommendBtn");
const recommendationsStatus = $("recommendationsStatus");
const recommendationsList = $("recommendationsList");
const bookmarkBtn = $("bookmarkBtn");
const layoutGrid = $("layoutGrid");

// Initialize Firebase in the app (loaded globally on the page)
const auth = window.firebase ? firebase.auth() : null;

// Add user info and logout button to header
const header = document.querySelector('header');
const userContainer = document.createElement('div');
userContainer.className = 'user-container';
const userEmail = document.createElement('span');
userEmail.className = 'user-email';
const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'Sign Out';
logoutBtn.className = 'logout-button';
userContainer.appendChild(userEmail);
userContainer.appendChild(logoutBtn);
header.appendChild(userContainer);

const isGuestMode = () => localStorage.getItem('guestMode') === 'true';

function setUserLabel(label) {
  userEmail.textContent = label;
}

if (isGuestMode()) {
  setUserLabel('Guest Mode');
}

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      setUserLabel(user.email || 'Signed in');
      try {
        const idToken = await user.getIdToken();
        localStorage.setItem('authToken', idToken);
        localStorage.setItem('guestMode', 'false');
      } catch (err) {
        console.error('Failed to refresh auth token', err);
      }
    } else if (isGuestMode()) {
      localStorage.removeItem('authToken');
      setUserLabel('Guest Mode');
    } else {
      window.location.href = '/';
    }
  });
}

// Handle logout
logoutBtn.addEventListener('click', async () => {
  try {
    if (auth && auth.currentUser) {
      await auth.signOut();
    }
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('guestMode');
    window.location.href = '/';
  }
});

const movieTitle = $("movieTitle");
const movieOverview = $("movieOverview");
const movieRating = $("movieRating");
const reviewsContainer = $("reviewsContainer");
const castGrid = $("castGrid");

const IMG_BASE = "https://image.tmdb.org/t/p";
const IMG_CAST = `${IMG_BASE}/w185`;
const IMG_BG = `${IMG_BASE}/w780`;
const RECOMMEND_ENDPOINT = "/api/recommend";
const MOVIE_ENDPOINT = "/api/movie";
const RANDOM_MOVIES_ENDPOINT = "/api/random-movies";
const WATCHLIST_KEY = "moovies_watchlist";

const overviewBg = document.querySelector("#overview .bg");
const heroBackdrop = document.getElementById("heroBackdrop");

let heroShuffleTimer = null;
let heroShufflePool = [];
let heroShuffleIndex = 0;
let heroShuffleActive = false;
let hasTriggeredSearch = false;
const HERO_SHUFFLE_INTERVAL = 6000;
let currentMovie = null;
let hasRevealedGrid = false;

function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
  } catch (err) {
    console.error("Failed to parse watchlist", err);
    return [];
  }
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

function isInWatchlist(id) {
  return loadWatchlist().some((item) => item.id === id);
}

function updateBookmarkButton(movie) {
  if (!bookmarkBtn) return;
  if (!movie || !movie.id) {
    bookmarkBtn.disabled = true;
    bookmarkBtn.textContent = "☆ Add to Watchlist";
    bookmarkBtn.setAttribute("aria-pressed", "false");
    bookmarkBtn.classList.remove("bookmark-active");
    return;
  }
  const saved = isInWatchlist(movie.id);
  bookmarkBtn.disabled = false;
  bookmarkBtn.textContent = saved ? "★ In Watchlist" : "☆ Add to Watchlist";
  bookmarkBtn.setAttribute("aria-pressed", saved ? "true" : "false");
  bookmarkBtn.classList.toggle("bookmark-active", saved);
}

function toggleWatchlist(movie) {
  if (!movie || !movie.id) return;
  const list = loadWatchlist();
  const exists = list.findIndex((item) => item.id === movie.id);
  if (exists >= 0) {
    list.splice(exists, 1);
  } else {
    list.push(movie);
    triggerBookmarkPulse();
  }
  saveWatchlist(list);
  updateBookmarkButton(movie);
}

function revealLayoutGrid() {
  if (!layoutGrid || hasRevealedGrid) return;
  layoutGrid.classList.remove("is-hidden");
  hasRevealedGrid = true;
}

function triggerBookmarkPulse() {
  if (!bookmarkBtn) return;
  bookmarkBtn.classList.remove("bookmark-pulse");
  // Force reflow so the animation can restart
  void bookmarkBtn.offsetWidth;
  bookmarkBtn.classList.add("bookmark-pulse");
}

function setOverviewBg(path) {
  const targets = [overviewBg];
  if (!heroShuffleActive) {
    targets.push(heroBackdrop);
  }
  targets
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

function setHeroBackdropOnly(path) {
  if (!heroBackdrop) return;
  if (path) {
    heroBackdrop.style.backgroundImage = `url(${IMG_BG}${path})`;
    heroBackdrop.style.display = "block";
  } else {
    heroBackdrop.style.backgroundImage = "none";
    heroBackdrop.style.display = "none";
  }
}

function stopHeroBackdropShuffle() {
  heroShuffleActive = false;
  if (heroShuffleTimer) {
    clearInterval(heroShuffleTimer);
    heroShuffleTimer = null;
  }
}

function startHeroBackdropShuffle() {
  if (heroShuffleActive || !heroShufflePool.length || hasTriggeredSearch) {
    return;
  }
  heroShuffleActive = true;
  setHeroBackdropOnly(heroShufflePool[heroShuffleIndex]);
  heroShuffleTimer = setInterval(() => {
    if (!heroShufflePool.length) return;
    heroShuffleIndex = (heroShuffleIndex + 1) % heroShufflePool.length;
    setHeroBackdropOnly(heroShufflePool[heroShuffleIndex]);
  }, HERO_SHUFFLE_INTERVAL);
}

async function primeHeroBackdropShuffle() {
  try {
    const res = await fetchWithAuth(RANDOM_MOVIES_ENDPOINT);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load random movies");
    }
    heroShufflePool = (data.results || [])
      .map((movie) => movie.backdrop_path || movie.poster_path)
      .filter(Boolean);
    heroShuffleIndex = 0;
    if (!heroShufflePool.length || hasTriggeredSearch) {
      return;
    }
    if (heroShufflePool.length === 1) {
      heroShuffleActive = true;
      setHeroBackdropOnly(heroShufflePool[0]);
      return;
    }
    startHeroBackdropShuffle();
  } catch (err) {
    console.error("Random hero fetch failed", err);
  }
}

// Generic fetch helper with optional authentication
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !isGuestMode()) {
    window.location.href = '/';
    throw new Error('Authentication required');
  }

  return response;
}

// Generic fetch helper with auth
async function getMovieData(query) {
  const res = await fetchWithAuth(
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
  currentMovie = null;
  updateBookmarkButton(null);
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

  if (!hasTriggeredSearch) {
    hasTriggeredSearch = true;
    stopHeroBackdropShuffle();
    revealLayoutGrid();
  } else {
    revealLayoutGrid();
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
    currentMovie = {
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
    };
    updateBookmarkButton(currentMovie);

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
    const res = await fetchWithAuth(RECOMMEND_ENDPOINT, {
      method: "POST",
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

if (bookmarkBtn) {
  bookmarkBtn.addEventListener("click", () => {
    if (currentMovie) {
      toggleWatchlist(currentMovie);
    }
  });
}

// Optional: initial demo
// searchAndFill("Titanic");

primeHeroBackdropShuffle();
