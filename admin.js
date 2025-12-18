import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentOlsId = null;
let currentBeerNo = 1;

// Navigasjon mellom steg
function showStep(step) {
    document.getElementById("sectionLogin").classList.toggle("hidden", step !== "login");
    document.getElementById("sectionPicker").classList.toggle("hidden", step !== "picker");
    document.getElementById("sectionControl").classList.toggle("hidden", step !== "control");
}

// Auth funksjoner
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { showStep("picker"); loadTastings(); } else { showStep("login"); }
}

document.getElementById("loginBtn").onclick = async () => {
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById("email").value,
        password: document.getElementById("pass").value
    });
    if (error) alert("Feil: " + error.message); else checkSession();
};

document.getElementById("logoutBtn").onclick = async () => { await supabase.auth.signOut(); location.reload(); };

// Last tester
async function loadTastings() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("tastings").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
    document.getElementById("olsSelect").innerHTML = `<option value="">Velg ølsmaking...</option>` +
        data.map(o => `<option value="${o.id}">${o.title}</option>`).join("");
}

// Velg en test
async function selectTasting(id) {
    if (!id) return;
    const { data, error } = await supabase.from("tastings").select("*").eq("id", id).single();
    if (error) return;

    currentOlsId = id;
    currentBeerNo = data.current_beer_no || 1;
    document.getElementById("displayTitle").textContent = data.title;
    document.getElementById("displayJoinCode").textContent = `KODE: ${data.join_code}`;
    updateControlUI(data);
    showStep("control");
    updateVoterProgress();
    refreshBeers();
}

function updateControlUI(data) {
    document.getElementById("currentBeerText").textContent = `Øl #${currentBeerNo}`;
    document.getElementById("progressBeerNo").textContent = currentBeerNo;
    const pill = document.getElementById("revealStatusPill");
    pill.textContent = data.revealed ? "Status: REVEALED ✅" : "Status: SKJULT 🔒";
    pill.className = data.revealed ? "pill success" : "pill";
}

document.getElementById("olsSelect").onchange = (e) => selectTasting(e.target.value);
document.getElementById("backToPicker").onclick = () => { currentOlsId = null; showStep("picker"); };

// Styring av nummer
async function changeBeer(delta) {
    const nextNo = Math.max(1, currentBeerNo + delta);
    const { error } = await supabase.from("tastings").update({ current_beer_no: nextNo }).eq("id", currentOlsId);
    if (!error) {
        currentBeerNo = nextNo;
        document.getElementById("currentBeerText").textContent = `Øl #${currentBeerNo}`;
        document.getElementById("progressBeerNo").textContent = currentBeerNo;
        updateVoterProgress();
    }
}

document.getElementById("nextBeerBtn").onclick = () => changeBeer(1);
document.getElementById("prevBeerBtn").onclick = () => changeBeer(-1);

// Deltakeroversikt
async function updateVoterProgress() {
    if (!currentOlsId || document.getElementById("sectionControl").classList.contains("hidden")) return;
    const { data: ratings } = await supabase.from("ratings").select("display_name, beer_no").eq("tasting_id", currentOlsId);

    const participants = [...new Set(ratings.map(r => r.display_name))];
    document.getElementById("totalVotersCount").textContent = `${participants.length} påmeldte`;
    document.getElementById("allParticipants").innerHTML = participants.map(p => `<span class="pill">${p}</span>`).join("");

    const votedNow = ratings.filter(r => r.beer_no === currentBeerNo).map(r => r.display_name);
    document.getElementById("voterList").innerHTML = votedNow.length ? votedNow.map(v => `<span class="pill success">${v} ✅</span>`).join("") : `<span class="muted">Ingen har stemt ennå...</span>`;
}

// FASIT-LOGIKK
document.getElementById("addBeerToPoolBtn").onclick = async () => {
    const name = document.getElementById("newBeerName").value.trim();
    if (!name) return;

    // Bruker et midlertidig høyt nummer (f.eks 999) for å passere CHECK > 0
    // Vi legger til et tilfeldig tall i tillegg så du kan ha flere i poolen samtidig
    const tempNo = 500 + Math.floor(Math.random() * 499);

    const { error } = await supabase.from("beers").insert({
        tasting_id: currentOlsId,
        name: name,
        beer_no: tempNo
    });

    if (error) {
        alert("Feil: " + error.message);
    } else {
        document.getElementById("newBeerName").value = "";
        refreshBeers();
    }
};

document.getElementById("saveToFasitBtn").onclick = async () => {
    const name = document.getElementById("beerPoolSelect").value;
    const no = parseInt(document.getElementById("assignBeerNo").value);
    if (!name || !no) return alert("Velg øl og nummer");

    // 1. Lagre det nye nummeret
    const { error } = await supabase.from("beers").upsert({
        tasting_id: currentOlsId,
        beer_no: no,
        name: name
    }, { onConflict: "tasting_id,beer_no" });

    if (!error) {
        // 2. Slett alle versjoner av dette ølet som har et nummer > 499 (rydding i poolen)
        await supabase.from("beers")
            .delete()
            .eq("tasting_id", currentOlsId)
            .eq("name", name)
            .gt("beer_no", 499);

        document.getElementById("assignBeerNo").value = "";
        refreshBeers();
    } else {
        alert("Feil ved lagring: " + error.message);
    }
};

async function refreshBeers() {
    const { data } = await supabase.from("beers")
        .select("*")
        .eq("tasting_id", currentOlsId)
        .order("beer_no");

    // Kun vis øl med "ekte" numre (1-499) i tabellen
    const fasit = data.filter(b => b.beer_no > 0 && b.beer_no <= 499);
    document.getElementById("beerRows").innerHTML = fasit.map(b => `
  <tr>
    <td><b>${b.beer_no}</b></td>
    <td>${b.name}</td>
    <td style="text-align:right"><button class="danger" onclick="deleteBeer('${b.id}')">Slett</button></td>
  </tr>
`).join("");

    // Vis ALLE i dropdown, men merk de som er i poolen (500+)
    document.getElementById("beerPoolSelect").innerHTML = `<option value="">Velg fra pool...</option>` +
        data.map(b => `<option value="${b.name}">${b.name} ${b.beer_no > 499 ? '(i pool)' : '(#' + b.beer_no + ')'}</option>`).join("");
}

window.deleteBeer = async (id) => {
    if (confirm("Slette dette ølet fra listen?")) {
        await supabase.from("beers").delete().eq("id", id);
        refreshBeers();
    }
};

// Opprett ny
document.getElementById("createOlsBtn").onclick = async () => {
    const title = document.getElementById("title").value;
    const n = document.getElementById("totalBeers").value;
    if (!title || !n) return alert("Fyll inn navn og antall");
    const { data, error } = await supabase.from("tastings").insert({ title: title, total_beers: n }).select().single();
    if (!error) selectTasting(data.id); else alert(error.message);
};

document.getElementById("revealBtn").onclick = async () => {
    if (confirm("Vil du avsløre alle ølnavnene for deltakerne nå?")) {
        await supabase.from("tastings").update({ revealed: true }).eq("id", currentOlsId);
        const { data } = await supabase.from("tastings").select("*").eq("id", currentOlsId).single();
        updateControlUI(data);
    }
};

setInterval(updateVoterProgress, 5000);
checkSession();
