"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  Dna,
  FileCheck2,
  Fingerprint,
  GitBranch,
  HeartPulse,
  Menu,
  Moon,
  Network,
  Orbit,
  ShieldCheck,
  Stethoscope,
  Sun,
  X,
} from "lucide-react";
import KioBrandMark from "@/components/kio-brand";
import { KioTheme, useKioTheme } from "@/components/theme-provider";


const navigation = [
  { label: "Agent Matrices", href: "#capabilities" },
  { label: "Infrastructure", href: "#infrastructure" },
  { label: "HIPAA Vault", href: "#compliance" },
  { label: "API Engine", href: "#developers" },
];

const capabilities = [
  {
    icon: Dna,
    label: "01 / SYNTHESIS",
    title: "Helix Synthesis Engine",
    copy: "High-volume multi-omics streams are normalized into traceable biological reasoning pathways.",
    detail: "GENOMIC / PROTEOMIC / CLINICAL",
  },
  {
    icon: Network,
    label: "02 / TRIAGE",
    title: "Synaptic Lattice Triage",
    copy: "Autonomous routing logic prioritizes patient signals across complex clinical service lines.",
    detail: "ROUTING / ESCALATION / REVIEW",
  },
  {
    icon: ShieldCheck,
    label: "03 / ASSURANCE",
    title: "Compliance Assurance Layer",
    copy: "Policy-aware infrastructure applies privacy controls across every agent execution boundary.",
    detail: "AUDIT / IDENTITY / GOVERNANCE",
  },
];

const metrics = [
  { value: "99.8%", label: "HIPAA Compliant Processing Precision Rate" },
  { value: "< 140ms", label: "Agent Execution Inference Latency" },
  { value: "4.8M+", label: "Clinical Encounters Synthesized Annually" },
];

const standards = [
  { name: "HIPAA", detail: "Privacy controls", icon: ShieldCheck },
  { name: "SOC 2", detail: "Type II controls", icon: Fingerprint },
  { name: "HL7 FHIR", detail: "Interoperability", icon: GitBranch },
  { name: "GDPR", detail: "Data protection", icon: FileCheck2 },
];

const careJourney = [
  {
    icon: HeartPulse,
    title: "Start with the person",
    copy: "KIO turns symptoms, concerns, and health context into a structured picture without losing the patient's own words.",
  },
  {
    icon: Stethoscope,
    title: "Ground the guidance",
    copy: "Clinical evidence and relevant warning signs are surfaced in language patients and care teams can act on.",
  },
  {
    icon: ClipboardCheck,
    title: "Prepare the next step",
    copy: "Every response helps clarify what to monitor, what to ask, and when professional care should not wait.",
  },
];

const logs = [
  "Formulating Differential Matrix",
  "Mapping longitudinal patient signals",
  "Validating evidence confidence layer",
  "Securing clinical synthesis output",
];


function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="KIO Medical AI home">
      <KioBrandMark size={38} />
      <span className="flex flex-col leading-none">
        <strong className="text-[17px] font-extrabold">KIO</strong>
        <span className="mt-1 text-[8px] font-semibold text-[var(--landing-muted)]">MEDICAL AI</span>
      </span>
    </Link>
  );
}


function ThemeButton({ theme, onToggle }: { theme: KioTheme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex size-10 items-center justify-center rounded-md border border-[var(--landing-line)] bg-[var(--landing-surface)] text-[var(--landing-muted)] transition hover:text-[var(--landing-ink)]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}


function MolecularConsole({ activeLog, progress }: { activeLog: number; progress: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      <div className="absolute -inset-px rounded-lg bg-[var(--landing-accent)] opacity-20 blur-md" />
      <div className="relative overflow-hidden rounded-lg border border-[var(--landing-line)] bg-[var(--landing-surface)] p-2 shadow-2xl backdrop-blur-xl">
        <div className="hidden h-10 items-center justify-between border-b border-[var(--landing-line)] px-3 sm:flex">
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-400 status-pulse" />
            AI AGENT PROGRESS
          </div>
          <span className="font-mono text-[9px] text-[var(--landing-muted)]">NODE KIO-07 / ACTIVE</span>
        </div>

        <div className="molecular-visual relative aspect-[16/6] overflow-hidden bg-black sm:aspect-[16/10]">
          <Image
            src="/images/kio-molecular-core.png"
            alt="Luminous DNA helix inside KIO's molecular synthesis chamber"
            fill
            priority
            sizes="(max-width: 1024px) 94vw, 52vw"
            className="object-cover"
          />
          <div className="absolute left-4 top-4 z-10 rounded-md border border-emerald-300/20 bg-black/65 px-3 py-2 font-mono text-[9px] text-emerald-100 backdrop-blur-md">
            <div className="text-emerald-300">MOLECULAR AGENT / K</div>
            <div className="mt-1 text-slate-400">REASONING FIELD STABLE</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-4">
            <div className="mb-2 flex justify-between font-mono text-[9px] text-slate-300">
              <span>DIFFERENTIAL SYNTHESIS</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-300 transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden border-t border-[var(--landing-line)] bg-[#030712] px-4 py-4 font-mono text-[10px] text-slate-400 sm:block">
          <div className="signal-line absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-emerald-300/10 to-transparent" />
          <div className="relative flex items-start gap-3">
            <span className="text-emerald-300">[02:31:{String(5 + activeLog).padStart(2, "0")}]</span>
            <span className="min-w-0 flex-1 text-slate-200">KIO Synthesis Engine: {logs[activeLog]}...</span>
            <span className="text-emerald-300">{progress}%</span>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 hidden w-[92%] items-center justify-between font-mono text-[9px] text-[var(--landing-muted)] sm:flex">
        <span>ENCRYPTED CHANNEL / AES-256</span>
        <span>TRACE ID 8A7C-KIO</span>
      </div>
    </div>
  );
}


export default function LandingPage() {
  const { theme, toggleTheme } = useKioTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLog, setActiveLog] = useState(0);
  const [progress, setProgress] = useState(78);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveLog((current) => (current + 1) % logs.length);
      setProgress((current) => (current >= 96 ? 74 : current + 6));
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div id="kio-workspace" data-theme={theme} className="min-h-screen overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-ink)] transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-[var(--landing-line)] bg-[var(--landing-surface)] backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8" aria-label="Primary navigation">
          <Brand />
          <div className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <a key={item.label} href={item.href} className="text-[12px] font-semibold text-[var(--landing-muted)] transition hover:text-[var(--landing-ink)]">
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeButton theme={theme} onToggle={toggleTheme} />
            <Link href="/console" className="hidden h-10 items-center gap-2 rounded-md bg-[var(--landing-accent)] px-4 text-[11px] font-bold text-[var(--landing-accent-contrast)] transition hover:brightness-110 sm:flex">
              Launch Core Console <ArrowRight size={14} />
            </Link>
            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex size-10 items-center justify-center rounded-md border border-[var(--landing-line)] bg-[var(--landing-surface)] lg:hidden" aria-label="Toggle navigation">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
        {mobileMenuOpen && (
          <div className="border-t border-[var(--landing-line)] bg-[var(--landing-surface-solid)] px-5 py-4 lg:hidden">
            <div className="mx-auto grid max-w-[1240px] gap-1">
              {navigation.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center justify-between border-b border-[var(--landing-line)] text-sm">
                  {item.label}<ChevronRight size={15} />
                </a>
              ))}
              <Link href="/console" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--landing-accent)] text-xs font-bold text-[var(--landing-accent-contrast)]">
                Launch Core Console <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative border-b border-[var(--landing-line)]">
          <div className="mx-auto grid min-h-[calc(100vh-120px)] max-w-[1240px] items-center gap-6 px-5 py-8 sm:gap-10 sm:py-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14 lg:px-8 lg:py-16">
            <div className="max-w-[590px]">
              <div className="mb-5 flex items-center gap-3 font-mono text-[10px] font-semibold text-[var(--landing-accent)] sm:mb-7">
                <span className="size-1.5 rounded-full bg-[var(--landing-accent)] status-pulse" />
                [KIO PIPELINE STABLE ENGINE V1.2]
              </div>
              <h1 className="text-[40px] font-extrabold leading-[1.04] sm:text-[58px] lg:text-[68px]">
                Autonomous Clinical Reasoning. <span className="text-[var(--landing-accent)]">Driven by Molecular Agents.</span>
              </h1>
              <p className="mt-7 max-w-[520px] text-[15px] leading-7 text-[var(--landing-muted)]">
                KIO orchestrates specialized clinical agents across patient signals, molecular evidence, and enterprise policy boundaries.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/console" className="flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--landing-accent)] px-5 text-[12px] font-bold text-[var(--landing-accent-contrast)] transition hover:brightness-110">
                  Launch Core Console <ArrowRight size={15} />
                </Link>
                <a href="#capabilities" className="flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--landing-line)] bg-[var(--landing-surface)] px-5 text-[12px] font-bold transition hover:border-[var(--landing-accent)]">
                  Inspect Agent Matrix <Orbit size={15} />
                </a>
              </div>
              <div className="mt-10 hidden grid-cols-3 border-y border-[var(--landing-line)] py-4 sm:grid">
                {["Evidence bound", "Human reviewed", "Audit ready"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[9px] font-semibold text-[var(--landing-muted)]">
                    <Check size={12} className="text-[var(--landing-accent)]" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <MolecularConsole activeLog={activeLog} progress={progress} />
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-24 border-b border-[var(--landing-line)] py-24">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
              <div>
                <span className="font-mono text-[10px] font-semibold text-[var(--landing-accent)]">/ CORE INFRASTRUCTURE</span>
                <h2 className="mt-4 max-w-[720px] text-[38px] font-extrabold leading-[1.1] sm:text-[48px]">Engineered for High-Stakes Medicine</h2>
              </div>
              <p className="max-w-[460px] text-sm leading-7 text-[var(--landing-muted)] lg:justify-self-end">
                Three coordinated layers transform fragmented clinical inputs into governed, reviewable decision support.
              </p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {capabilities.map((capability) => {
                const Icon = capability.icon;
                return (
                  <article key={capability.title} className="group min-h-[330px] rounded-lg border border-[var(--landing-line)] bg-[var(--landing-surface)] p-6 backdrop-blur-md transition hover:border-[var(--landing-accent)]">
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-md bg-[var(--landing-accent-soft)] text-[var(--landing-accent)]"><Icon size={21} /></span>
                      <span className="font-mono text-[9px] text-[var(--landing-muted)]">{capability.label}</span>
                    </div>
                    <h3 className="mt-14 text-xl font-bold">{capability.title}</h3>
                    <p className="mt-4 text-[13px] leading-6 text-[var(--landing-muted)]">{capability.copy}</p>
                    <div className="mt-8 border-t border-[var(--landing-line)] pt-4 font-mono text-[9px] text-[var(--landing-accent)]">{capability.detail}</div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--landing-line)] bg-[var(--landing-surface)] py-20">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <span className="font-mono text-[10px] font-semibold text-[var(--landing-accent)]">/ PATIENT-CENTERED CARE</span>
                <h2 className="mt-4 max-w-[430px] text-[34px] font-extrabold leading-[1.1] sm:text-[42px]">Medical intelligence that stays human</h2>
                <p className="mt-5 max-w-[430px] text-sm leading-7 text-[var(--landing-muted)]">Technology supports the conversation. It does not replace clinical judgment or the relationship between a patient and their care team.</p>
              </div>
              <div className="grid border-y border-[var(--landing-line)] md:grid-cols-3 md:divide-x md:divide-[var(--landing-line)]">
                {careJourney.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="border-b border-[var(--landing-line)] px-1 py-8 last:border-b-0 md:border-b-0 md:px-7">
                      <Icon size={24} className="text-[var(--landing-accent)]" />
                      <h3 className="mt-8 text-base font-bold">{item.title}</h3>
                      <p className="mt-3 text-[12px] leading-6 text-[var(--landing-muted)]">{item.copy}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="infrastructure" className="scroll-mt-24 border-b border-[var(--landing-line)] bg-[var(--landing-bg)] py-20 text-[var(--landing-ink)]">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mb-12 flex flex-col justify-between gap-4 border-b border-[var(--landing-line)] pb-6 sm:flex-row sm:items-end">
              <div>
                <span className="font-mono text-[10px] text-[var(--landing-accent)]">LIVE OPERATIONAL MATRIX</span>
                <h2 className="mt-3 text-2xl font-bold">Clinical engine telemetry</h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--landing-muted)]"><Activity size={14} className="text-[var(--landing-accent)]" /> ALL SYSTEMS NOMINAL</div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--landing-line)] bg-[var(--landing-line)] md:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.value} className="bg-[var(--landing-surface-solid)] px-7 py-12">
                  <strong className="font-mono text-[42px] font-medium text-[var(--landing-accent)] sm:text-[48px]">{metric.value}</strong>
                  <p className="mt-5 max-w-[250px] text-[12px] leading-5 text-[var(--landing-muted)]">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="compliance" className="scroll-mt-24 border-b border-[var(--landing-line)] py-16">
          <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
            <div className="mb-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--landing-line)]" />
              <span className="font-mono text-[9px] font-semibold text-[var(--landing-muted)]">ENTERPRISE TRUST LAYER</span>
              <div className="h-px flex-1 bg-[var(--landing-line)]" />
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--landing-line)] bg-[var(--landing-line)] lg:grid-cols-4">
              {standards.map((standard) => {
                const Icon = standard.icon;
                return (
                  <div key={standard.name} className="flex min-h-28 items-center gap-4 bg-[var(--landing-bg)] px-5 grayscale transition hover:grayscale-0">
                    <Icon size={25} className="text-[var(--landing-accent)]" />
                    <div><strong className="block text-sm">{standard.name}</strong><span className="mt-1 block text-[10px] text-[var(--landing-muted)]">{standard.detail}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer id="developers" className="scroll-mt-24 bg-[var(--landing-surface-solid)]">
        <div className="mx-auto max-w-[1240px] px-5 pb-8 pt-16 lg:px-8">
          <div className="grid gap-12 pb-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr]">
            <div>
              <Brand />
              <p className="mt-5 max-w-[320px] text-[12px] leading-6 text-[var(--landing-muted)]">A governed clinical reasoning layer for healthcare systems building the next generation of patient operations.</p>
            </div>
            <div>
              <h3 className="text-[11px] font-bold">Product</h3>
              <div className="mt-4 grid gap-3 text-[11px] text-[var(--landing-muted)]"><a href="#capabilities">Agent matrices</a><a href="#infrastructure">Infrastructure</a><Link href="/console">Core console</Link></div>
            </div>
            <div>
              <h3 className="text-[11px] font-bold">Developers</h3>
              <div className="mt-4 grid gap-3 text-[11px] text-[var(--landing-muted)]"><a href="mailto:developers@kio.ai">API access</a><a href="mailto:developers@kio.ai">Documentation</a><a href="mailto:developers@kio.ai">System status</a></div>
            </div>
            <div>
              <h3 className="text-[11px] font-bold">Legal</h3>
              <div className="mt-4 grid gap-3 text-[11px] text-[var(--landing-muted)]"><a href="mailto:legal@kio.ai">Privacy</a><a href="mailto:legal@kio.ai">Security</a><a href="mailto:legal@kio.ai">Clinical policy</a></div>
            </div>
          </div>
          <div className="flex flex-col gap-4 border-t border-[var(--landing-line)] pt-7 text-[9px] text-[var(--landing-muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 KIO Medical AI Inc. All clinical models are sandboxed under strict regulatory guidelines.</span>
            <span className="flex items-center gap-2 font-mono"><DatabaseZap size={12} /> KIO CORE / V1.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
