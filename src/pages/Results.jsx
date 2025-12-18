import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Results() {
    const [step, setStep] = useState('login');
    const [tastings, setTastings] = useState([]);
    const [selectedTastingId, setSelectedTastingId] = useState('');

    // Results Data
    const [meta, setMeta] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [allVotes, setAllVotes] = useState([]);

    // Login
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setStep('app');
            loadTastings();
        } else {
            setStep('login');
        }
    };

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message); else checkSession();
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

    const loadResults = async (id) => {
        if (!id) return;
        setSelectedTastingId(id);

        // 1. Meta
        const { data: m } = await supabase.from("tastings").select("*").eq("id", id).single();
        setMeta(m);

        // 2. Beers (Fasit) - public table logic
        const { data: beers } = await supabase.from("beers_public").select("*").eq("tasting_id", id);
        const beersMap = new Map((beers || []).map(b => [b.beer_no, b.name]));

        // 3. Votes
        const { data: ratings } = await supabase.from("ratings").select("*").eq("tasting_id", id);

        processResults(ratings || [], beersMap, m);
    };

    const processResults = (ratings, beersMap, meta) => {
        setAllVotes([...ratings].sort((a, b) => b.score - a.score));

        const stats = {};
        ratings.forEach(r => {
            if (!stats[r.beer_no]) stats[r.beer_no] = { beer_no: r.beer_no, sum: 0, count: 0 };
            stats[r.beer_no].sum += r.score;
            stats[r.beer_no].count++;
        });

        const rank = Object.values(stats).map(s => ({
            ...s,
            avg: s.sum / s.count,
            name: beersMap.get(s.beer_no) || `Øl #\${s.beer_no}`
        })).sort((a, b) => b.avg - a.avg);

        setRanking(rank);
    };

    const chartData = {
        labels: ranking.map(r => r.name),
        datasets: [
            {
                label: 'Snittscore (0-100)',
                data: ranking.map(r => r.avg),
                backgroundColor: '#d4a017',
                borderRadius: 6,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100 }
        },
        plugins: {
            legend: { display: false }
        }
    };

    if (step === 'login') {
        return (
            <div className="container max-w-sm mx-auto mt-20 text-center">
                <h1>Resultater 🍻</h1>
                <div className="card">
                    <h2>Logg inn</h2>
                    <input placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} className="mb-2" />
                    <input placeholder="Passord" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button onClick={handleLogin}>Logg inn</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container pb-20">
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="m-0">Velg ølsmaking</h3>
                    <button onClick={handleLogout} className="secondary w-auto px-3 py-1">Logg ut</button>
                </div>
                <select onChange={(e) => loadResults(e.target.value)} defaultValue="">
                    <option value="" disabled>Velg...</option>
                    {tastings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <button onClick={() => loadResults(selectedTastingId)} className="mt-4 bg-gray-100 text-gray-800 border border-gray-300">Oppdater Resultater 🔄</button>
            </div>

            {meta && (
                <>
                    <div className="card">
                        <h2 className="text-xl mb-4">Stillingen akkurat nå</h2>
                        <div className="h-64 md:h-96 w-full relative">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="card">
                        <h2>Ranking</h2>
                        <div className="text-center mb-4">
                            <span className={`pill px-3 py-1 rounded-full text-xs font-bold \${meta.revealed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {meta.revealed ? 'Fasit er ute! ✅' : 'SKJULT: Kun poeng vises 🔒'}
                            </span>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th>Øl / Fasit</th>
                                    <th className="text-right">Snitt</th>
                                    <th className="text-right">Stemmer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranking.map((r, i) => (
                                    <tr key={r.beer_no} className={i === 0 ? 'bg-[#fffbef]' : ''}>
                                        <td className="font-bold">{r.beer_no}</td>
                                        <td>{r.name} {i === 0 && '🏆'}</td>
                                        <td className="text-right font-bold text-lg">{r.avg.toFixed(1)}</td>
                                        <td className="text-right text-gray-500 text-xs">{r.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="card">
                        <details>
                            <summary className="cursor-pointer font-bold text-center p-2">Se alle enkeltstemmer</summary>
                            <table className="text-xs mt-4">
                                <thead>
                                    <tr>
                                        <th>Øl</th>
                                        <th>Navn</th>
                                        <th className="text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allVotes.map((v, i) => (
                                        <tr key={i}>
                                            <td>#{v.beer_no}</td>
                                            <td>{v.display_name}</td>
                                            <td className="text-right font-bold">{v.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </details>
                    </div>
                </>
            )}
        </div>
    );
}
