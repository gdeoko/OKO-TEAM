import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export default function Hero() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-24">
      {/* faint grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* giant background typography */}
      <span className="absolute inset-0 flex items-center justify-center select-none pointer-events-none font-display font-bold tracking-tighter text-white"
        style={{ fontSize: '20vw', opacity: 0.02 }}>
        DESIGN
      </span>

      <div className="relative max-w-7xl mx-auto w-full px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* LEFT — text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center gap-3 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00df8f] shadow-[0_0_12px_#00df8f]" />
            <span className="text-sm font-semibold tracking-widest text-gray-400 uppercase">UX/UI Designer</span>
          </div>

          <h1 className="font-display font-bold tracking-tighter leading-[0.9] text-6xl sm:text-7xl lg:text-8xl">
            <span className="block text-white">DIGITAL</span>
            <span className="block">
              <span className="text-transparent" style={{ WebkitTextStroke: '2px #00df8f' }}>EXPERIENCES</span>
              <span className="text-[#00df8f]">.</span>
            </span>
          </h1>

          <p className="mt-8 max-w-md text-gray-400 leading-relaxed">
            I craft digital experiences that blend aesthetics with function — turning complex ideas into
            intuitive, expensive-feeling products people love to use.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => scrollTo('work')}
              className="group inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-white bg-gradient-to-r from-[#00df8f] to-[#00b373] shadow-[0_10px_30px_-10px_rgba(0,223,143,0.6)]"
            >
              View My Work
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </motion.button>
            <button
              onClick={() => scrollTo('contact')}
              className="inline-flex items-center gap-3 rounded-full px-7 py-4 font-semibold text-white bg-[#14181f] border border-white/10 hover:border-[#00df8f] transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#00df8f]" />
              Contact Me
            </button>
          </div>
        </motion.div>

        {/* RIGHT — draggable ID badge */}
        <div className="relative flex justify-center lg:justify-end min-h-[460px]">
          {/* lanyard strip */}
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-3 h-64 bg-gradient-to-b from-[#00df8f]/0 via-[#00df8f]/40 to-[#14181f] rounded-full" />

          <motion.div
            drag
            dragElastic={0.2}
            dragConstraints={{ top: -30, bottom: 30, left: -40, right: 40 }}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            animate={{ y: [0, -15, 0], rotateZ: [-1, 1, -1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            whileTap={{ cursor: 'grabbing' }}
            className="relative w-72 sm:w-80 cursor-grab"
          >
            <div className="rounded-3xl bg-[#14181f] border border-white/10 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
              <div className="rounded-2xl overflow-hidden border border-white/10 relative aspect-[3/4]">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop"
                  alt="Zedian portrait"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14181f] via-[#14181f]/20 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <div className="font-display font-bold text-xl text-white">Zedian.</div>
                  <div className="text-xs tracking-widest uppercase text-[#00df8f]">Lead UX/UI Designer</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between px-1">
                <span className="text-[10px] tracking-widest uppercase text-gray-500">ID · 2026</span>
                <span className="w-8 h-1.5 rounded-full bg-white/10" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
