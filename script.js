const GEMINI_API_KEY = "AIzaSyD57YEowpR_JQRx6ClWbcxIB64o7x3Yncw";
const GROQ_API_KEY = "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";
const OMDB_API_KEY = "50d77de8"; // Get yours for free at omdbapi.com
const JSONBIN_API_KEY = "$2a$10$3VVauxKUj13JRBuoSdE0FO.vhSBQXYm/Rka6o/VeZPzVS5Hu7ep/2"; // Get yours for free at jsonbin.io

// State
let watchlist = [];
let JSONBIN_BIN_ID = "69beb066c3097a1dd5471412";

// DOM Elements
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar-btn') || document.getElementById('toggle-sidebar-btn');
const closeSidebarBtn = document.getElementById('closeSidebar-btn') || document.getElementById('close-sidebar-btn');
const watchlistContainer = document.getElementById('watchlist-container');
const watchlistBadge = document.getElementById('watchlist-badge');

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await initWatchlist();

    // Suggestion tags logic
    document.querySelectorAll('.suggestion-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            userInput.value = tag.textContent;
            chatForm.dispatchEvent(new Event('submit'));
        });
    });
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    // Append user message
    appendUserMessage(query);
    userInput.value = '';

    // Show typing indicator
    const typingId = showTypingIndicator();

    // Process query via hybrid AI Fallback
    await processQueryWithAI(query, typingId);
});

if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        sidebar.classList.toggle('visible');
    });
}

if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('visible');
    });
}

// Functions
function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user-message';
    msgDiv.innerHTML = `<div class="message-content">${escapeHTML(text)}</div>`;
    chatHistory.appendChild(msgDiv);
    scrollChat();
}

function appendBotTextMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message';
    msgDiv.innerHTML = `<div class="message-content">${text}</div>`;
    chatHistory.appendChild(msgDiv);
    scrollChat();
}

function getInitials(title) {
    if (!title || typeof title !== 'string') return '?';
    return title.split(' ').map(n => n.length > 0 ? n[0] : '').join('').substring(0, 2).toUpperCase();
}

window.handleImageError = function (imgElement, title) {
    const fallback = document.createElement('div');
    fallback.className = 'movie-poster-fallback';
    fallback.textContent = getInitials(title);
    imgElement.parentNode.replaceChild(fallback, imgElement);
};

window.handleWatchlistImageError = function (imgElement, title) {
    const fallback = document.createElement('div');
    fallback.className = 'watchlist-poster-fallback';
    fallback.textContent = getInitials(title);
    imgElement.parentNode.replaceChild(fallback, imgElement);
};

function appendMovieCard(movie) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message';

    const genreTags = movie.genre && Array.isArray(movie.genre) ? movie.genre.map(g => `<span class="genre-tag">${escapeHTML(g)}</span>`).join('') : '';
    const similarArray = movie.similar && Array.isArray(movie.similar) ? movie.similar : [];
    const similarLinks = similarArray.map(s => `• <a href="#" class="similar-link" data-movie="${escapeHTML(s)}">${escapeHTML(s)}</a>`).join(' ');

    const isInWatchlist = watchlist.some(m => m.id === movie.id);
    const btnClass = isInWatchlist ? 'btn-watchlist in-list' : 'btn-watchlist';
    const btnText = isInWatchlist ? '<i class="fa-solid fa-check"></i> Added to Watchlist' : '<i class="fa-solid fa-plus"></i> Add to Watchlist';

    // Fallback poster logic
    const safeTitle = escapeHTML(movie.title).replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const posterHtml = movie.poster && movie.poster.trim() !== ''
        ? `<img src="${movie.poster}" alt="${escapeHTML(movie.title)}" class="movie-poster" onerror="window.handleImageError(this, '${safeTitle}')">`
        : `<div class="movie-poster-fallback">${getInitials(movie.title)}</div>`;

    let stringifiedData;
    try {
        stringifiedData = encodeURIComponent(JSON.stringify(movie).replace(/'/g, "&apos;"));
    } catch (e) {
        stringifiedData = "{}";
    }

    msgDiv.innerHTML = `
        <div class="movie-card">
            <div class="movie-header">
                <div class="movie-poster-group">
                    ${posterHtml}
                </div>
                <div class="movie-title-area">
                    <a href="https://www.google.com/search?q=${encodeURIComponent(movie.title + ' movie')}" target="_blank" class="movie-title-link" title="Click to search on Google">
                        ${escapeHTML(movie.title)} <span style="color: var(--text-secondary); font-weight: 400;">(${escapeHTML(String(movie.year))})</span>
                    </a>
                    <div class="movie-meta-row" style="flex-wrap: wrap;">
                        <span class="imdb-score"><i class="fa-solid fa-star"></i> IMDb: ${escapeHTML(String(movie.imdb))}/10</span>
                        <span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 2px 8px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(239, 68, 68, 0.3);"><i class="fa-solid fa-apple-whole"></i> RT: ${movie.rottenTomatoes ? escapeHTML(String(movie.rottenTomatoes)) : "N/A"}</span>
                        <span>(${escapeHTML(String(movie.reviews))} reviews)</span>
                        <span style="margin-left: auto; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;"><i class="fa-solid fa-globe"></i> ${movie.language ? escapeHTML(String(movie.language)) : "Unknown"}</span>
                    </div>
                    <div class="movie-genre">
                        ${genreTags}
                    </div>
                    <button class="${btnClass}" onclick="toggleWatchlist('${movie.id}', '${stringifiedData}')" id="btn-watchlist-${movie.id}">
                        ${btnText}
                    </button>
                </div>
            </div>
            
            <div class="movie-premise">
                <span>Premise:</span> ${escapeHTML(movie.premise)}
            </div>

            <div class="movie-details-grid">
                <div class="detail-item"><span>Good to watch?</span> ${escapeHTML(movie.goodToWatch)}</div>
                <div class="detail-item"><span>Ending</span> ${escapeHTML(movie.ending)}</div>
                <div class="detail-item"><span>Tragic?</span> ${escapeHTML(movie.tragic)}</div>
                <div class="detail-item"><span>Tone / Mood</span> ${escapeHTML(movie.tone)}</div>
                <div class="detail-item"><span>Pacing</span> ${escapeHTML(movie.pacing)}</div>
                <div class="detail-item"><span>Rewatch Value</span> ${escapeHTML(movie.rewatchValue)}</div>
                <div class="detail-item"><span>Popularity</span> ${escapeHTML(movie.popularity)}</div>
            </div>

            <div class="similar-movies">
                <span>Similar movies:</span>
                <div class="similar-list">${similarLinks}</div>
            </div>
        </div>
    `;

    chatHistory.appendChild(msgDiv);
    scrollChat();

    // Attach events to similar movie links
    const links = msgDiv.querySelectorAll('.similar-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const similarName = e.target.getAttribute('data-movie');
            userInput.value = similarName;
            chatForm.dispatchEvent(new Event('submit'));
        });
    });
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = id;
    div.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatHistory.appendChild(div);
    scrollChat();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function fetchItunesPoster(title, year) {
    try {
        const searchQuery = encodeURIComponent(`${title} ${year || ''}`.trim());
        const response = await fetch(`https://itunes.apple.com/search?term=${searchQuery}&media=movie&limit=1`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            // Replace the 100x100 thumbnail with a 600x600 high-resolution poster
            return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
        }
    } catch (e) {
        console.error("iTunes API error:", e);
    }
    return null;
}

async function fetchOmdbPoster(title, year) {
    if (!OMDB_API_KEY || OMDB_API_KEY === "YOUR_OMDB_KEY") return null;
    try {
        const response = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${encodeURIComponent(year || '')}`);
        const data = await response.json();
        if (data.Response === "True" && data.Poster && data.Poster !== "N/A") {
            return data.Poster;
        }
    } catch (e) {
        console.error("OMDb API error:", e);
    }
    return null;
}

async function processQueryWithAI(query, typingId) {
    const prompt = `You are CineBot, an expert movie recommendation AI. The user is asking about the movie: "${query}".
If the user specifies a year in their query, YOU MUST return the exact movie released in that year.
CRITICAL: If the requested movie is completely made-up, meaningless gibberish, or absolutely does not exist in reality, you MUST return a JSON with title "Not Found" and empty fields.
HOWEVER, if the movie DOES genuinely exist, but you simply lack deep information about it, DO NOT return "Not Found". Instead, return the exact requested title and use logical estimates based on the genre and title to carefully fill in the missing subjective fields (Tone, Pacing, Rewatch Value, etc).

You MUST respond strictly with a raw JSON object (NO markdown blocks, NO \`\`\`json, just the raw JSON object string) matching this schema exactly:
{
  "id": "generate_a_unique_short_string_no_spaces",
  "title": "Exact Movie Title",
  "year": "Release Year",
  "imdb": "IMDB rating e.g. 8.5",
  "reviews": "Estimated review count, e.g. 1.2M",
  "genre": ["Genre1", "Genre2"],
  "goodToWatch": "Brief compelling verdict (1-2 sentences)",
  "tragic": "Yes/No with brief explanation",
  "ending": "Happy / Bittersweet / Tragic / Open-ended",
  "tone": "Comma separated tones (e.g. Gritty, philosophical)",
  "pacing": "Fast / Moderate / Slow",
  "rewatchValue": "High / Medium / Low",
  "popularity": "High / Medium / Low / Legendary etc.",
  "premise": "1-2 sentence premise without spoilers",
  "similar": ["Similar Movie 1", "Similar Movie 2", "Similar Movie 3"],
  "rottenTomatoes": "RT Score e.g. 95%",
  "language": "Primary Language(s)",
  "poster": ""
}`;

    let responseText = "";

    try {
        // Attempt 1: Gemini API
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: "You are a robotic movie database that only responds in pure JSON." }] },
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
            })
        });

        if (!geminiRes.ok) throw new Error(await geminiRes.text());
        const data = await geminiRes.json();
        responseText = data.candidates[0].content.parts[0].text;

    } catch (geminiError) {
        console.warn("Gemini Failed, falling back to Groq LLaMA...", geminiError);
        
        // Attempt 2: Groq API (Reverted to Massive 70B Model)
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.3,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: "You are a robotic movie database that only responds in pure JSON." },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!groqRes.ok) throw new Error(await groqRes.text());
            const data = await groqRes.json();
            responseText = data.choices[0].message.content;
            
        } catch (groqError) {
            console.error("Both APIs Failed:", groqError);
            removeTypingIndicator(typingId);
            appendBotTextMessage(`Sorry, I encountered an error connecting to both my primary and backup AI brains. <br><br><b>Technical Details:</b><br><small style="color: #ef4444">${escapeHTML(groqError.message)}</small>`);
            return;
        }
    }

    let movieData;
    try {
        movieData = JSON.parse(responseText.trim());
    } catch (e) {
        console.error("Failed to parse JSON from AI", responseText);
        removeTypingIndicator(typingId);
        appendBotTextMessage(`Sorry, I received an invalid response format from the AI.`);
        return;
    }

        removeTypingIndicator(typingId);

        if (movieData.title === "Not Found" || !movieData.title) {
            // Attempt OMDb Fallback
            if (OMDB_API_KEY && OMDB_API_KEY !== "YOUR_OMDB_KEY") {
                try {
                    const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(query)}`);
                    const omdbData = await omdbRes.json();
                    if (omdbData.Response === "True") {
                        movieData = {
                            id: omdbData.imdbID || Date.now().toString(),
                            title: omdbData.Title,
                            year: omdbData.Year,
                            imdb: omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "?",
                            reviews: omdbData.imdbVotes && omdbData.imdbVotes !== "N/A" ? omdbData.imdbVotes : "?",
                            genre: omdbData.Genre && omdbData.Genre !== "N/A" ? omdbData.Genre.split(', ') : [],
                            goodToWatch: "Data fallback triggered.",
                            tragic: "Unknown",
                            ending: "Unknown",
                            tone: "Unknown",
                            pacing: "Unknown",
                            rewatchValue: "Unknown",
                            popularity: "Unknown",
                            premise: omdbData.Plot && omdbData.Plot !== "N/A" ? omdbData.Plot : "No premise available.",
                            similar: [],
                            rottenTomatoes: (omdbData.Ratings && omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes")) ? omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes").Value : "N/A",
                            language: omdbData.Language && omdbData.Language !== "N/A" ? omdbData.Language : "Unknown",
                            poster: omdbData.Poster && omdbData.Poster !== "N/A" ? omdbData.Poster : ""
                        };
                        appendBotTextMessage(`Groq couldn't confidently analyze this, but I found the basic data for <strong>${escapeHTML(movieData.title)}</strong> via OMDb!`);
                        setTimeout(() => appendMovieCard(movieData), 100);
                        return;
                    }
                } catch(e) { console.error("OMDb Fallback Error:", e); }
            }
            appendBotTextMessage(`I couldn't find detailed info for "<b>${escapeHTML(query)}</b>". Please check the spelling or try another popular movie.`);
            return;
        }

        // Fetch a real, reliable poster using the free iTunes Search API matching title & year
        let realPoster = await fetchItunesPoster(movieData.title, movieData.year);

        // If iTunes doesn't have it (obscure or upcoming movie), try OMDb API as a fallback
        if (!realPoster) {
            realPoster = await fetchOmdbPoster(movieData.title, movieData.year);
        }

        if (realPoster) {
            movieData.poster = realPoster;
        }

        // Live OMDb Data Sync to correct AI formatting hallucinations
        if (OMDB_API_KEY && OMDB_API_KEY !== "YOUR_OMDB_KEY") {
            try {
                const queryTitle = movieData.title !== "Not Found" ? movieData.title : query;
                const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(queryTitle)}&y=${encodeURIComponent(movieData.year || '')}`);
                const omdbData = await omdbRes.json();
                if (omdbData.Response === "True") {
                    if (omdbData.imdbRating && omdbData.imdbRating !== "N/A") movieData.imdb = omdbData.imdbRating;
                    if (omdbData.imdbVotes && omdbData.imdbVotes !== "N/A") movieData.reviews = omdbData.imdbVotes;
                    if (omdbData.Language && omdbData.Language !== "N/A") movieData.language = omdbData.Language;
                    const rtObj = omdbData.Ratings && omdbData.Ratings.find(r => r.Source === "Rotten Tomatoes");
                    if (rtObj) movieData.rottenTomatoes = rtObj.Value;
                }
            } catch(e) { console.error("OMDb Live Sync Error:", e); }
        }

        appendBotTextMessage(`Here is the decision-making info you requested for <strong>${escapeHTML(movieData.title)}</strong>:`);
        setTimeout(() => appendMovieCard(movieData), 100);

        removeTypingIndicator(typingId);
}

// Watchlist Logic
window.toggleWatchlist = function (id, movieDataEncoded) {
    let movie;
    if (movieDataEncoded && movieDataEncoded !== 'undefined') {
        try {
            movie = JSON.parse(decodeURIComponent(movieDataEncoded).replace(/&apos;/g, "'"));
        } catch (e) {
            console.error(e);
        }
    }
    if (!movie) {
        movie = watchlist.find(m => m.id === id);
    }

    if (!movie) return;

    const index = watchlist.findIndex(m => m.id === id);
    if (index === -1) {
        // Add
        watchlist.push({
            id: movie.id,
            title: movie.title,
            year: movie.year,
            imdb: movie.imdb,
            rottenTomatoes: movie.rottenTomatoes,
            language: movie.language,
            poster: movie.poster
        });
    } else {
        // Remove
        watchlist.splice(index, 1);
    }

    // Save
    localStorage.setItem('cinebot_watchlist', JSON.stringify(watchlist));
    syncWatchlistToJsonBin();

    // Update Button UI in chat everywhere it exists
    const btns = document.querySelectorAll(`#btn-watchlist-${id}`);
    btns.forEach(btn => {
        if (index === -1) { // was added
            btn.className = 'btn-watchlist in-list';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Added to Watchlist';
        } else { // was removed
            btn.className = 'btn-watchlist';
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Watchlist';
        }
    });

    renderWatchlist();
};

window.removeFromWatchlist = function (id) {
    window.toggleWatchlist(id);
};

function renderWatchlist() {
    watchlistContainer.innerHTML = '';

    // Update badge
    if (watchlist.length > 0) {
        watchlistBadge.style.display = 'block';
        watchlistBadge.textContent = watchlist.length;
    } else {
        watchlistBadge.style.display = 'none';
        watchlistContainer.innerHTML = '<p class="empty-state">Your watchlist is empty.<br><br>Find a movie and click "Add to Watchlist".</p>';
        return;
    }

    watchlist.forEach((movie, idx) => {
        if (!movie) return; // Skip corrupted null items
        const div = document.createElement('div');
        div.className = 'watchlist-item';

        const displayTitle = movie.title || movie.name || "Unknown";
        const displayYear = movie.year || "";
        const displayImdb = movie.imdb || "";
        const displayRT = movie.rottenTomatoes || "";

        const safeTitle = escapeHTML(displayTitle).replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const posterHtml = movie.poster && typeof movie.poster === 'string' && movie.poster.trim() !== ''
            ? `<img src="${movie.poster}" alt="${escapeHTML(displayTitle)}" onerror="window.handleWatchlistImageError(this, '${safeTitle}')">`
            : `<div class="watchlist-poster-fallback">${getInitials(displayTitle)}</div>`;

        div.innerHTML = `
            <div class="watchlist-item-content" style="display: flex; gap: 12px; cursor: pointer; flex: 1; align-items: center;" title="Click to search for this movie">
                ${posterHtml}
                <div class="watchlist-item-info">
                    <div class="watchlist-item-title">${escapeHTML(displayTitle)}</div>
                    <div class="watchlist-item-year">
                        ${escapeHTML(String(displayYear))} 
                        <span class="watchlist-item-imdb" style="color: #fcd34d; margin-left: 6px;" title="IMDb"><i class="fa-solid fa-star"></i> ${escapeHTML(String(displayImdb))}</span>
                        ${displayRT ? `<span class="watchlist-item-rt" style="color: #fca5a5; margin-left: 6px;" title="Rotten Tomatoes"><i class="fa-solid fa-apple-whole"></i> ${escapeHTML(String(displayRT))}</span>` : ''}
                    </div>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFromWatchlist('${movie.id || idx}')" title="Remove">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        const contentArea = div.querySelector('.watchlist-item-content');
        if (contentArea) {
            contentArea.addEventListener('click', () => {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('visible');
                userInput.value = displayTitle + (displayYear ? ' ' + displayYear : '');
                chatForm.dispatchEvent(new Event('submit'));
            });
        }

        watchlistContainer.appendChild(div);
    });
}

function scrollChat() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// JSONBin Sync Logic
async function initWatchlist() {
    if (JSONBIN_API_KEY && JSONBIN_API_KEY !== "YOUR_JSONBIN_API_KEY") {
        if (JSONBIN_BIN_ID) {
            try {
                const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
                    headers: { 'X-Master-Key': JSONBIN_API_KEY }
                });
                const data = await res.json();
                if (data.record) {
                    if (Array.isArray(data.record)) {
                        watchlist = data.record;
                    } else if (Array.isArray(data.record.movies)) {
                        watchlist = data.record.movies;
                    } else {
                        watchlist = [];
                    }
                    console.log("Watchlist synced from Cloud!");
                }
            } catch (e) {
                console.error("Cloud sync failed, falling back to local:", e);
                watchlist = JSON.parse(localStorage.getItem('cinebot_watchlist')) || [];
            }
        } else {
            // First time setup: sync local to newly created bin
            watchlist = JSON.parse(localStorage.getItem('cinebot_watchlist')) || [];
            if (watchlist.length > 0) syncWatchlistToJsonBin();
        }
    } else {
        watchlist = JSON.parse(localStorage.getItem('cinebot_watchlist')) || [];
    }
    renderWatchlist();
}

async function syncWatchlistToJsonBin() {
    if (!JSONBIN_API_KEY || JSONBIN_API_KEY === "YOUR_JSONBIN_API_KEY") return;

    if (!JSONBIN_BIN_ID) {
        try {
            const res = await fetch("https://api.jsonbin.io/v3/b", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Master-Key": JSONBIN_API_KEY,
                    "X-Bin-Name": "CineBot_Watchlist"
                },
                body: JSON.stringify(watchlist)
            });
            const data = await res.json();
            JSONBIN_BIN_ID = data.metadata.id;
            localStorage.setItem('cinebot_jsonbin_id', JSONBIN_BIN_ID);
            console.log("Created Cloud Bin ID:", JSONBIN_BIN_ID);
        } catch (e) { console.error("Error creating bin:", e); }
        return;
    }

    try {
        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": JSONBIN_API_KEY
            },
            body: JSON.stringify(watchlist)
        });
        console.log("Saved specific changes to Cloud Bin");
    } catch (e) { console.error("Error updating bin:", e); }
}
