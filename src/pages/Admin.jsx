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
    const [assignName, setAssignName] = useState('');
    const [assignNo, setAssignNo] = useState('');

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
        refreshFasit();
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
            // update ui handled by state
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
        else { setNewBeerName(''); refreshFasit(); }
    };

    const handleAssign = async () => {
        if (!assignName || !assignNo) return alert("Velg øl og nummer");
        const { error } = await supabase.from("beers").upsert({
            tasting_id: currentOlsId, beer_no: assignNo, name: assignName
        }, { onConflict: "tasting_id,beer_no" });

        if (!error) {
            await supabase.from("beers").delete()
                .eq("tasting_id", currentOlsId).eq("name", assignName).gt("beer_no", 499);
            setAssignNo('');
            refreshFasit();
        } else {
            alert(error.message);
        }
    };

    const refreshFasit = async () => {
        const { data } = await supabase.from("beers").select("*").eq("tasting_id", currentOlsId).order("beer_no");
        if (data) {
            setFasitBeers(data.filter(b => b.beer_no <= 499));
            setPoolBeers(data); // contains all
        }
    };

    const deleteBeer = async (id) => {
        if (confirm("Slette dette ølet fra listen?")) {
            await supabase.from("beers").delete().eq("id", id);
            refreshFasit();
        }
    };

    const toggleReveal = async () => {
        if (confirm("Vil du avsløre alle ølnavnene for deltakerne nå?")) {
            await supabase.from("tastings").update({ revealed: true }).eq("id", currentOlsId);
            const { data } = await supabase.from("tastings").select("*").eq("id", currentOlsId).single();
            setActiveTasting(data);
        }
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

    // Control
    return (
        <div className="container pb-20">
            <div className="card border-2 border-[#d4a017] text-center">
                <div className="flex justify-between items-center">
                    <button onClick={() => setStep('picker')} className="secondary text-xs w-auto px-2">◀ Bytt test</button>
                    <span className="pill bg-[#e3f2fd] text-[#1976d2] px-2 py-1 rounded-full text-xs font-bold font-mono">
                        KODE: {activeTasting?.join_code}
                    </span>
                </div>

                <div className="text-gray-500 mt-2 text-sm uppercase tracking-wide">{activeTasting?.title}</div>
                <div className="text-4xl font-black text-[#800000] my-2">Øl #{currentBeerNo}</div>

                <div className="flex gap-2 mt-4">
                    <button onClick={() => changeBeer(-1)} className="secondary">◀ Forrige</button>
                    <button onClick={() => changeBeer(1)}>Neste øl ▶</button>
                </div>
            </div>

            <div className="card">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="m-0">Status deltakere</h3>
                    <span className="pill bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{participants.length} påmeldte</span>
                </div>
                <div className="text-xs text-gray-500 uppercase font-bold">Alle i rommet:</div>
                <div className="flex flex-wrap gap-2 mb-4 pt-2 border-b border-gray-100 pb-2">
                    {participants.length ? participants.map(p => <span key={p} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{p}</span>) : '-'}
                </div>

                <div className="text-xs text-gray-500 uppercase font-bold">Har stemt på Øl #{currentBeerNo}:</div>
                <div className="flex flex-wrap gap-2 pt-2 min-h-[40px]">
                    {votedNow.length ? votedNow.map(v => <span key={v} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{v} ✅</span>) : <span className="text-gray-400 italic text-sm">Ingen har stemt ennå...</span>}
                </div>
            </div>

            <div className="card">
                <h3 className="mb-4">🍺 Fasit & Ølliste</h3>

                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                    <label>1. Legg til øl i poolen</label>
                    <div className="flex gap-2">
                        <input placeholder="Ølnavn..." value={newBeerName} onChange={e => setNewBeerName(e.target.value)} className="flex-1" />
                        <button onClick={handleAddPool} className="w-auto px-4 mt-0">Legg til</button>
                    </div>
                </div>

                <div className="bg-[#fff9eb] p-4 rounded-xl mb-4">
                    <label>2. Koble navn til nummer</label>
                    <div className="flex gap-2">
                        <select value={assignName} onChange={e => setAssignName(e.target.value)} className="flex-1">
                            <option value="">Velg fra pool...</option>
                            {poolBeers.map(b => (
                                <option key={b.id} value={b.name}>
                                    {b.name} {b.beer_no > 499 ? '(pool)' : `(#\${b.beer_no})`}
                                </option>
                            ))}
                        </select>
                        <input type="number" placeholder="Nr" value={assignNo} onChange={e => setAssignNo(e.target.value)} className="w-16" />
                        <button onClick={handleAssign} className="w-auto px-4 mt-0">Lagre</button>
                    </div>
                </div>

                <table className="text-sm">
                    <thead>
                        <tr>
                            <th className="w-10">#</th>
                            <th>Øl</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {fasitBeers.map(b => (
                            <tr key={b.id}>
                                <td className="font-bold">{b.beer_no}</td>
                                <td>{b.name}</td>
                                <td className="text-right">
                                    <button onClick={() => deleteBeer(b.id)} className="danger">Slett</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <hr className="my-6 border-gray-200" />

                <button onClick={toggleReveal} className="bg-green-700 w-full rounded-xl py-3">
                    🔓 Reveal Resultater for alle
                </button>
                <div className="text-center mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold \${activeTasting?.revealed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        Status: {activeTasting?.revealed ? 'REVEALED ✅' : 'SKJULT 🔒'}
                    </span>
                </div>
            </div>
        </div>
    );
}
