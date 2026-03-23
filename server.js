require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '')));

// API Keys strictly from backend environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// Helper: iTunes Poster fetching
async function fetchItunesPoster(title, year) {
    try {
        const searchQuery = encodeURIComponent(`${title} ${year || ''}`.trim());
        const response = await fetch(`https://itunes.apple.com/search?term=${searchQuery}&media=movie&limit=1`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
        }
    } catch (e) {
        console.error("iTunes API error:", e);
    }
    return null;
}

// POST endpoint to handle chat requests securely
app.post('/api/chat', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    let extractedTitle = query;
    let extractedYear = "";

    // STEP 1: Fast Groq query to extract Title and Year natively
    try {
        const groqExtraction = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "You extract movie titles and release years from user queries. Respond ONLY in raw JSON format: {\"title\": \"string\", \"year\": \"string\"}. If no year is specified, leave it empty." },
                    { role: "user", content: query }
                ]
            })
        });

        if (groqExtraction.ok) {
            const data = await groqExtraction.json();
            const parsed = JSON.parse(data.choices[0].message.content);
            if (parsed.title) extractedTitle = parsed.title;
            if (parsed.year) extractedYear = parsed.year;
        }
    } catch (e) {
        console.warn("Groq extraction failed, falling back to raw query");
    }

    // STEP 2: Fetch REAL data from OMDb API
    let movieData = null;
    if (OMDB_API_KEY && OMDB_API_KEY !== "YOUR_OMDB_KEY") {
        try {
            const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(extractedTitle)}&y=${encodeURIComponent(extractedYear)}&plot=full`);
            const omdbData = await omdbRes.json();
            
            if (omdbData.Response === "True") {
                movieData = {
                    id: omdbData.imdbID || Date.now().toString(),
                    title: omdbData.Title,
                    year: omdbData.Year,
                    imdb: omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "?",
                    reviews: omdbData.imdbVotes && omdbData.imdbVotes !== "N/A" ? omdbData.imdbVotes : "?",
                    genre: omdbData.Genre && omdbData.Genre !== "N/A" ? omdbData.Genre.split(', ') : [],
                    goodToWatch: "Pending...",
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

                // Fetch subjective details via Groq
                try {
                    const detailRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
                                { role: "system", content: 'You are an expert movie analyst. Return ONLY JSON with these exact string keys: "premise" (detailed 3-4 sentence spoiler-free summary), "goodToWatch" (detailed 2-3 sentence verdict explaining who should watch it), "tragic" (1-2 sentence contextual explanation of emotional weight), "ending" (Happy/Sad/Open), "tone", "pacing", "rewatchValue", "popularity", "similar" (Array of 3 similar movie titles).' },
                                { role: "user", content: `Movie: ${movieData.title} (${movieData.year})\nBaseline Plot: ${movieData.premise}` }
                            ]
                        })
                    });
                    if (detailRes.ok) {
                        const detailData = await detailRes.json();
                        const parsedDetails = JSON.parse(detailData.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim());
                        if (parsedDetails.premise) movieData.premise = parsedDetails.premise;
                        movieData.goodToWatch = parsedDetails.goodToWatch || "Good watch.";
                        movieData.tragic = parsedDetails.tragic || "Unknown";
                        movieData.ending = parsedDetails.ending || "Unknown";
                        movieData.tone = parsedDetails.tone || "Unknown";
                        movieData.pacing = parsedDetails.pacing || "Unknown";
                        movieData.rewatchValue = parsedDetails.rewatchValue || "Unknown";
                        movieData.popularity = parsedDetails.popularity || "Unknown";
                        movieData.similar = parsedDetails.similar && Array.isArray(parsedDetails.similar) ? parsedDetails.similar : [];
                    }
                } catch (err) { console.warn("Failed subjective AI enhancement"); }

                // iTunes Poster Fallback
                let realPoster = await fetchItunesPoster(movieData.title, movieData.year);
                if (realPoster) movieData.poster = realPoster;
            }
        } catch(e) { console.error("OMDb Direct Fetch Error:", e); }
    }

    // STEP 3: Fallback to Gemini if totally missed by OMDb
    if (!movieData) {
        const fullPrompt = `You are CineBot, an expert movie recommendation AI. The user is asking about the movie: "${query}".
If the user specifies a year in their query, YOU MUST return the exact movie released in that year.
CRITICAL: If the requested movie is completely made-up, meaningless gibberish, or absolutely does not exist in reality, you MUST return a JSON with title "Not Found" and empty fields.

You MUST respond strictly with a raw JSON object matching this schema exactly:
{
  "id": "generate_a_unique_short_string_no_spaces",
  "title": "Exact Movie Title",
  "year": "Release Year",
  "imdb": "IMDB rating e.g. 8.5",
  "reviews": "Estimated review count, e.g. 1.2M",
  "genre": ["Genre1", "Genre2"],
  "premise": "Detailed 3-4 sentence spoiler-free summary",
  "goodToWatch": "Detailed 2-3 sentence verdict explaining exactly who should watch it and why",
  "tragic": "Detailed 1-2 sentence contextual explanation of its emotional weight",
  "ending": "Happy / Bittersweet / Tragic / Open-ended",
  "tone": "Comma separated tones (e.g. Gritty, philosophical)",
  "pacing": "Fast / Moderate / Slow",
  "rewatchValue": "High / Medium / Low",
  "popularity": "High / Medium / Low / Legendary etc.",
  "similar": ["Similar Movie 1", "Similar Movie 2", "Similar Movie 3"],
  "rottenTomatoes": "RT Score e.g. 95%",
  "language": "Primary Language(s)",
  "poster": ""
}`;
        try {
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: "You are a robotic movie database that only responds in pure JSON." }] },
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    tools: [{ googleSearch: {} }],
                    generationConfig: { temperature: 0.3 }
                })
            });

            if (!geminiRes.ok) throw new Error(await geminiRes.text());
            const data = await geminiRes.json();
            const responseText = data.candidates[0].content.parts[0].text;
            
            const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            movieData = JSON.parse(cleanedText);

            if (movieData.title === "Not Found" || !movieData.title) {
                movieData = null;
            } else {
                let realPoster = await fetchItunesPoster(movieData.title, movieData.year);
                if (realPoster) movieData.poster = realPoster;
            }
        } catch (geminiError) {
            console.error("Gemini Search Failed:", geminiError);
        }
    }

    if (!movieData) {
        return res.status(404).json({ error: `I couldn't find detailed info for "${query}". Please check the spelling or try another popular movie.` });
    }

    // Return the perfectly built data object to the frontend securely!
    res.json(movieData);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Secure Backend Server running on port ${PORT}`));
