import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin,
  Radar,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import logoAsset from "@/assets/mehar-logo.png.asset.json";

const logoUrl = logoAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mehar DVR — GPS-Verified Daily Visit Reports" },
      {
        name: "description",
        content:
          "Mehar DVR is the field visit management system by Mehar Advisory: fixed admin locations, 100 m GPS verification, live camera photos with permanent watermarks and a full admin dashboard.",
      },
      { property: "og:title", content: "Mehar DVR — GPS-Verified Daily Visit Reports" },
      {
        property: "og:description",
        content:
          "Fixed admin locations, GPS radius checks, live watermarked photos and complete visit history for field teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: MapPin,
    title: "Fixed Admin Locations",
    tag: "Geo-Fencing",
    color: "from-blue-500/20 to-sky-500/10 text-blue-600 dark:text-blue-400",
    text: "Admin defines pinpoint GPS coordinates with address and authorized radius. The camera watermark always locks to the verified official location name.",
  },
  {
    icon: Radar,
    title: "100m Radius Guard",
    tag: "Haversine Engine",
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
    text: "Sub-meter client & server Haversine calculations guarantee field staff are physically present before photo capture is unlocked.",
  },
  {
    icon: Camera,
    title: "Tamper-Proof Watermark",
    tag: "Live Capture",
    color: "from-violet-500/20 to-purple-500/10 text-violet-600 dark:text-violet-400",
    text: "Back-camera photos are permanently stamped with location name, purpose, employee ID, exact timestamp, distance, and GPS accuracy.",
  },
  {
    icon: Compass,
    title: "13 Visit Purpose Types",
    tag: "Categorization",
    color: "from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400",
    text: "Standardized categories including Customer Meetings, Document Collection, RTO Audits, Site Inspections, and custom visit remarks.",
  },
  {
    icon: LayoutDashboard,
    title: "Admin Command Center",
    tag: "Real-Time",
    color: "from-indigo-500/20 to-blue-500/10 text-indigo-600 dark:text-indigo-400",
    text: "Monitor all active field agents on an interactive live map, review submitted visit cards, audit GPS drifts, and manage staff credentials.",
  },
  {
    icon: FileSpreadsheet,
    title: "Automated DVR Reports",
    tag: "Instant Export",
    color: "from-cyan-500/20 to-blue-500/10 text-cyan-600 dark:text-cyan-400",
    text: "Generate compliance-ready Daily Visit Reports with one click. Filter by employee, client location, or date range with fast CSV export.",
  },
];

const steps = [
  {
    num: "01",
    icon: MapPin,
    title: "Admin Adds Locations",
    desc: "Fixed GPS coordinates & radius are registered in the DVR portal.",
  },
  {
    num: "02",
    icon: Smartphone,
    title: "Employee Arrives",
    desc: "Field agent opens DVR web app on mobile at the target venue.",
  },
  {
    num: "03",
    icon: Radar,
    title: "GPS Verification",
    desc: "Instant Haversine distance verification validates agent < 100m.",
  },
  {
    num: "04",
    icon: Camera,
    title: "Live Watermark Shot",
    desc: "Real-time camera stamps metadata permanently onto the image.",
  },
  {
    num: "05",
    icon: ShieldCheck,
    title: "Instant Cloud Sync",
    desc: "Verification log & proof photo immediately appear in Admin DVR.",
  },
];

const stats = [
  { label: "Radius Verification", value: "100 m", sub: "Strict Haversine Geo-fence" },
  { label: "Photo Watermark", value: "100%", sub: "Live Timestamp & GPS Stamp" },
  { label: "Purpose Categories", value: "13+", sub: "Standardized Field Workflows" },
  { label: "Spoof Prevention", value: "Real-Time", sub: "Dual Client + Server Checks" },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute top-[40%] -right-40 h-[400px] w-[500px] rounded-full bg-blue-400/10 blur-[120px]" />
        <div className="absolute top-[70%] -left-40 h-[400px] w-[500px] rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={logoUrl}
                alt="Mehar DVR logo"
                className="h-10 w-10 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-border/80"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-extrabold tracking-tight text-foreground">
                  MEHAR DVR
                </p>
                <span className="hidden sm:inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Daily Visit Report & Proof
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="transition hover:text-primary">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-primary">
              How It Works
            </a>
            <a href="#demo-preview" className="transition hover:text-primary">
              Live Preview
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]"
            >
              <span>Open Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO SECTION - ENTERPRISE MODERN STYLING */}
        <section className="relative px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24 lg:pt-20 lg:pb-28 overflow-hidden">
          
          {/* Subtle Grid Backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              
              {/* Left Column: Headline, Description, CTAs, Feature Tags */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                
                {/* Floating Status Pill */}
                <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 shadow-sm backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold text-foreground tracking-wide">
                    100% Tamper-Proof GPS & Live Photo Proof
                  </span>
                </div>

                {/* Main Headline */}
                <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] text-foreground">
                  Eliminate Fake Visits with{" "}
                  <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
                    Geo-Verified Proof
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Mehar DVR confirms physical presence within a strict <strong className="text-foreground font-semibold">100-meter radius</strong> of approved admin locations. Every visit is permanently stamped with verified coordinates, purpose, employee ID, and time.
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4 pt-2 max-w-md mx-auto lg:mx-0">
                  <Link
                    to="/auth"
                    className="relative group overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-blue-600 to-indigo-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Launch DVR Portal</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/80 px-6 py-3.5 text-base font-semibold text-foreground backdrop-blur-md shadow-sm transition-all duration-300 hover:bg-accent hover:border-primary/40"
                  >
                    <Eye className="h-4 w-4 text-primary" />
                    <span>See How It Works</span>
                  </a>
                </div>

                {/* Trust Badges */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    100m Radius Guard
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                    Live Photo Stamp
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-500" />
                    Zero App Install
                  </span>
                </div>

              </div>

              {/* Right Column: Realistic Smartphone Viewfinder Mockup */}
              <div className="lg:col-span-5 flex justify-center w-full">
                <div className="relative w-full max-w-[380px]">
                  
                  {/* Floating Notification Chip 1 (Top Left) */}
                  <div className="hidden sm:flex absolute -top-5 -left-8 z-20 items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md text-xs font-bold text-foreground">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>GPS Radius Verified (38m)</span>
                  </div>

                  {/* Floating Notification Chip 2 (Bottom Right) */}
                  <div className="hidden sm:flex absolute -bottom-4 -right-6 z-20 items-center gap-2 rounded-xl border border-border bg-card/95 px-3.5 py-2 shadow-xl backdrop-blur-md text-xs font-bold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Anti-Spoof Protected</span>
                  </div>

                  {/* Glowing Ambient Halo */}
                  <div className="absolute -inset-2 rounded-[36px] bg-gradient-to-tr from-primary/30 via-sky-400/20 to-emerald-400/30 opacity-70 blur-2xl" />

                  {/* Smartphone Frame */}
                  <div className="relative rounded-[32px] border-[6px] border-slate-900 bg-slate-900 p-2 shadow-2xl ring-1 ring-white/20">
                    
                    {/* Phone Screen */}
                    <div className="relative rounded-[24px] bg-slate-950 overflow-hidden text-white border border-slate-800">
                      
                      {/* Top Phone Notch / Dynamic Island */}
                      <div className="flex items-center justify-between px-4 py-2 text-[10px] font-mono text-slate-400 bg-slate-950">
                        <span>11:35</span>
                        <div className="h-3.5 w-16 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <span>5G 100%</span>
                      </div>

                      {/* Camera Viewfinder Area */}
                      <div className="relative aspect-[4/3.2] w-full overflow-hidden bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/70 p-3 flex flex-col justify-between">
                        
                        {/* Crosshairs */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-35 pointer-events-none">
                          <div className="h-28 w-28 border border-white/60 rounded-xl flex items-center justify-center">
                            <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                          </div>
                        </div>

                        {/* Camera Top Bar */}
                        <div className="relative z-10 flex items-center justify-between text-[10px] font-mono bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                          <div className="flex items-center gap-1.5">
                            <Camera className="h-3 w-3 text-red-400 animate-pulse" />
                            <span className="font-bold text-white">LIVE CAMERA</span>
                          </div>
                          <span className="text-emerald-400 font-bold">100m PERMITTED</span>
                        </div>

                        {/* Stamped Watermark Banner */}
                        <div className="relative z-10 rounded-xl bg-black/85 backdrop-blur-md p-2.5 border border-white/15 shadow-xl text-left">
                          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1 mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <MapPin className="h-3 w-3 text-primary shrink-0" />
                              <p className="text-[11px] font-bold text-white truncate">Mehar Advisory · HQ</p>
                            </div>
                            <span className="text-[9px] font-extrabold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded shrink-0">
                              VERIFIED
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-slate-300">
                            <div className="truncate"><span className="text-white/40">Purpose:</span> Client Visit</div>
                            <div className="truncate"><span className="text-white/40">Staff:</span> Rajesh Kumar</div>
                            <div className="truncate"><span className="text-white/40">Distance:</span> 38 m away</div>
                            <div className="truncate"><span className="text-white/40">Time:</span> 11:35 AM</div>
                          </div>
                        </div>

                      </div>

                      {/* Phone Bottom Control Strip */}
                      <div className="p-3 bg-slate-900/90 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                          <span className="text-slate-300">Geo-Fence Status</span>
                          <span className="text-emerald-400 font-bold">38m / 100m Allowed</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full w-[38%] rounded-full" />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* STATS & TRUST METRICS - ELEVATED BENTO GRID */}
        <section className="relative z-10 border-y border-border/70 bg-card/40 backdrop-blur-md py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {stats.map((st, i) => (
                <div
                  key={i}
                  className="group relative rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="space-y-1">
                    <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      {st.value}
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-primary">
                      {st.label}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                      {st.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CORE FEATURES GRID */}
        <section id="features" className="py-14 sm:py-20 lg:py-28 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-10 sm:space-y-16">
            <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                Enterprise Feature Suite
              </span>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                Engineered for Total Field Accountability
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                Everything required by operations managers to monitor, verify, and document on-site visits with indisputable GPS certainty.
              </p>
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group relative rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} transition-transform group-hover:scale-110`}>
                      <f.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5-STEP PIPELINE / HOW IT WORKS */}
        <section id="how-it-works" className="py-14 sm:py-20 bg-muted/30 border-t border-border/80 px-4 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-10 sm:space-y-16">
            <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Streamlined Operations
              </span>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                From Field Visit to Verified DVR in 5 Steps
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                Seamless and automated workflow designed to require minimum taps from employees while providing 100% audit security.
              </p>
            </div>

            <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((s, i) => (
                <div
                  key={s.num}
                  className="relative rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                        <s.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">
                        {s.num}
                      </span>
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-foreground mb-1">
                      {s.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <span>Step {i + 1}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST & SECURITY HIGHLIGHT BANNER */}
        <section id="demo-preview" className="py-14 sm:py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 lg:p-12 shadow-2xl border border-slate-700/50">
              <div className="relative z-10 grid gap-6 sm:gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-8 space-y-3 sm:space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 border border-primary/40 px-3.5 py-1 text-xs font-bold text-sky-300">
                    <ShieldCheck className="h-4 w-4 shrink-0" /> Military-Grade Geolocation Integrity
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
                    Ready to modernize your field operations with Mehar DVR?
                  </h2>
                  <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                    Set up your locations once, give your field staff access, and get real-time verified Daily Visit Reports immediately.
                  </p>
                </div>
                <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Sign in to Portal</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Mehar DVR logo"
                className="h-8 w-8 rounded-lg bg-white object-contain p-1 ring-1 ring-border"
              />
              <div>
                <p className="font-display text-sm font-bold text-foreground">
                  MEHAR DVR
                </p>
                <p className="text-xs text-muted-foreground">
                  Mehar Advisory · Field Visit Management
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
              <a href="#features" className="hover:text-primary transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-primary transition-colors">
                How It Works
              </a>
              <Link to="/auth" className="hover:text-primary transition-colors">
                Employee Login
              </Link>
              <Link to="/auth" className="hover:text-primary transition-colors">
                Admin Console
              </Link>
            </div>

            <p className="text-xs text-muted-foreground text-center md:text-right">
              © {new Date().getFullYear()} Mehar Advisory. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

