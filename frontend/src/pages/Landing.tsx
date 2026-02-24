import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import quantivaLogo from "@/assets/Quantum Explorer Logo.png";
import ThemeSelector from "@/components/ThemeSelector";
import {
  Atom,
  ArrowRight,
  Microscope,
  Brain,
  ShieldCheck,
  Activity,
  Sparkles,
  Database,
  SlidersHorizontal,
  Orbit,
  SearchCheck,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Explorer", href: "#features" },
  { label: "Technology", href: "#technology" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

// Get API base URL from environment or use relative path for Vite proxy
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.replace(/\/$/, '');
  }
  return '';
}

// Default stats shown while loading
const defaultStats = [
  { label: "Molecules in database", value: 0, suffix: "+" },
  { label: "Data sources", value: 0, suffix: "" },
  { label: "API uptime", value: 99, suffix: "%" },
  { label: "PubChem connected", value: 1, suffix: "" },
];

const features = [
  {
    icon: Orbit,
    title: "Quantum-Inspired Exploration",
    description:
      "Navigate high-dimensional molecular search spaces using probabilistic quantum-inspired traversal.",
  },
  {
    icon: Activity,
    title: "Real-Time Molecular Scoring",
    description:
      "Continuously evaluate candidates with efficacy, safety, and complexity-balanced scoring in real time.",
  },
  {
    icon: Brain,
    title: "AI Explainability Engine",
    description:
      "Interpret rank decisions with transparent reasoning for research teams and educational workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Outbreak Rapid Screening",
    description:
      "Rapidly pivot screening strategies for disease-specific targets in high-urgency scenarios.",
  },
];

const workflow = [
  { icon: Database, title: "Load dataset", desc: "Import curated molecular candidate collections." },
  { icon: SlidersHorizontal, title: "Adjust weights", desc: "Tune efficacy, safety, and complexity priorities." },
  { icon: Atom, title: "Run quantum exploration", desc: "Execute probabilistic search across candidate space." },
  { icon: SearchCheck, title: "Discover candidates", desc: "Review top-ranked molecules with explainable signals." },
];

function useCountUp(target: number, inView: boolean, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.floor(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, inView, duration]);

  return value;
}

function useLiveStats() {
  const [stats, setStats] = useState(defaultStats);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/meta`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.total) {
          const sourceCount = data.bySource ? Object.keys(data.bySource).length : 1;
          setStats([
            { label: "Molecules in database", value: data.total, suffix: "+" },
            { label: "Data sources", value: sourceCount, suffix: "" },
            { label: "API uptime", value: 99, suffix: "%" },
            { label: "Live PubChem", value: 1, suffix: " connected" },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  return stats;
}

function StatCounter({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const count = useCountUp(value, inView);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-[#ffffff1a] bg-[#11121fcc] p-5 backdrop-blur-xl"
    >
      <div className="text-2xl font-semibold tracking-tight text-[#E5E7EB] md:text-3xl">
        {count.toLocaleString()}
        {suffix}
      </div>
      <p className="mt-1 text-sm text-[#9CA3AF]">{label}</p>
    </motion.div>
  );
}

const Landing = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const stats = useLiveStats();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        size: 2 + (i % 4),
        left: `${(i * 13) % 100}%`,
        top: `${(i * 17) % 100}%`,
        delay: i * 0.12,
        duration: 4 + (i % 5),
      })),
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "border-b border-border bg-background/80 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <a href="#home" className="flex items-center gap-3">
            <img src={quantivaLogo} alt="Quantiva Explorer" className="h-10 w-10 rounded-full" />
            <span className="text-lg font-semibold tracking-wide">Quantiva QuantumRx</span>
          </a>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeSelector />
            <Link to="/dashboard" className="hidden sm:block">
              <Button className="h-10 rounded-xl bg-primary px-5 text-primary-foreground shadow-lg transition btn-glow">
                Launch Explorer
              </Button>
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background/95 px-6 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-4">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button className="h-10 w-full rounded-xl bg-primary text-primary-foreground font-semibold btn-glow">Launch Explorer</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section id="home" className="relative overflow-hidden px-6 pb-20 pt-36 md:pt-44">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-[#FF4D9D1f] blur-3xl" />
            <div className="absolute right-1/4 top-24 h-72 w-72 rounded-full bg-[#8B5CF626] blur-3xl" />
            {particles.map((p) => (
              <motion.span
                key={p.id}
                className="absolute rounded-full bg-[#FF4D9D66]"
                style={{ width: p.size, height: p.size, left: p.left, top: p.top }}
                animate={{ y: [0, -16, 0], opacity: [0.25, 0.8, 0.25] }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: p.delay,
                }}
              />
            ))}
          </div>

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Quantum Intelligence for Next-Generation Drug Discovery
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Explore massive molecular search spaces with quantum-inspired navigation, real-time scoring,
                and explainable AI insights built for healthcare research teams and learning environments.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/dashboard">
                  <Button className="h-12 rounded-xl bg-primary px-6 text-primary-foreground shadow-lg btn-glow">
                    Start Exploration
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
              className="relative"
            >
              <div className="relative rounded-3xl border border-border bg-card/80 p-8 backdrop-blur-2xl glass-card">
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#FF4D9D40] blur-2xl" />
                <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-[#8B5CF640] blur-2xl" />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-xs text-muted-foreground">Quantum State Nodes</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">2,304</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-xs text-muted-foreground">Active Search Paths</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">146</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-card/80 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Molecular probability field</span>
                    <span className="text-primary font-semibold">Live</span>
                  </div>
                  <div className="relative h-40 overflow-hidden rounded-xl border border-border bg-background">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#FF2E8833_0%,_transparent_58%)]" />
                    {Array.from({ length: 16 }).map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute rounded-full bg-[#FF4D9Daa]"
                        style={{
                          width: 5,
                          height: 5,
                          left: `${10 + ((i * 11) % 80)}%`,
                          top: `${10 + ((i * 7) % 70)}%`,
                        }}
                        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2.8 + (i % 3), repeat: Infinity, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 pb-14">
          <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <StatCounter key={item.label} label={item.label} value={item.value} suffix={item.suffix} />
            ))}
          </div>
        </section>

        <section id="features" className="px-6 py-20">
          <div className="mx-auto w-full max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              className="mb-10 max-w-2xl"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Core Capabilities</p>
              <h2 className="text-3xl font-semibold md:text-4xl text-foreground">Built for modern AI-powered healthcare research</h2>
            </motion.div>
            <div className="grid gap-5 md:grid-cols-2">
              {features.map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -6 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.35, delay: idx * 0.07 }}
                  className="group rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-xl"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/25 text-primary shadow-lg transition group-hover:shadow-glow">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="technology" className="px-6 py-20">
          <div className="mx-auto w-full max-w-7xl rounded-3xl border border-border bg-card/80 p-8 md:p-10">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">How It Works</p>
              <h2 className="text-3xl font-semibold md:text-4xl text-foreground">A streamlined workflow from data to discovery</h2>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {workflow.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="relative rounded-2xl border border-border bg-background/50 p-5"
                >
                  {index < workflow.length - 1 && (
                    <motion.div
                      className="pointer-events-none absolute -right-4 top-10 hidden h-[2px] w-8 bg-gradient-to-r from-primary to-accent xl:block"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  )}
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/25 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-6 py-20">
          <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-border bg-background p-8 md:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1.3fr,1fr]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <p className="mb-2 text-xs uppercase tracking-[0.24em] text-primary">Outbreak Mode</p>
                <h2 className="text-3xl font-semibold md:text-4xl text-foreground">Rapid screening mode for time-critical scenarios</h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Switch to Outbreak Mode to prioritize response speed while preserving explainability and model
                  transparency. Designed for urgent research workflows where every iteration matters.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {["COVID", "Cancer", "Malaria"].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs text-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="mt-8">
                  <Link to="/dashboard/simulation">
                    <Button className="h-11 rounded-xl bg-primary px-6 text-primary-foreground shadow-lg btn-glow">
                      Activate Outbreak Screening
                    </Button>
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FF4D9D33] blur-2xl" />
                <Microscope className="mb-4 h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">High-urgency decision support</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Prioritize top candidates rapidly, compare profile shifts, and communicate ranking rationale with
                  confidence.
                </p>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-border bg-background px-6 py-12">
        <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src={quantivaLogo} alt="Quantiva Explorer" className="h-6 w-6 rounded-full" />
              <span className="font-semibold">Quantiva QuantumRx</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Quantum-inspired drug discovery platform for educational and research acceleration.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Explorer</a></li>
              <li><a href="#technology" className="hover:text-foreground">Technology</a></li>
              <li><a href="#about" className="hover:text-foreground">Outbreak Mode</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><a href="#home" className="hover:text-foreground">Home</a></li>
              <li><a href="#about" className="hover:text-foreground">About</a></li>
              <li><a href="#contact" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>research@quantiva.ai</li>
              <li>+1 (555) 014-8892</li>
              <li>Global Virtual Lab</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 w-full max-w-7xl border-t border-border pt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Quantiva QuantumRx. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
