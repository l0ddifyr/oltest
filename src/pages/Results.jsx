import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Results() {
    const { user, loading: authLoading, signInAnonymously, signOut } = useAuth();
    const [tastings, setTastings] = useState([]);
    const [selectedTastingId, setSelectedTastingId] = useState('');

    // Results Data
    const [meta, setMeta] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [allVotes, setAllVotes] = useState([]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (user && !user.is_anonymous) {
            loadTastings();
        }
    }, [user]);

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Feil: " + error.message); // Simple alert or toast
    };

    const handleLogout = async () => {
        await signOut();
        setTastings([]);
    };

    const loadTastings = async () => {
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
            name: beersMap.get(s.beer_no) || `Øl #${s.beer_no}`
        })).sort((a, b) => b.avg - a.avg);

        setRanking(rank);
    };

    const downloadExcel = () => {
        if (!ranking.length) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Ranking
        const rankingData = ranking.map(r => ({
            Plassering: '', // Placeholder
            Nummer: r.beer_no,
            Navn: r.name,
            Snitt: r.avg.toFixed(2),
            Antall_Stemmer: r.count
        }));
        // Add explicit placement index
        rankingData.forEach((r, i) => r.Plassering = i + 1);

        const wsRanking = XLSX.utils.json_to_sheet(rankingData);
        XLSX.utils.book_append_sheet(wb, wsRanking, "Resultater");

        // Sheet 2: Alle stemmer
        const votesData = allVotes.map(v => ({
            Deltaker: v.display_name,
            Øl_Nummer: v.beer_no,
            Score: v.score,
            Kommentar: v.comment || ''
        }));
        const wsVotes = XLSX.utils.json_to_sheet(votesData);
        XLSX.utils.book_append_sheet(wb, wsVotes, "Alle Stemmer");

        // Generate filename
        const filename = `Resultater_${meta?.title || 'making'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
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



    if (!user || user.is_anonymous) {
        return (
            <div className="container max-w-sm mx-auto mt-10 md:mt-20 text-center px-4">
                <h1>Resultater 📊</h1>
                <div className="card">
                    <h2>Logg inn for å se resultater</h2>
                    <input
                        placeholder="E-post"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="mb-2 w-full p-2 border rounded"
                    />
                    <input
                        placeholder="Passord"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="mb-4 w-full p-2 border rounded"
                    />
                    <button onClick={handleLogin} className="w-full">Logg inn</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container-full p-4 md:p-20">
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="m-0 text-lg md:text-xl">Velg ølsmaking</h3>
                    <button onClick={handleLogout} className="secondary w-auto px-3 py-1 text-sm">Logg ut</button>
                </div>
                <select onChange={(e) => loadResults(e.target.value)} defaultValue="" className="w-full p-2 border rounded">
                    <option value="" disabled>Velg...</option>
                    {tastings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <div className="flex flex-col md:flex-row gap-2 mt-4">
                    <button onClick={() => loadResults(selectedTastingId)} className="bg-gray-100 text-gray-800 border border-gray-300 w-full md:w-auto">
                        Oppdater Resultater 🔄
                    </button>
                    {meta && (
                        <button onClick={downloadExcel} className="bg-green-600 text-white w-full md:w-auto">
                            Lagre i Excel 📥
                        </button>
                    )}
                </div>
            </div>

            {meta && (
                <>
                    <div className="card hidden md:block">
                        <h2 className="text-xl mb-4">Stillingen akkurat nå</h2>
                        <div className="h-64 md:h-96 w-full relative">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="card">
                        <h2>Ranking</h2>
                        <div className="text-center mb-4">
                            <span className={`pill px-3 py-1 rounded-full text-xs font-bold ${meta.revealed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {meta.revealed ? 'Fasit er ute! ✅' : 'SKJULT: Kun poeng vises 🔒'}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm md:text-base">
                                <thead>
                                    <tr className='text-left border-b'>
                                        <th className="p-2 w-8 md:w-16">#</th>
                                        <th className="p-2">Øl / Fasit</th>
                                        <th className="p-2 text-right">Snitt</th>
                                        <th className="p-2 text-right">Stemmer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.map((r, i) => (
                                        <tr key={r.beer_no} className={`border-b last:border-0 ${i === 0 ? 'bg-[#fffbef]' : ''}`}>
                                            <td className="p-2 font-bold">{r.beer_no}</td>
                                            <td className="p-2">{r.name} {i === 0 && '🏆'}</td>
                                            <td className="p-2 text-right font-bold text-base md:text-lg">{r.avg.toFixed(1)}</td>
                                            <td className="p-2 text-right text-gray-500 text-base md:text-lg font-bold">{r.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card">
                        <details>
                            <summary className="cursor-pointer font-bold text-center p-2 select-none">Se alle enkeltstemmer</summary>
                            <div className="overflow-x-auto">
                                <table className="text-xs mt-4 w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="p-2 text-left">Øl</th>
                                            <th className="p-2 text-left">Navn</th>
                                            <th className="p-2 text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allVotes.map((v, i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="p-2">#{v.beer_no}</td>
                                                <td className="p-2">{v.display_name}</td>
                                                <td className="p-2 text-right font-bold">{v.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    </div>
                </>
            )}
        </div>
    );
}
