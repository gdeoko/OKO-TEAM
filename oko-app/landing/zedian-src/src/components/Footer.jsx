import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const menu = ['Home', 'About', 'Work', 'Services'];
const socials = ['Twitter / X', 'Dribbble', 'LinkedIn', 'Instagram'];

export default function Footer() {
  return (
    <footer id="contact" className="relative pt-32 pb-10 border-t border-white/10 overflow-hidden">
      {/* giant background text */}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 select-none pointer-events-none font-display font-bold tracking-tighter text-white leading-none"
        style={{ fontSize: '25vw', opacity: 0.05 }}>
        CONTACT
      </span>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* left */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-display font-bold tracking-tighter leading-[0.9] text-4xl sm:text-5xl lg:text-6xl">
              HOW CAN I<br />HELP<span className="text-[#00df8f]">?</span>
            </h2>
            <p className="mt-6 max-w-md text-gray-400 leading-relaxed">
              Have a project in mind or just want to say hi? I'm always open to new ideas and collaborations.
            </p>
            <a
              href="mailto:hello@zedian.design"
              className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold text-black bg-white hover:bg-[#00df8f] transition-colors"
            >
              hello@zedian.design <ArrowUpRight size={18} />
            </a>
          </motion.div>

          {/* right — links */}
          <div className="grid grid-cols-2 gap-8 lg:justify-items-end">
            <div>
              <div className="text-sm tracking-widest uppercase text-gray-500 mb-5">Menu</div>
              <ul className="space-y-3">
                {menu.map((m) => (
                  <li key={m}><a href="#" className="text-gray-300 hover:text-[#00df8f] transition-colors">{m}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-sm tracking-widest uppercase text-gray-500 mb-5">Socials</div>
              <ul className="space-y-3">
                {socials.map((m) => (
                  <li key={m}><a href="#" className="text-gray-300 hover:text-[#00df8f] transition-colors">{m}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-24 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>© 2026 Zedian Portfolio. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
