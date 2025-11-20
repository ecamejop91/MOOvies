const WATCHLIST_KEY = "moovies_watchlist";

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

function renderWatchlist() {
  const container = document.getElementById("watchlistSection");
  const list = loadWatchlist();
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = '<div class="watchlist-empty">No movies saved yet.</div>';
    return;
  }

  list.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "watchlist-card";

    const poster = document.createElement("div");
    poster.className = "watchlist-poster";
    if (movie.poster_path) {
      poster.style.backgroundImage = `url(https://image.tmdb.org/t/p/w342${movie.poster_path})`;
    } else if (movie.backdrop_path) {
      poster.style.backgroundImage = `url(https://image.tmdb.org/t/p/w342${movie.backdrop_path})`;
    } else {
      poster.textContent = "No art";
    }

    const body = document.createElement("div");
    body.className = "watchlist-body";
    const title = document.createElement("h2");
    title.textContent = movie.title || "Untitled";
    const overview = document.createElement("p");
    overview.textContent = movie.overview || "No description";

    const meta = document.createElement("div");
    meta.className = "watchlist-meta";
    if (movie.release_date) {
      meta.textContent = new Date(movie.release_date).getFullYear();
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-watchlist-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeFromWatchlist(movie.id));

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(overview);
    body.appendChild(removeBtn);

    card.appendChild(poster);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function removeFromWatchlist(id) {
  const list = loadWatchlist().filter((item) => item.id !== id);
  saveWatchlist(list);
  renderWatchlist();
}

renderWatchlist();
