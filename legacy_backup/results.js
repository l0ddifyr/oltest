import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let myChart = null;

// Navigasjon
function showStep(step) {
    document.getElementById("sectionLogin").classList.toggle("hidden", step !== "login");
    document.getElementById("sectionApp").classList.toggle("hidden", step !== "app");
}

// Auth
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { showStep("app"); loadTastings(); } else { showStep("login"); }
}

document.getElementById("loginBtn").onclick = async () => {
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById("email").value,
        password: document.getElementById("pass").value
    });
    if (error) alert(error.message); else checkSession();
};

document.getElementById("logoutBtn").onclick = async () => { await supabase.auth.signOut(); location.reload(); };

// Last tilgjengelige smakinger
async function loadTastings() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("tastings").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
    document.getElementById("olsSelect").innerHTML = `<option value="">Velg ølsmaking...</option>` +
        data.map(o => `<option value="${o.id}">${o.title}</option>`).join("");
}

// Hovedfunksjon for å hente og vise data
async function loadResults() {
    const id = document.getElementById("olsSelect").value;
    if (!id) return;

    // 1. Hent Meta-data (for reveal-status)
    const { data: meta } = await supabase.from("tastings").select("*").eq("id", id).single();

    // 2. Hent Fasit (beers_public returnerer bare navn hvis revealed=true)
    const { data: beers } = await supabase.from("beers_public").select("*").eq("tasting_id", id);
    const beersMap = new Map(beers.map(b => [b.beer_no, b.name]));

    // 3. Hent alle stemmer
    const { data: ratings } = await supabase.from("ratings").select("*").eq("tasting_id", id);

    renderResults(ratings, beersMap, meta);
}

function renderResults(ratings, beersMap, meta) {
    // Beregn statistikk
    const stats = {};
    ratings.forEach(r => {
        if (!stats[r.beer_no]) stats[r.beer_no] = { beer_no: r.beer_no, sum: 0, count: 0 };
        stats[r.beer_no].sum += r.score;
        stats[r.beer_no].count++;
    });

    const ranking = Object.values(stats).map(s => ({
        ...s,
        avg: s.sum / s.count,
        name: beersMap.get(s.beer_no) || `Øl #${s.beer_no}`
    })).sort((a, b) => b.avg - a.avg);

    // Oppdater UI
    document.getElementById("sectionContent").classList.remove("hidden");
    document.getElementById("statusPillContainer").innerHTML = meta.revealed ?
        `<span class="pill success">REVEALED: Fasit er ute! ✅</span>` :
        `<span class="pill">SJULT: Kun poeng vises 🔒</span>`;

    renderChart(ranking);

    // Render Tabell
    document.getElementById("rankingRows").innerHTML = ranking.map((r, index) => `
    <tr class="${index === 0 ? 'winner-row' : ''}">
      <td><b>${r.beer_no}</b></td>
      <td>${r.name}</td>
      <td class="right"><b>${r.avg.toFixed(1)}</b></td>
      <td class="right muted">${r.count} stemmer</td>
    </tr>
  `).join("");

    // Render Enkeltstemmer
    const sortedVotes = [...ratings].sort((a, b) => b.score - a.score);
    document.getElementById("allVotesRows").innerHTML = sortedVotes.map(v => `
    <tr>
      <td>Øl #${v.beer_no}</td>
      <td>${v.display_name}</td>
      <td class="right">${v.score}</td>
    </tr>
  `).join("");
}

function renderChart(ranking) {
    const ctx = document.getElementById('resultsChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranking.map(r => r.name),
            datasets: [{
                label: 'Snittscore (0-100)',
                data: ranking.map(r => r.avg.toFixed(1)),
                backgroundColor: '#d4a017',
                borderRadius: 8,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100 }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

document.getElementById("refreshBtn").onclick = loadResults;
document.getElementById("olsSelect").onchange = loadResults;

checkSession();
