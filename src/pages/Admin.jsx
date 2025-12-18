import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
    const [step, setStep] = useState('login'); // login | picker | control
    const [loading, setLoading] = useState(false);

    // Login
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Picker
    const [tastings, setTastings] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [newCount, setNewCount] = useState('');

    // Control
    const [currentOlsId, setCurrentOlsId] = useState(null);
    const [activeTasting, setActiveTasting] = useState(null);
    const [currentBeerNo, setCurrentBeerNo] = useState(1);
    const [participants, setParticipants] = useState([]);
    const [votedNow, setVotedNow] = useState([]);

    // Fasit
    const [newBeerName, setNewBeerName] = useState('');
    const [poolBeers, setPoolBeers] = useState([]);
    const [fasitBeers, setFasitBeers] = useState([]);

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        let interval;
        if (step === 'control' && currentOlsId) {
            updateVoterProgress();
            interval = setInterval(updateVoterProgress, 5000);
        }
        return () => clearInterval(interval);
    }, [step, currentOlsId, currentBeerNo]);

    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setStep('picker');
            loadTastings();
        } else {
            setStep('login');
        }
    };

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Feil: " + error.message);
        else checkSession();
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    const loadTastings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("tastings").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
        setTastings(data || []);
    };

    const handleCreate = async () => {
        if (!newTitle || !newCount) return alert("Fyll inn navn og antall");
        const { data, error } = await supabase.from("tastings").insert({ title: newTitle, total_beers: newCount }).select().single();
        if (!error) selectTasting(data.id);
        else alert(error.message);
    };

    const selectTasting = async (id) => {
        if (!id) return;
        const { data, error } = await supabase.from("tastings").select("*").eq("id", id).single();
        if (error) return;

        setCurrentOlsId(id);
        setActiveTasting(data);
        setCurrentBeerNo(data.current_beer_no || 1);
        setStep('control');
        updateVoterProgress();
        refreshFasit(id);
    };

    const updateVoterProgress = async () => {
        if (!currentOlsId) return;
        const { data: ratings } = await supabase.from("ratings").select("display_name, beer_no").eq("tasting_id", currentOlsId);
        if (!ratings) return;

        const parts = [...new Set(ratings.map(r => r.display_name))];
        setParticipants(parts);
        const vn = ratings.filter(r => r.beer_no === currentBeerNo).map(r => r.display_name);
        setVotedNow(vn);
    };

    const changeBeer = async (delta) => {
        const nextNo = Math.max(1, currentBeerNo + delta);
        const { error } = await supabase.from("tastings").update({ current_beer_no: nextNo }).eq("id", currentOlsId);
        if (!error) {
            setCurrentBeerNo(nextNo);
            updateVoterProgress();
        }
    };

    const handleAddPool = async () => {
        if (!newBeerName) return;
        const tempNo = 500 + Math.floor(Math.random() * 499);
        const { error } = await supabase.from("beers").insert({
            tasting_id: currentOlsId, name: newBeerName, beer_no: tempNo
        });
        if (error) alert(error.message);
        else { setNewBeerName(''); refreshFasit(currentOlsId); }
    };

    const handleAssign = async (beerId, number) => {
        if (!number) return;
        const { error } = await supabase.from("beers").update({ beer_no: number }).eq("id", beerId);
        if (error) alert(error.message);
        else refreshFasit(currentOlsId);
    };

    const handleUnassign = async (beerId) => {
        const tempNo = 500 + Math.floor(Math.random() * 9999);
        const { error } = await supabase.from("beers").update({ beer_no: tempNo }).eq("id", beerId);
        if (error) alert(error.message);
        else refreshFasit(currentOlsId);
    };

    const refreshFasit = async (id = currentOlsId) => {
        if (!id) return;
        const { data } = await supabase.from("beers").select("*").eq("tasting_id", id).order("beer_no");
        if (data) {
            setFasitBeers(data.filter(b => b.beer_no <= 499));
            setPoolBeers(data);
        }
    };

    const deleteBeer = async (id) => {
        if (confirm("Slette dette ølet fra listen?")) {
            await supabase.from("beers").delete().eq("id", id);
            refreshFasit(currentOlsId);
        }
    };

    const toggleReveal = async () => {
        if (confirm("Vil du avsløre alle ølnavnene for deltakerne nå?")) {
            await supabase.from("tastings").update({ revealed: true }).eq("id", currentOlsId);
            const { data } = await supabase.from("tastings").select("*").eq("id", currentOlsId).single();
            setActiveTasting(data);
        }
    };

    const getAvailableNumbers = () => {
        if (!activeTasting?.total_beers) return [];
        const total = activeTasting.total_beers;
        const used = new Set(fasitBeers.map(b => b.beer_no));
        const available = [];
        for (let i = 1; i <= total; i++) {
            if (!used.has(i)) available.push(i);
        }
        return available;
    };

    if (step === 'login') {
        return (
            <div className="container max-w-sm mx-auto mt-20 text-center">
                <h1>Admin 🍺</h1>
                <div className="card">
                    <h2>Logg inn</h2>
                    <input placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} className="mb-2" />
                    <input placeholder="Passord" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button onClick={handleLogin}>Logg inn</button>
                </div>
            </div>
        );
    }

    if (step === 'picker') {
        return (
            <div className="container mt-10">
                <div className="flex justify-between items-center mb-6">
                    <h1>Dine ølsmakinger</h1>
                    <button onClick={handleLogout} className="secondary w-auto">Logg ut</button>
                </div>

                <div className="card">
                    <label>Velg eksisterende</label>
                    <select onChange={(e) => selectTasting(e.target.value)} defaultValue="">
                        <option value="" disabled>Velg...</option>
                        {tastings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>

                    <hr className="my-6 border-gray-200" />

                    <h3>Opprett ny test</h3>
                    <input placeholder="Navn (f.eks. Juleøl 2025)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="mb-2" />
                    <input type="number" placeholder="Antall øl totalt" value={newCount} onChange={e => setNewCount(e.target.value)} />
                    <button onClick={handleCreate}>Start ny ølsmaking</button>
                </div>
            </div>
        );
    }

    const availableNumbers = getAvailableNumbers();

    return (
        <div className="container-wide pb-20">
            <div className="card border-2 border-[#d4a017] text-center">
                <div className="flex justify-between items-center">
                    <button onClick={() => setStep('picker')} className="secondary text-xs w-auto px-2">◀ Bytt test</button>
                    <span className="pill bg-[#e3f2fd] text-[#1976d2] px-2 py-1 rounded-full text-xs font-bold font-mono">
                        KODE: {activeTasting?.join_code}
                    </span>
                </div>

                <div className="text-gray-500 mt-2 text-sm uppercase tracking-wide">{activeTasting?.title}</div>
                <div className="text-4xl font-black text-[#800000] my-2">Øl #{currentBeerNo}</div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <button onClick={() => changeBeer(-1)} className="secondary w-full flex justify-center items-center">◀ Forrige</button>
                    <button onClick={() => changeBeer(1)} className="w-full flex justify-center items-center">Neste øl ▶</button>
                </div>
            </div>

            <div className="card">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                    <h3 className="m-0">Status deltakere</h3>
                    <span className="pill bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-green-100">{participants.length}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="text-xs text-gray-400 uppercase font-black tracking-widest mb-2">Alle i rommet</div>
                        <div className="flex flex-wrap gap-2">
                            {participants.length ? participants.map(p => (
                                <span key={p} className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold border border-gray-100 shadow-sm">{p}</span>
                            )) : <span className="text-gray-300 italic">Ingen ennå</span>}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-green-700 uppercase font-black tracking-widest mb-2">Har stemt på Øl #{currentBeerNo}</div>
                        <div className="flex flex-wrap gap-2">
                            {votedNow.length ? votedNow.map(v => (
                                <span key={v} className="px-3 py-1 bg-green-50 text-green-800 rounded-lg text-sm font-bold border border-green-100 shadow-sm flex items-center gap-1">
                                    {v} <span className="text-xs">✅</span>
                                </span>
                            )) : <span className="text-gray-400 italic text-sm">Venter på stemmer...</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* POOL Column */}
                <div className="card h-fit">
                    <h3 className="mb-4">1. Øl-Pool (Uplasserte)</h3>
                    <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Legg til øl</label>
                        <div className="flex flex-col gap-3">
                            <input
                                placeholder="Navn på øl..."
                                value={newBeerName}
                                onChange={e => setNewBeerName(e.target.value)}
                                className="w-full bg-white p-3 rounded-xl border-2 border-gray-200 text-lg font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-300"
                            />
                            <button onClick={handleAddPool} className="w-full py-3 font-bold text-white bg-green-600 rounded-xl shadow-sm hover:bg-green-700 active:scale-95 transition-all text-lg flex justify-center items-center">
                                + Legg til
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {poolBeers.filter(b => b.beer_no > 499).map(b => (
                            <div key={b.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                <span className="font-bold text-gray-700">{b.name}</span>
                                <div className="flex gap-2">
                                    <select
                                        className="w-24 py-1 px-2 text-sm border-gray-200"
                                        onChange={(e) => handleAssign(b.id, e.target.value)}
                                        value=""
                                    >
                                        <option value="" disabled>Velg nr...</option>
                                        {availableNumbers.map(n => (
                                            <option key={n} value={n}>#{n}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => deleteBeer(b.id)} className="danger py-1 px-2 h-auto mt-0">🗑️</button>
                                </div>
                            </div>
                        ))}
                        {poolBeers.filter(b => b.beer_no > 499).length === 0 && <div className="text-center text-gray-400 italic py-4">Ingen øl i poolen</div>}
                    </div>
                </div>

                {/* FASIT Column */}
                <div className="card h-fit border-2 border-green-50">
                    <h3 className="mb-4">2. Fasit (Plasserte)</h3>
                    <div className="space-y-2">
                        {fasitBeers.map(b => (
                            <div key={b.id} className="flex justify-between items-center p-3 bg-[#f0fff4] border border-green-100 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-full font-black text-sm">
                                        {b.beer_no}
                                    </div>
                                    <span className="font-bold text-gray-800">{b.name}</span>
                                </div>
                                <button onClick={() => handleUnassign(b.id)} className="secondary w-auto py-1 px-3 text-xs mt-0 h-auto bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                                    Reset ↺
                                </button>
                            </div>
                        ))}
                        {fasitBeers.length === 0 && <div className="text-center text-gray-400 italic py-4">Ingen plasserte øl</div>}
                    </div>

                    <hr className="my-6 border-gray-200" />

                    <button onClick={toggleReveal} className={`w-full rounded-xl py-4 shadow-lg transition-transform \${activeTasting?.revealed ? 'bg-gray-800' : 'bg-green-700'}`}>
                        {activeTasting?.revealed ? '🔒 Skjul Resultater' : '🔓 Reveal Resultater for alle'}
                    </button>
                    <div className="text-center mt-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold \${activeTasting?.revealed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            Status: {activeTasting?.revealed ? 'REVEALED ✅' : 'SKJULT 🔒'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
