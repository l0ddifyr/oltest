import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Home() {
    const { user, loading: authLoading, signInAnonymously } = useAuth();
    const [step, setStep] = useState('setup'); // setup | rate
    const [loading, setLoading] = useState(false);
    const [tastingId, setTastingId] = useState(localStorage.getItem('j_id') || null);
    const [meta, setMeta] = useState(null);
    const [currentBeerNo, setCurrentBeerNo] = useState(1);
    const [myRatings, setMyRatings] = useState([]);

    // Rating State
    const [scores, setScores] = useState({ smak: 0, ettersmak: 0, farge: 0, lukt: 0 });
    const [liveStatus, setLiveStatus] = useState('Offline');

    // Inputs
    const [joinCode, setJoinCode] = useState('');
    const [name, setName] = useState(localStorage.getItem('j_name') || '');

    const totalScore = Number(scores.smak) + Number(scores.ettersmak) + Number(scores.farge) + Number(scores.lukt);

    useEffect(() => {
        if (!authLoading && !user) {
            signInAnonymously();
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (tastingId && user) {
            loadMeta(tastingId);
            loadMyRatings();
            useEffect(() => {
                if (tastingId && user) {
                    loadMeta(tastingId);
                    loadMyRatings();
                    loadCurrentRating();
                    setStep('rate');
                }
            }, [tastingId, user]);

            // Dedicated Subscription Effect
            useEffect(() => {
                if (!tastingId || !user) return;

                const channel = supabase.channel(`ols-\${tastingId}`)
                    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tastings", filter: `id=eq.\${tastingId}` }, (payload) => {
                        const newNo = payload.new.current_beer_no;
                        if (newNo) {
                            setCurrentBeerNo(newNo);
                            toast(`Neste øl: #\${newNo}`, { icon: '🍺', id: 'next-beer' });
                        }
                    })
                    .subscribe((status) => {
                        setLiveStatus(status === "SUBSCRIBED" ? "LIVE ✓" : "Offline");
                        if (status === "CHANNEL_ERROR") {
                            toast.error("Mistet tilkobling til server");
                        }
                    });

                return () => {
                    supabase.removeChannel(channel);
                };
            }, [tastingId, user]);

            const loadMeta = async (id) => {
                const { data } = await supabase.from("tastings").select("*").eq("id", id).single();
                if (data) {
                    setMeta(data);
                    setCurrentBeerNo(data.current_beer_no || 1);
                }
            };

            const loadMyRatings = async () => {
                if (!tastingId || !user) return;
                const { data } = await supabase.from("ratings").select("beer_no, score")
                    .eq("tasting_id", tastingId).eq("user_id", user.id).order("beer_no", { ascending: false });
                setMyRatings(data || []);
            };

            const loadCurrentRating = async () => {
                if (!tastingId || !user) return;
                const { data } = await supabase.from("ratings").select("*")
                    .eq("tasting_id", tastingId).eq("user_id", user.id).eq("beer_no", currentBeerNo).maybeSingle();

                if (data) {
                    setScores({ smak: data.smak, ettersmak: data.ettersmak, farge: data.farge, lukt: data.lukt });
                    toast("Du har stemt på denne.", { icon: '📝', id: 'vote-info' });
                } else {
                    setScores({ smak: 0, ettersmak: 0, farge: 0, lukt: 0 });
                }
            };



            const handleJoin = async () => {
                if (joinCode.length !== 4 || !name) return toast.error("Sjekk kode og navn!");
                setLoading(true);
                const loadId = toast.loading("Kobler til...");

                const { data: ols } = await supabase.rpc("get_ols_by_join_code", { p_code: joinCode.toUpperCase() });

                if (!ols || ols.length === 0) {
                    toast.error("Ugyldig kode", { id: loadId });
                    setLoading(false);
                    return;
                }

                toast.success("Velkommen!", { id: loadId });

                const tid = ols[0].id;
                localStorage.setItem("j_id", tid);
                localStorage.setItem("j_name", name);
                setTastingId(tid);
                // useEffect will take over
                setLoading(false);
            };

            const handleSave = async () => {
                const toastId = toast.loading("Lagrer...");
                const { error } = await supabase.from("ratings").upsert({
                    tasting_id: tastingId,
                    beer_no: currentBeerNo,
                    user_id: user.id,
                    display_name: name,
                    smak: scores.smak,
                    ettersmak: scores.ettersmak,
                    farge: scores.farge,
                    lukt: scores.lukt,
                    score: totalScore
                }, { onConflict: "tasting_id,beer_no,user_id" });

                if (!error) {
                    toast.success("Lagret! ✅", { id: toastId });
                    loadMyRatings();
                } else {
                    toast.error("Feil ved lagring", { id: toastId });
                }
            };

            const handleReset = () => {
                if (confirm("Logge ut?")) {
                    localStorage.clear();
                    location.reload();
                }
            };

            if (step === 'setup') {
                return (
                    <div className="container max-w-md mx-auto mt-10">
                        <h1 className="text-4xl mb-8">Juleøl-test 🍺</h1>
                        <div className="card text-center">
                            <h2 className="mb-6">Bli med på smaking</h2>

                            <input
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value)}
                                placeholder="XXXX"
                                className="text-center text-3xl font-black uppercase tracking-[8px] h-16 bg-gray-50 border-2 mb-4"
                                maxLength={4}
                            />

                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ditt Navn"
                                className="text-center text-xl font-bold h-14 bg-gray-50 mb-6"
                            />

                            <button onClick={handleJoin} className="h-16 text-xl rounded-xl shadow-lg border-b-4 border-[#b88a14]">
                                {loading ? 'Kobler til...' : 'START SMAKING 🚀'}
                            </button>
                            <div className="mt-4 min-h-[24px]"></div>
                        </div>
                    </div>
                );
            }

            // Rate Screen
            return (
                <div className="container pb-20">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl mb-1">{meta?.title || 'Laster...'}</h1>
                        <div className="text-gray-500 font-medium">Hei, <span id="who" className="text-gray-900 font-bold">{name}</span></div>
                    </div>

                    <div className="flex justify-between items-center mb-6 px-2">
                        <div>
                            <div className="pill bg-red-50 text-[#800000] border border-red-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                Øl {currentBeerNo} av {meta?.total_beers}
                            </div>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded \${liveStatus.includes('LIVE') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                            {liveStatus}
                        </div>
                    </div>

                    <div className="beer-info-box shadow-sm">
                        <div className="uppercase tracking-widest text-[#800000] text-sm font-bold opacity-70">ØL NR</div>
                        <div id="currentBeerText" className="text-5xl mt-2 mb-2">#{currentBeerNo}</div>
                    </div>

                    {/* Sliders */}
                    <div className="card space-y-8 py-8">
                        {[
                            { id: 'smak', label: 'Smak', max: 50 },
                            { id: 'ettersmak', label: 'Ettersmak', max: 20 },
                            { id: 'farge', label: 'Farge', max: 20 },
                            { id: 'lukt', label: 'Lukt', max: 10 }
                        ].map(f => (
                            <div key={f.id} className="score-row">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="mb-0 text-base">{f.label} (0-{f.max})</label>
                                    <div className="score-val text-xl min-w-[3ch] text-center">{scores[f.id]}</div>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={f.max}
                                    value={scores[f.id]}
                                    onChange={e => setScores({ ...scores, [f.id]: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        ))}

                        <div className="text-center py-4">
                            <div className="text-sm text-gray-500 uppercase font-bold tracking-widest mb-1">Total Score</div>
                            <div className="text-4xl font-black text-[#d4a017]">{totalScore} <span className="text-xl text-gray-400 font-normal">/ 100</span></div>
                        </div>
                    </div>

                    <button
                        id="save"
                        onClick={handleSave}
                        className="w-full h-16 text-xl rounded-xl shadow-lg border-b-4 border-[#1e5622] bg-[#2e7d32] mb-8"
                    >
                        LAGRE POENG 💾
                    </button>

                    <div className="card p-4">
                        <h3 className="text-center mb-4">Dine registreringer</h3>
                        <table>
                            <tbody>
                                {myRatings.map(r => (
                                    <tr key={r.beer_no}>
                                        <td>Øl #{r.beer_no}</td>
                                        <td className="text-right font-bold">{r.score} poeng</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button onClick={handleReset} className="w-full py-4 mt-8 bg-gray-100 text-gray-500 rounded-xl font-bold border border-gray-200">
                        Avbryt / Logg ut
                    </button>
                </div>
            );
        }
