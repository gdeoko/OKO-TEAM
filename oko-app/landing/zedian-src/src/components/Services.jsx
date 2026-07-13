import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const stages = [
  { n: '01', title: 'BRIEFING', text: 'We align on goals, audience and scope — turning a vague idea into a sharp, measurable brief.' },
  { n: '02', title: 'ANALYTICS', text: 'Research, competitor teardown and data. Every design decision starts from evidence, not guesswork.' },
  { n: '03', title: 'PROTOTYPING', text: 'Low- to high-fidelity flows in Figma, tested early so we fail cheap and ship confident.' },
  { n: '04', title: 'DESIGN', text: 'Pixel-perfect UI and a scalable design system — the moment the product starts to feel expensive.' },
  { n: '05', title: 'ADAPTIVE', text: 'Every screen tuned for mobile, tablet and desktop, with motion that respects performance.' },
  { n: '06', title: 'THE FINAL', text: 'Handoff, polish and launch — plus the documentation your team needs to keep it consistent.' },
];

export default function Services() {
  const [open, setOpen] = useState(0);

  return (
    <section className="py-32">
      <div className="max-w-4xl mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="text-center font-display font-bold tracking-tighter leading-[0.9] text-4xl sm:text-5xl lg:text-6xl mb-16"
        >
          <span className="text-white">STAGES OF WEBSITE </span>
          <span className="text-transparent" style={{ WebkitTextStroke: '2px #00df8f' }}>DEVELOPMENT</span>
        </motion.h2>

        <div className="divide-y divide-white/10 border-y border-white/10">
          {stages.map((s, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center gap-6 py-7 text-left group"
                >
                  <span className="text-sm font-mono text-gray-500 w-8">{s.n}</span>
                  <span className={`flex-1 font-display font-bold tracking-tighter text-2xl sm:text-3xl transition-colors ${isOpen ? 'text-[#00df8f]' : 'text-white group-hover:text-[#00df8f]'}`}>
                    {s.title}
                  </span>
                  <span className="w-10 h-10 rounded-full border border-white/10 grid place-items-center text-gray-300 group-hover:border-[#00df8f] group-hover:text-[#00df8f] transition-colors">
                    {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pl-14 pr-4 pb-8 text-gray-400 leading-relaxed max-w-2xl">{s.text}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
