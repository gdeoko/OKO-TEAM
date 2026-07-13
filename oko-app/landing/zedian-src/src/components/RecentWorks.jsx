import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const projects = [
  {
    category: 'Architecture · Web',
    title: 'Monolith Studio',
    description: 'A brutalist portfolio for an award-winning architecture practice, built around scroll-driven reveals and heavy typography.',
    tags: ['Web Design', 'Art Direction', 'Framer'],
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
  },
  {
    category: 'Fintech · Product',
    title: 'Nova Banking',
    description: 'End-to-end product design for a next-gen banking app — from research to a scalable design system used across 40+ screens.',
    tags: ['Product', 'Design System', 'iOS'],
    image: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=800&auto=format&fit=crop',
  },
  {
    category: 'Culture · Interactive',
    title: 'Aperture Gallery',
    description: 'An immersive digital gallery pairing WebGL imagery with editorial layout, letting visitors wander a curated visual world.',
    tags: ['Interactive', 'WebGL', 'Editorial'],
    image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop',
  },
  {
    category: 'SaaS · Branding',
    title: 'Lumen Labs',
    description: 'Brand and marketing site for a developer tools startup — a confident dark identity with a neon-accented visual language.',
    tags: ['Branding', 'Marketing', 'Web'],
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop',
  },
];

export default function RecentWorks() {
  const [activeIdx, setActiveIdx] = useState(0);
  const n = projects.length;
  const active = projects[activeIdx];

  return (
    <section id="work" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* header */}
        <div className="flex items-end justify-between mb-16 gap-6">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="font-display font-bold tracking-tighter leading-[0.9] text-4xl sm:text-5xl lg:text-6xl"
          >
            RECENT WORKS<span className="text-[#00df8f]">.</span>
          </motion.h2>
          <button className="hidden sm:inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-[#14181f] border border-white/10 hover:border-[#00df8f] hover:text-[#00df8f] transition-colors whitespace-nowrap">
            View All Projects <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* LEFT — the stack */}
          <div className="lg:col-span-7">
            <div className="relative h-[340px] sm:h-[450px] md:h-[480px]" style={{ perspective: '1200px' }}>
              {projects.map((p, i) => {
                const diff = (i - activeIdx + n) % n;
                const isFront = diff === 0;
                return (
                  <motion.button
                    key={p.title}
                    onClick={() => setActiveIdx(isFront ? (activeIdx + 1) % n : i)}
                    animate={{
                      y: diff * 35,
                      scale: 1 - diff * 0.05,
                      rotateX: diff * 2,
                      zIndex: n - diff,
                      opacity: diff > 2 ? 0 : 1,
                    }}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute inset-0 rounded-3xl overflow-hidden border border-white/10 text-left shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]"
                    style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
                  >
                    <img src={p.image} alt={p.title} className="w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1116] via-[#0d1116]/20 to-transparent" />
                    <div className="absolute bottom-6 left-6">
                      <div className="text-xs tracking-widest uppercase text-[#00df8f]">{p.category}</div>
                      <div className="font-display font-bold text-2xl text-white mt-1">{p.title}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* nav dots */}
            <div className="flex items-center justify-center gap-3 mt-8">
              {projects.map((p, i) => (
                <button
                  key={p.title}
                  onClick={() => setActiveIdx(i)}
                  className={`h-2 rounded-full transition-all ${i === activeIdx ? 'w-8 bg-[#00df8f]' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                  aria-label={`Show ${p.title}`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — description */}
          <div className="lg:col-span-5 flex items-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.title}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="text-sm tracking-widest uppercase text-[#00df8f] mb-4">{active.category}</div>
                <h3 className="font-display font-bold tracking-tighter text-4xl text-white leading-[0.95]">{active.title}</h3>
                <p className="mt-6 text-gray-400 leading-relaxed">{active.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {active.tags.map((t) => (
                    <span key={t} className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-300 bg-[#14181f] border border-white/10">{t}</span>
                  ))}
                </div>
                <button className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#00df8f] to-[#00b373]">
                  Explore Project <ArrowUpRight size={16} />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
