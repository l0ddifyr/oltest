import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const sSetup = document.getElementById("screenSetup"), sRate = document.getElementById("screenRate");
const smakEl = document.getElementById("smak"), ettersmakEl = document.getElementById("ettersmak"), fargeEl = document.getElementById("farge"), luktEl = document.getElementById("lukt");
const totalPreview = document.getElementById("totalPreview"), status = document.getElementById("status");

let tastingId = null, currentBeerNo = 1, userId = null, channel = null;

function updateUI() {
    document.getElementById('val-smak').textContent = smakEl.value;
    document.getElementById('val-ettersmak').textContent = ettersmakEl.value;
    document.getElementById('val-farge').textContent = fargeEl.value;
    document.getElementById('val-lukt').textContent = luktEl.value;
    const total = Number(smakEl.value) + Number(ettersmakEl.value) + Number(fargeEl.value) + Number(luktEl.value);
    totalPreview.textContent = `${total} / 100 poeng`;
}

[smakEl, ettersmakEl, fargeEl, luktEl].forEach(el => el.addEventListener("input", updateUI));

async function ensureSession(){
    const { data:{session} } = await supabase.auth.getSession();
    if(session) { userId = session.user.id; }
    else {
        const { data } = await supabase.auth.signInAnonymously();
        userId = data.session.user.id;
    }
}

async function loadMeta(id) {
    const { data } = await supabase.from("tastings").select("*").eq("id", id).single();
    document.getElementById("olsTitle").textContent = data.title;
    currentBeerNo = data.current_beer_no || 1;
    document.getElementById("currentBeerLabel").textContent = `Øl #${currentBeerNo}`;
    document.getElementById("beerHelp").textContent = `Øl ${currentBeerNo} av ${data.total_beers}`;
}

async function loadMyRatings() {
    const { data } = await supabase.from("ratings").select("beer_no, score").eq("tasting_id", tastingId).eq("user_id", userId).order("beer_no", {ascending: false});
    document.getElementById("rows").innerHTML = data.map(r => `<tr><td>Øl #${r.beer_no}</td><td style="text-align:right"><b>${r.score} poeng</b></td></tr>`).join("");
}

async function loadCurrentRating() {
    const { data } = await supabase.from("ratings").select("*").eq("tasting_id", tastingId).eq("user_id", userId).eq("beer_no", currentBeerNo).maybeSingle();
    if(data) {
        smakEl.value = data.smak; ettersmakEl.value = data.ettersmak; fargeEl.value = data.farge; luktEl.value = data.lukt;
        status.textContent = "Du har stemt på denne.";
    } else {
        smakEl.value = ettersmakEl.value = fargeEl.value = luktEl.value = 0;
        status.textContent = "";
    }
    updateUI();
}

async function subscribe() {
    if(channel) supabase.removeChannel(channel);
    channel = supabase.channel(`ols-${tastingId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tastings", filter: `id=eq.${tastingId}` }, async (payload) => {
            if(payload.new.current_beer_no !== currentBeerNo) {
                currentBeerNo = payload.new.current_beer_no;
                await loadMeta(tastingId);
                await loadCurrentRating();
            }
        })
        .subscribe((s) => {
            document.getElementById("livePill").textContent = s === "SUBSCRIBED" ? "LIVE ✓" : "Offline";
            document.getElementById("livePill").style.background = s === "SUBSCRIBED" ? "#e8f5e9" : "#eee";
        });
}

document.getElementById("start").onclick = async () => {
    const code = document.getElementById("joinCode").value.toUpperCase().trim();
    const name = document.getElementById("name").value.trim();
    if(code.length !== 4 || !name) return alert("Sjekk kode og navn!");

    document.getElementById("setupStatus").textContent = "Kobler til...";
    const { data: ols } = await supabase.rpc("get_ols_by_join_code", { p_code: code });

    if(!ols || ols.length === 0) {
        document.getElementById("setupStatus").textContent = "Ugyldig kode";
        return;
    }

    tastingId = ols[0].id;
    localStorage.setItem("j_id", tastingId);
    localStorage.setItem("j_name", name);

    document.getElementById("who").textContent = name;
    await loadMeta(tastingId);
    await loadMyRatings();
    await loadCurrentRating();
    await subscribe();

    sSetup.style.display = "none";
    sRate.style.display = "block";
};

document.getElementById("save").onclick = async () => {
    status.textContent = "Lagrer...";
    const total = Number(smakEl.value) + Number(ettersmakEl.value) + Number(fargeEl.value) + Number(luktEl.value);
    const { error } = await supabase.from("ratings").upsert({
        tasting_id: tastingId, beer_no: currentBeerNo, user_id: userId,
        display_name: localStorage.getItem("j_name"),
        smak: smakEl.value, ettersmak: ettersmakEl.value, farge: fargeEl.value, lukt: luktEl.value, score: total
    }, { onConflict: "tasting_id,beer_no,user_id" });

    if(!error) {
        status.textContent = "✅ Lagret!";
        await loadMyRatings();
    } else {
        status.textContent = "Feil ved lagring";
    }
};

document.getElementById("reset").onclick = () => { if(confirm("Logge ut?")) { localStorage.clear(); location.reload(); } };

(async () => {
    await ensureSession();
    if(localStorage.getItem("j_id")) {
        tastingId = localStorage.getItem("j_id");
        document.getElementById("who").textContent = localStorage.getItem("j_name");
        await loadMeta(tastingId);
        await loadMyRatings();
        await loadCurrentRating();
        await subscribe();
        sSetup.style.display = "none";
        sRate.style.display = "block";
    }
    updateUI();
})();
