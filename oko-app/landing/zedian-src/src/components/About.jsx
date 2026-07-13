import { motion } from 'framer-motion';

const skills = ['UI/UX Design', 'Figma', 'React.js', 'Framer Motion', 'Tailwind CSS', 'Prototyping', 'Design Systems', 'Webflow', 'Motion Design'];

export default function About() {
  return (
    <section id="about" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* LEFT */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="font-display font-bold tracking-tighter leading-[0.9] text-4xl sm:text-5xl lg:text-6xl">
            DESIGNING WITH<br />PURPOSE<span className="text-[#00df8f]">.</span>
          </h2>
          <div className="mt-8 space-y-5 text-gray-400 leading-relaxed max-w-lg">
            <p>
              With a multidisciplinary background spanning brand, product and motion, I bridge the gap
              between beautiful interfaces and business results.
            </p>
            <p>
              Every project starts with the user and ends with a system — scalable, consistent and built
              to grow. I obsess over the details others skip.
            </p>
          </div>

          <div className="mt-12 flex items-stretch gap-10">
            <div>
              <div className="font-display font-bold text-4xl text-[#00df8f]">20+</div>
              <div className="mt-1 text-sm tracking-widest uppercase text-gray-500">Awards</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="font-display font-bold text-4xl text-white">100%</div>
              <div className="mt-1 text-sm tracking-widest uppercase text-gray-500">Commitment</div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT — toolkit glass card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          className="rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 p-8"
        >
          <div className="text-sm tracking-widest uppercase text-gray-500 mb-6">My Toolkit</div>
          <div className="flex flex-wrap gap-3">
            {skills.map((s, i) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="rounded-full px-4 py-2 text-sm font-medium text-gray-300 bg-[#14181f] border border-white/10 hover:border-[#00df8f] hover:text-[#00df8f] hover:shadow-[0_0_15px_rgba(0,223,143,0.3)] transition-all cursor-default"
              >
                {s}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
