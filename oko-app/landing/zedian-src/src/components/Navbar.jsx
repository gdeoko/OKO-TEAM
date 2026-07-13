import { motion } from 'framer-motion';

const links = [
  { label: 'ABOUT', id: 'about' },
  { label: 'WORK', id: 'work' },
  { label: 'CONTACT', id: 'contact' },
];

export default function Navbar() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="fixed top-0 left-0 w-full h-24 z-50 bg-[#0f1115]/80 backdrop-blur-md border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <button onClick={top} className="text-2xl font-display font-bold tracking-tighter text-white">
          ZEDIAN<span className="text-[#00df8f]">.</span>
        </button>

        <div className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-sm font-semibold tracking-widest text-gray-300 uppercase hover:text-[#00df8f] transition-colors"
            >
              {l.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => scrollTo('contact')}
          className="w-12 h-12 rounded-full border border-white/10 bg-[#14181f] grid place-items-center hover:border-[#00df8f] transition-colors"
          aria-label="Contact"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#00df8f] shadow-[0_0_12px_#00df8f]" />
        </button>
      </div>
    </motion.nav>
  );
}
