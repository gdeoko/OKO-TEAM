import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import About from './components/About.jsx';
import RecentWorks from './components/RecentWorks.jsx';
import Services from './components/Services.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0d1116] text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <About />
      <RecentWorks />
      <Services />
      <Footer />
    </div>
  );
}
