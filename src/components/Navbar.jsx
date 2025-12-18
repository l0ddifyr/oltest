import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const linkClass = (path) =>
        `text-sm font-bold px-3 py-2 rounded-lg transition-colors \${
      isActive(path) 
        ? 'bg-[#d4a017] text-white' 
        : 'text-gray-600 hover:bg-gray-100'
    }`;

    return (
        <nav className="bg-white shadow-sm mb-6 sticky top-0 z-50">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-2xl">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🍺</span>
                    <Link to="/" className="font-black text-gray-800 tracking-tight text-lg no-underline">
                        Juleøl <span className="text-[#d4a017]">Test</span>
                    </Link>
                </div>

                <div className="flex gap-2">
                    <Link to="/" className={linkClass('/')}>
                        Stem
                    </Link>
                    <Link to="/results" className={linkClass('/results')}>
                        Resultat
                    </Link>
                    <Link to="/admin" className={linkClass('/admin')}>
                        Admin
                    </Link>
                </div>
            </div>
        </nav>
    );
}
