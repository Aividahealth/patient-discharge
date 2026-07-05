"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Gauge,
  Globe2,
  Languages,
  Layers,
  LineChart,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircleQuestion,
  Network,
  Phone,
  Pill,
  Quote,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  TrendingDown,
  UserCheck,
  Users,
  Workflow,
  X,
} from "lucide-react"

/* Brand palette — enterprise healthcare (navy / blue / teal) */
const NAVY = "#0A2540"
const BLUE = "#0B63CE"
const TEAL = "#0D9488"

/* Web3Forms access key. This value is public by design (it only permits
   submitting to your form). Set NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY in
   frontend/.env.local for local dev and in the Vercel project env vars. */
const WEB3FORMS_ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ?? ""
const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit"

/* ---------------------------------------------------------------- */
/* Scroll-reveal wrapper (subtle fade-up animation)                 */
/* ---------------------------------------------------------------- */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Navigation data                                                  */
/* ---------------------------------------------------------------- */
const NAV = [
  {
    label: "Solutions",
    items: [
      "Discharge Safety Risk Reduction",
      "Patient Understanding & Health Literacy",
      "Multilingual Communication",
      "Governance & Compliance",
      "Analytics & Insights",
    ],
  },
  {
    label: "Platform",
    items: [
      "Aivida Clarity\u2122",
      "Aivida Lingo\u2122",
      "Aivida Navigate\u2122",
      "Aivida Insight\u2122",
      "Aivida Pulse\u2122",
      "Security & Architecture",
    ],
  },
  {
    label: "Resources",
    items: ["The Discharge Safety Report", "Research & Insights"],
  },
  {
    label: "About",
    items: ["Company", "Leadership", "Advisors"],
  },
]

/* Some nav labels map to a shared section rather than a page of their own. */
const ANCHOR_ALIASES: Record<string, string> = {
  company: "leadership",
  advisors: "leadership",
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/\u2122/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function anchorFor(label: string) {
  const slug = slugify(label)
  return `#${ANCHOR_ALIASES[slug] ?? slug}`
}

/* ---------------------------------------------------------------- */
/* Header                                                           */
/* ---------------------------------------------------------------- */
function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm" : "bg-white/80 backdrop-blur"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between py-3">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
            >
              <Activity className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-lg font-bold tracking-tight" style={{ color: NAVY }}>
                Aivida
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Healthcare Technology
              </span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((group) => (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenMenu(group.label)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#0B63CE]"
                  aria-expanded={openMenu === group.label}
                >
                  {group.label}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${openMenu === group.label ? "rotate-180" : ""}`}
                  />
                </button>
                {openMenu === group.label && (
                  <div className="absolute left-1/2 top-full w-72 -translate-x-1/2 pt-2">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5">
                      {group.items.map((item) => (
                        <a
                          key={item}
                          href={anchorFor(item)}
                          className="block rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0B63CE]"
                        >
                          {item}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <a
              href="#contact"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#0B63CE]"
            >
              Contact
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <a
              href="#assessment"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: BLUE }}
            >
              Request Assessment
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white max-h-[80vh] overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
            {NAV.map((group) => (
              <div key={group.label}>
                <p className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
                <div className="mt-1">
                  {group.items.map((item) => (
                    <a
                      key={item}
                      href={anchorFor(item)}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-1 py-2 text-sm text-slate-700"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <a
              href="#assessment"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-4 py-3 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: BLUE }}
            >
              Request a Discharge Safety Risk Assessment
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

/* ---------------------------------------------------------------- */
/* Small building blocks                                            */
/* ---------------------------------------------------------------- */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest"
      style={{ color: BLUE }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TEAL }} />
      {children}
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
  light = false,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  center?: boolean
  light?: boolean
}) {
  return (
    <div className={`${center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className={`font-heading mt-4 text-3xl font-bold tracking-tight sm:text-4xl ${
          light ? "text-white" : ""
        }`}
        style={light ? undefined : { color: NAVY }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-lg leading-relaxed ${light ? "text-slate-200" : "text-slate-600"}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Section 1 — Hero                                                 */
/* ---------------------------------------------------------------- */
function Hero() {
  return (
    <section id="home" className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
      {/* soft background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-24 right-0 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: BLUE }}
        />
        <div
          className="absolute top-40 -left-24 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: TEAL }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>Discharge Safety Risk Reduction</Eyebrow>
            <h1
              className="font-heading mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: NAVY }}
            >
              The risk hospitals
              <br />
              <span style={{ color: BLUE }}>don&apos;t measure</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Every day, patients leave the hospital with instructions that determine what happens next. Aivida helps
              health systems measure and reduce discharge safety risk through governed AI, clinician oversight,
              readability optimization, and multilingual communication.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#assessment"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: BLUE, boxShadow: "0 10px 30px -10px rgba(11,99,206,0.5)" }}
              >
                Request a Complimentary Discharge Safety Risk Assessment
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Schedule a Conversation
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" style={{ color: TEAL }} /> Governed AI
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" style={{ color: TEAL }} /> Clinician Oversight
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4" style={{ color: TEAL }} /> Enterprise Security
              </span>
            </div>
          </Reveal>

          {/* Hero visual: Left → Center → Right */}
          <Reveal delay={150}>
            <HeroVisual />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5">
      <div className="grid gap-3 sm:grid-cols-3">
        {/* LEFT — complex */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Before</p>
          <div className="mt-3 space-y-1.5">
            {[90, 80, 95, 70, 88, 60].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full bg-slate-300" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="mt-4 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600">
            <TrendingDown className="h-3 w-3" /> Grade 16&ndash;18
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Dense medical language</p>
        </div>

        {/* CENTER — platform */}
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: `linear-gradient(160deg, ${NAVY}, ${BLUE})` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Aivida Platform</p>
          <ul className="mt-3 space-y-2 text-xs">
            {["AI simplification", "AI translation", "Clinician editing", "Clinician approval", "Audit trail"].map(
              (s) => (
                <li key={s} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-300" />
                  {s}
                </li>
              ),
            )}
          </ul>
        </div>

        {/* RIGHT — patient-friendly */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">After</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-md bg-white p-1.5 text-[11px] text-slate-600 shadow-sm">Take 1 pill daily</div>
            <div className="rounded-md bg-white p-1.5 text-[11px] text-slate-600 shadow-sm">Follow-up in 7 days</div>
            <div className="flex gap-1">
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm">EN</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm">ES</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm">中文</span>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-[11px] font-semibold text-teal-700">
            <CheckCircle2 className="h-3 w-3" /> Grade 5&ndash;7
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Section 2 — The Problem                                          */
/* ---------------------------------------------------------------- */
function Problem() {
  const challenges = [
    { icon: FileText, title: "Complex Instructions", desc: "Dense clinical language patients struggle to act on." },
    { icon: BookOpen, title: "Health Literacy Challenges", desc: "Instructions often exceed patient reading levels." },
    { icon: Languages, title: "Language Barriers", desc: "Patients cannot follow guidance they cannot read." },
    { icon: Workflow, title: "Communication Variability", desc: "Inconsistent discharge communication across teams." },
    { icon: Gauge, title: "Unmeasured Discharge Safety Risk", desc: "The risk in take-home instructions goes unmeasured." },
  ]
  const flow = ["Hospital", "Discharge Instructions", "Patient", "Home"]

  return (
    <section id="discharge-safety-risk-reduction" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="The Problem"
            title="Discharge communication impacts what happens next"
          />
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {flow.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold shadow-sm"
                  style={{ color: NAVY }}
                >
                  {step}
                </div>
                {i < flow.length - 1 && <ArrowRight className="h-5 w-5 text-slate-300" />}
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {challenges.map((c, i) => (
            <Reveal key={c.title} delay={i * 60}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(11,99,206,0.08)" }}
                >
                  <c.icon className="h-5 w-5" style={{ color: BLUE }} />
                </span>
                <h3 className="mt-4 text-base font-semibold" style={{ color: NAVY }}>
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 3 — How It Works                                         */
/* ---------------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    { label: "Clinical Source Content", icon: FileText },
    { label: "Aivida Clarity\u2122", icon: ClipboardCheck },
    { label: "Aivida Lingo\u2122", icon: Languages },
    { label: "Clinician Review & Approval", icon: UserCheck },
    { label: "Aivida Navigate\u2122", icon: Stethoscope },
    { label: "Patient Understanding", icon: CheckCircle2 },
  ]
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="How It Works"
            title="From discharge instructions to patient understanding"
            subtitle="A governed workflow designed to improve readability, support multilingual communication, maintain clinician oversight, and deliver patient-friendly discharge instructions."
          />
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {steps.map((s, i) => (
            <Reveal key={s.label} delay={i * 70}>
              <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-5 text-center transition-shadow hover:shadow-md">
                <span
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
                >
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold leading-snug" style={{ color: NAVY }}>
                  {s.label}
                </p>
                <span className="mt-2 block text-xs font-medium text-slate-400">Step {i + 1}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 4 — Outcomes                                             */
/* ---------------------------------------------------------------- */
function Outcomes() {
  const cards = [
    { icon: BookOpen, title: "Improved Patient Understanding" },
    { icon: ShieldCheck, title: "Reduced Discharge Safety Risk" },
    { icon: LineChart, title: "Better HCAHPS Care Transition Performance" },
    { icon: TrendingDown, title: "Fewer Preventable Readmissions" },
    { icon: Activity, title: "Increased Bedside Capacity Utilization" },
    { icon: ClipboardCheck, title: "Stronger Governance & Compliance" },
  ]
  const pillars = ["Quality", "Safety", "Patient Experience", "Operations"]
  return (
    <section id="analytics-insights" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Outcomes" title="Measurable outcomes for healthcare leaders" />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {cards.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <div className="flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(13,148,136,0.1)" }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: TEAL }} />
                  </span>
                  <p className="text-sm font-semibold leading-snug" style={{ color: NAVY }}>
                    {c.title}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Central dashboard visual */}
          <Reveal delay={150}>
            <div
              className="flex h-full flex-col items-center justify-center rounded-2xl p-8 text-center text-white"
              style={{ background: `linear-gradient(160deg, ${NAVY}, ${BLUE})` }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Central Measure</p>
              <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 px-8 py-6 backdrop-blur">
                <Gauge className="mx-auto h-10 w-10 text-teal-300" />
                <p className="mt-2 font-heading text-xl font-bold">Discharge Safety Risk</p>
              </div>
              <div className="mt-8 grid w-full grid-cols-2 gap-3">
                {pillars.map((p) => (
                  <div
                    key={p}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium"
                  >
                    {p}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-white/70">
                Connecting discharge safety risk to the metrics leaders already track.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 5 — Platform                                             */
/* ---------------------------------------------------------------- */
function Platform() {
  const products = [
    {
      id: "aivida-clarity",
      name: "Aivida Clarity\u2122",
      icon: ClipboardCheck,
      tagline: "Clinician-controlled simplification of discharge instructions.",
      features: [
        "Readability Analysis",
        "Grade-Level Measurement",
        "Simplification Workflow",
        "Side-by-Side Review",
        "Clinician Editing",
        "Clinician Approval",
        "Audit Trail",
      ],
    },
    {
      id: "aivida-lingo",
      name: "Aivida Lingo\u2122",
      icon: Languages,
      tagline: "Governed multilingual communication.",
      features: [
        "Multilingual Communication",
        "Governed Translation",
        "Clinician Editing",
        "Clinician Approval",
        "Auditability",
      ],
    },
    {
      id: "aivida-navigate",
      name: "Aivida Navigate\u2122",
      icon: Stethoscope,
      tagline: "Patient-facing discharge experience.",
      features: [
        "Structured discharge instructions",
        "Medication guidance",
        "Follow-up appointments",
        "Warning signs and symptoms",
        "Activity restrictions",
        "Dietary guidance",
        "Multilingual presentation",
        "Mobile-friendly access",
        "Secure patient access",
        "AI-powered Q&A limited to approved discharge content",
      ],
    },
    {
      id: "aivida-insight",
      name: "Aivida Insight\u2122",
      icon: BookOpen,
      tagline: "Continuous improvement and optimization.",
      features: [
        "Expert feedback workflows",
        "Communication optimization insights",
        "Translation feedback",
        "Quality improvement recommendations",
        "Governance participation",
        "Continuous improvement support",
      ],
    },
    {
      id: "aivida-pulse",
      name: "Aivida Pulse\u2122",
      icon: BarChart3,
      tagline: "Measurement and analytics.",
      features: [
        "Readability analytics",
        "Adoption metrics",
        "Governance reporting",
        "Risk insights",
        "Executive dashboards",
        "Discharge safety trend analysis",
      ],
    },
  ]

  return (
    <section id="platform" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Platform"
            title="A platform built for safer discharge communication"
          />
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 80}>
              <div
                id={p.id}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                  style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
                >
                  <p.icon className="h-6 w-6" />
                </span>
                <h3 className="font-heading mt-5 text-xl font-bold" style={{ color: NAVY }}>
                  {p.name}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{p.tagline}</p>
                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 6 — Language Access & Section 1557                        */
/* ---------------------------------------------------------------- */
function LanguageAccess() {
  const features = [
    "Multilingual discharge communication",
    "Governed translation workflows",
    "Clinician review and approval",
    "Patient-preferred language support",
    "Consistent patient-facing communication",
    "Support for Section 1557 language access initiatives",
  ]
  const langs = [
    { code: "EN", text: "Take one tablet every morning with food." },
    { code: "ES", text: "Tome una tableta cada ma\u00f1ana con comida." },
    { code: "中文", text: "每天早上随餐服用一片。" },
    { code: "TI\u1EBENG", text: "U\u1ED1ng m\u1ed9t vi\u00ean m\u1ed7i s\u00e1ng khi \u0103n." },
  ]
  return (
    <section id="multilingual-communication" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              eyebrow="Language Access"
              title="Language access matters"
              subtitle="Patients cannot follow instructions they do not understand. Aivida helps healthcare organizations support patient-preferred language communication through governed multilingual workflows."
              center={false}
            />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  One instruction, every patient
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                  <UserCheck className="h-3 w-3" /> Clinician Approved
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {langs.map((l) => (
                  <div key={l.code} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span
                      className="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold text-white"
                      style={{ backgroundColor: BLUE }}
                    >
                      {l.code}
                    </span>
                    <p className="text-sm text-slate-700">{l.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 7 — EHR Integration                                      */
/* ---------------------------------------------------------------- */
function EHRIntegration() {
  const features = [
    { icon: Network, label: "EHR workflow integration" },
    { icon: Layers, label: "FHIR-based interoperability" },
    { icon: ClipboardCheck, label: "Standards-based architecture" },
    { icon: Stethoscope, label: "Clinician-centered workflows" },
    { icon: ShieldCheck, label: "Auditability and governance" },
    { icon: Building2, label: "Enterprise healthcare deployment" },
  ]
  const flow = ["Epic / Oracle Health (Cerner)", "Aivida Platform", "Clinician Review & Approval", "Patient Delivery"]
  return (
    <section id="security-architecture" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Integration"
            title="Designed for clinical workflows"
            subtitle="Aivida is designed to fit into existing discharge processes and healthcare technology environments."
          />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={f.label} delay={i * 60}>
                <div className="flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(11,99,206,0.08)" }}
                  >
                    <f.icon className="h-5 w-5" style={{ color: BLUE }} />
                  </span>
                  <p className="text-sm font-semibold leading-snug" style={{ color: NAVY }}>
                    {f.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150}>
            <div className="flex h-full flex-col justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-8">
              {flow.map((step, i) => (
                <div key={step} className="flex flex-col items-center">
                  <div
                    className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-semibold shadow-sm"
                    style={{ color: NAVY }}
                  >
                    {step}
                  </div>
                  {i < flow.length - 1 && <ChevronDown className="my-1 h-5 w-5 text-slate-300" />}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 8 — Patient Experience                                   */
/* ---------------------------------------------------------------- */
function PatientExperience() {
  const tiles = [
    { icon: Pill, label: "Medications" },
    { icon: Calendar, label: "Follow-Up Appointments" },
    { icon: Activity, label: "Warning Signs" },
    { icon: Stethoscope, label: "Activity Instructions" },
    { icon: ClipboardCheck, label: "Diet Guidance" },
    { icon: MessageCircleQuestion, label: "Ask Questions" },
  ]
  return (
    <section id="patient-understanding-health-literacy" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              eyebrow="Patient Experience"
              title="Beyond the printed discharge packet"
              center={false}
            />
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Patients often leave the hospital with lengthy documents that are difficult to navigate once they return
              home. Aivida Navigate&trade; organizes approved discharge instructions into a structured digital
              experience.
            </p>
            <div
              className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Bounded AI Assistance</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Patients can ask questions about approved discharge instructions. Responses are limited to content
                approved by the healthcare organization.
              </p>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center transition-shadow hover:shadow-md"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "rgba(11,99,206,0.08)" }}
                  >
                    <t.icon className="h-6 w-6" style={{ color: BLUE }} />
                  </span>
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>
                    {t.label}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 9 — Before & After                                       */
/* ---------------------------------------------------------------- */
function BeforeAfter() {
  const [view, setView] = useState<"before" | "after">("before")
  const [lang, setLang] = useState("EN")

  const afterByLang: Record<string, string[]> = {
    EN: [
      "Take 1 water pill (furosemide) each morning.",
      "Weigh yourself every day. Call us if you gain 3 lbs in a day.",
      "Keep your follow-up visit in 7 days.",
    ],
    ES: [
      "Tome 1 pastilla de agua (furosemida) cada ma\u00f1ana.",
      "P\u00e9sese todos los d\u00edas. Ll\u00e1menos si aumenta 3 libras en un d\u00eda.",
      "Acuda a su cita de seguimiento en 7 d\u00edas.",
    ],
    "中文": [
      "每天早上服用1片利尿药（呋塞米）。",
      "每天称体重。如果一天增加3磅，请给我们打电话。",
      "请在7天内进行复诊。",
    ],
  }

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Before & After"
            title="See the difference"
            subtitle="The same clinical intent, transformed from dense medical language into instructions patients can act on."
          />
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              {(["before", "after"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-6 py-2 text-sm font-semibold capitalize transition-all ${
                    view === v ? "text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  style={view === v ? { backgroundColor: v === "before" ? "#e11d48" : TEAL } : undefined}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mx-auto mt-8 max-w-3xl">
          <Reveal delay={150}>
            {view === "before" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-8">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    <TrendingDown className="h-3.5 w-3.5" /> Grade 16&ndash;18 Readability
                  </span>
                </div>
                <p className="mt-5 leading-relaxed text-slate-700">
                  &ldquo;Administer furosemide 40 mg PO QAM for diuresis; monitor for signs of volume overload including
                  weight gain &gt;1.4 kg/24h and dyspnea. Attend cardiology follow-up within one week post-discharge for
                  reassessment of euvolemic status.&rdquo;
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Grade 5&ndash;7 Readability
                  </span>
                  <div className="flex gap-1.5">
                    {Object.keys(afterByLang).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          lang === l ? "text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                        style={lang === l ? { backgroundColor: BLUE } : undefined}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="mt-5 space-y-3">
                  {(afterByLang[lang] ?? afterByLang.EN).map((line, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: TEAL }} />
                      <span className="text-slate-700">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 10 — Why Aivida                                          */
/* ---------------------------------------------------------------- */
function WhyAivida() {
  const cards = [
    { icon: ShieldCheck, title: "Governed AI", desc: "AI operating within defined, auditable guardrails." },
    { icon: Stethoscope, title: "Clinician Controlled", desc: "Clinicians edit and approve every output." },
    { icon: Users, title: "Human-in-the-Loop", desc: "Oversight built into every workflow." },
    { icon: ScrollText, title: "Audit Ready", desc: "Complete traceability for governance and review." },
    { icon: Lock, title: "Enterprise Security", desc: "Enterprise-grade privacy and security." },
    { icon: Building2, title: "Healthcare Focused", desc: "Purpose-built for discharge communication." },
  ]
  return (
    <section id="governance-compliance" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Why Aivida" title="Governed AI with human oversight" />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-3">
          <Reveal className="lg:col-span-1">
            <div
              className="flex h-full flex-col items-center justify-center rounded-2xl p-8 text-center text-white"
              style={{ background: `linear-gradient(160deg, ${NAVY}, ${BLUE})` }}
            >
              <ShieldCheck className="h-14 w-14 text-teal-300" />
              <p className="font-heading mt-4 text-lg font-bold">Governance by Design</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["AI", "Clinicians", "Governance", "Patients"].map((n) => (
                  <span
                    key={n}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
            {cards.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "rgba(13,148,136,0.1)" }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: TEAL }} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold" style={{ color: NAVY }}>
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 11 — Testimonials                                        */
/* ---------------------------------------------------------------- */
function Testimonials() {
  const quotes = [
    {
      quote:
        "Patient understanding of discharge instructions is one of the most under-addressed drivers of preventable readmissions, patient experience scores, and care transition outcomes. Aivida Healthcare Technology's governed approach brings measurement, accountability, and clinical oversight to a process that has historically been difficult to standardize and govern.",
      who: "Healthcare Industry Advisor",
    },
    {
      quote:
        "Improving patient understanding at discharge is critical to reducing discharge risk. Solutions that simplify complex instructions while preserving clinical intent can strengthen the safety and reliability of care transitions.",
      who: "Healthcare Executive",
    },
    {
      quote:
        "Healthcare organizations need AI solutions that maintain clinician oversight, governance, and accountability. The governed approach is what differentiates Aivida.",
      who: "Hospital Quality Leader",
    },
  ]
  return (
    <section id="research-insights" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Testimonials" title="What healthcare leaders are saying" />
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <Reveal key={i} delay={i * 80}>
              <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <Quote className="h-8 w-8" style={{ color: TEAL }} />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">{q.quote}</blockquote>
                <figcaption className="mt-6 border-t border-slate-100 pt-4 text-sm font-semibold" style={{ color: NAVY }}>
                  &mdash; {q.who}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">
          Names withheld at the request of the individuals and organizations.
        </p>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 12 — Leadership                                          */
/* ---------------------------------------------------------------- */
function Leadership() {
  const groups = [
    { title: "Founder & CEO", icon: UserCheck, desc: "Setting the vision for governed AI at discharge." },
    { title: "Clinical Advisors", icon: Stethoscope, desc: "Ensuring clinical integrity and oversight." },
    { title: "Technology Leadership", icon: Layers, desc: "Building secure, standards-based architecture." },
    { title: "Healthcare Advisors", icon: Building2, desc: "Guiding enterprise healthcare strategy." },
  ]
  return (
    <section id="leadership" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Leadership" title="Built with healthcare leadership in mind" />
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g, i) => (
            <Reveal key={g.title} delay={i * 70}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 text-center transition-shadow hover:shadow-md">
                <span
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <g.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-base font-semibold" style={{ color: NAVY }}>
                  {g.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{g.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 13 — Newsletter                                          */
/* ---------------------------------------------------------------- */
function Newsletter() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setStatus("submitting")
    try {
      const formData = new FormData(form)
      formData.append("access_key", WEB3FORMS_ACCESS_KEY)
      formData.append("subject", "New Discharge Safety Report subscription")
      formData.append("from_name", "Aivida Newsletter")
      const res = await fetch(WEB3FORMS_ENDPOINT, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setStatus("success")
        setEmail("")
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  return (
    <section id="the-discharge-safety-report" className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-3xl px-8 py-12 text-center text-white sm:px-16"
          style={{ background: `linear-gradient(160deg, ${NAVY}, ${BLUE})` }}
        >
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              <ScrollText className="h-3.5 w-3.5 text-teal-300" /> Newsletter
            </span>
            <h2 className="font-heading mt-4 text-3xl font-bold sm:text-4xl">The Discharge Safety Report</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-200">
              Insights for healthcare leaders on discharge safety risk, patient understanding, readability, multilingual
              communication, language access, and governed AI at discharge.
            </p>
            <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              {/* Honeypot spam trap (hidden from real users) */}
              <input
                type="checkbox"
                name="botcheck"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your work email"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "submitting" || status === "success"}
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ color: NAVY }}
              >
                {status === "submitting" ? "Subscribing…" : status === "success" ? "Subscribed" : "Subscribe"}
              </button>
            </form>
            {status === "success" && (
              <p className="mt-3 text-sm text-teal-200">Thank you — you&apos;re on the list.</p>
            )}
            {status === "error" && (
              <p className="mt-3 text-sm text-rose-200">Something went wrong. Please try again.</p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 14 — Final CTA                                           */
/* ---------------------------------------------------------------- */
function FinalCTA() {
  return (
    <section id="assessment" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Get Started"
            title="Ready to measure discharge safety risk?"
            subtitle="Discover how Aivida helps hospitals improve patient understanding, support language access, and reduce discharge safety risk through governed AI and clinician oversight."
          />
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: BLUE, boxShadow: "0 10px 30px -10px rgba(11,99,206,0.5)" }}
            >
              Request a Complimentary Discharge Safety Risk Assessment
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white/70"
            >
              Schedule a Conversation
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 15 — Contact                                             */
/* ---------------------------------------------------------------- */
function Contact() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setStatus("submitting")
    try {
      const formData = new FormData(form)
      formData.append("access_key", WEB3FORMS_ACCESS_KEY)
      formData.append("subject", "New Discharge Safety Risk Assessment Request")
      formData.append("from_name", "Aivida Website")
      const res = await fetch(WEB3FORMS_ENDPOINT, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setStatus("success")
        form.reset()
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  const fields: { name: string; label: string; type?: string; full?: boolean }[] = [
    { name: "firstName", label: "First Name" },
    { name: "lastName", label: "Last Name" },
    { name: "title", label: "Title" },
    { name: "organization", label: "Organization" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "hospitals", label: "Number of Hospitals", type: "number" },
  ]
  return (
    <section id="contact" className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <SectionHeading eyebrow="Contact" title="Request an assessment" center={false} />
            <p className="mt-4 text-slate-600">
              Tell us about your organization and we&apos;ll follow up to schedule your complimentary Discharge Safety
              Risk Assessment.
            </p>
            <div className="mt-8 space-y-4">
              <a
                href="mailto:info@aividahealth.ai"
                className="flex items-center gap-3 text-sm text-slate-700 transition-colors hover:text-[#0B63CE]"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(11,99,206,0.08)" }}
                >
                  <Mail className="h-5 w-5" style={{ color: BLUE }} />
                </span>
                info@aividahealth.ai
              </a>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(13,148,136,0.1)" }}
                >
                  <MapPin className="h-5 w-5" style={{ color: TEAL }} />
                </span>
                Austin, Texas
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(11,99,206,0.08)" }}
                >
                  <Phone className="h-5 w-5" style={{ color: BLUE }} />
                </span>
                By request
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-3" delay={120}>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-lg shadow-slate-900/5"
            >
              {/* Honeypot spam trap (hidden from real users) */}
              <input
                type="checkbox"
                name="botcheck"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.name} className={f.name === "hospitals" ? "sm:col-span-2" : ""}>
                    <label htmlFor={f.name} className="block text-sm font-medium text-slate-700">
                      {f.label}
                    </label>
                    <input
                      id={f.name}
                      name={f.name}
                      type={f.type ?? "text"}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#0B63CE] focus:outline-none focus:ring-2 focus:ring-[#0B63CE]/20"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#0B63CE] focus:outline-none focus:ring-2 focus:ring-[#0B63CE]/20"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={status === "submitting" || status === "success"}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                style={{ backgroundColor: BLUE }}
              >
                {status === "submitting"
                  ? "Sending…"
                  : status === "success"
                    ? "Request Received"
                    : "Request Assessment"}
                <ArrowRight className="h-4 w-4" />
              </button>
              {status === "success" && (
                <p className="mt-3 text-sm text-teal-600">
                  Thank you — we&apos;ll be in touch shortly to schedule your assessment.
                </p>
              )}
              {status === "error" && (
                <p className="mt-3 text-sm text-rose-600">
                  Something went wrong. Please try again or email{" "}
                  <a href="mailto:info@aividahealth.ai" className="underline">
                    info@aividahealth.ai
                  </a>
                  .
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Section 16 — Footer                                              */
/* ---------------------------------------------------------------- */
function Footer() {
  const cols = [
    { title: "Company", items: ["About", "Leadership", "Advisors", "Contact"] },
    {
      title: "Solutions",
      items: [
        "Discharge Safety Risk Reduction",
        "Patient Understanding & Health Literacy",
        "Multilingual Communication",
        "Governance & Compliance",
        "Analytics & Insights",
      ],
    },
    {
      title: "Platform",
      items: [
        "Aivida Clarity\u2122",
        "Aivida Lingo\u2122",
        "Aivida Navigate\u2122",
        "Aivida Insight\u2122",
        "Aivida Pulse\u2122",
      ],
    },
    {
      title: "Resources",
      items: ["The Discharge Safety Report", "Research & Insights"],
    },
  ]
  return (
    <footer style={{ backgroundColor: NAVY }} className="text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
              >
                <Activity className="h-5 w-5" />
              </span>
              <span className="font-heading text-lg font-bold text-white">Aivida</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Governed AI and clinician oversight to measure and reduce discharge safety risk.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <a href="#" className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                <Globe2 className="h-4 w-4" /> LinkedIn
              </a>
              <a href="#the-discharge-safety-report" className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                <ScrollText className="h-4 w-4" /> Newsletter Subscription
              </a>
              <a href="mailto:info@aividahealth.ai" className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                <Mail className="h-4 w-4" /> info@aividahealth.ai
              </a>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-white">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item}>
                    <a
                      href={anchorFor(item)}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm font-medium text-white">
            Request a Complimentary Discharge Safety Risk Assessment
          </p>
          <a
            href="#assessment"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white sm:mt-0"
            style={{ backgroundColor: BLUE }}
          >
            Request Assessment <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          &copy; 2026 Aivida Healthcare Technology. All Rights Reserved.
        </div>
      </div>
    </footer>
  )
}

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-open-sans antialiased">
      <Header />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Outcomes />
        <Platform />
        <LanguageAccess />
        <EHRIntegration />
        <PatientExperience />
        <BeforeAfter />
        <WhyAivida />
        <Testimonials />
        <Leadership />
        <Newsletter />
        <FinalCTA />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
