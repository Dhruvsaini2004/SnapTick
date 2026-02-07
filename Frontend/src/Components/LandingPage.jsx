import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { 
  FiCamera, FiUsers, FiClock, FiShield, 
  FiArrowRight, FiMoon, FiSun, FiCheck,
  FiZap, FiLayers, FiBarChart2
} from "react-icons/fi";

export default function LandingPage({ isDark, setIsDark }) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--color-primary)]/3 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-[var(--bg-app)]/80 border-b border-[var(--border-subtle)]/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                <FiCamera className="text-[var(--color-primary-text)] text-lg" />
              </div>
              <span className="font-bold text-lg text-[var(--text-main)]">SnapTick</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all"
              >
                {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
              </button>
              <Link
                to="/login"
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors px-3 py-2"
              >
                Log in
              </Link>
              <Link
                to="/login?register=true"
                className="btn-primary px-4 py-2 rounded-lg text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-semibold mb-6 border border-[var(--color-primary)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              Powered by Computer Vision
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-main)] leading-[1.1] tracking-tight mb-6">
              Attendance tracking
              <br />
              <span className="text-[var(--color-primary)]">that just works.</span>
            </h1>
            
            <p className="text-lg text-[var(--text-secondary)] mb-10 max-w-xl leading-relaxed">
              Upload a group photo, and let AI recognize who&apos;s present. 
              Built for educators who value their time.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/login?register=true"
                className="btn-primary px-6 py-3.5 rounded-xl text-base flex items-center gap-2 group"
              >
                Start for free
                <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="px-6 py-3.5 rounded-xl text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--color-primary)]/50 transition-all"
              >
                How it works
              </a>
            </div>
          </Motion.div>

          {/* Stats */}
          <Motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-2xl"
          >
            {[
              { value: "2 sec", label: "Average scan time" },
              { value: "99.2%", label: "Recognition accuracy" },
              { value: "Free", label: "For educators" }
            ].map((stat, i) => (
              <div key={i} className="text-center sm:text-left">
                <div className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">{stat.value}</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{stat.label}</div>
              </div>
            ))}
          </Motion.div>
        </div>
      </section>

      {/* Demo Preview */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <Motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="glass-card p-4 sm:p-6"
          >
            <div className="bg-[var(--bg-input)] rounded-xl p-6 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <div className="flex-1 h-8 bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)] flex items-center px-3">
                  <span className="text-xs text-[var(--text-muted)]">dashboard.attendai.app</span>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Left - Image placeholder */}
                <div className="aspect-[4/3] bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)] flex items-center justify-center">
                  <div className="text-center">
                    <FiCamera className="text-4xl text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-muted)]">Upload class photo</p>
                  </div>
                </div>
                
                {/* Right - Results */}
                <div className="space-y-3">
                  {["Alex Johnson", "Maria Garcia", "James Chen", "Sarah Williams"].map((name, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-subtle)]">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] text-sm font-medium">
                        {name.charAt(0)}
                      </div>
                      <span className="flex-1 text-sm font-medium text-[var(--text-main)]">{name}</span>
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <FiCheck className="text-emerald-500 text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-[var(--bg-card)]/50">
        <div className="max-w-6xl mx-auto">
          <Motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-main)] mb-4">
              Built for real classrooms
            </h2>
            <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
              No complex setup. No expensive hardware. Just a camera and your students.
            </p>
          </Motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: FiZap,
                title: "Instant Recognition",
                desc: "Upload a photo and get attendance marked in seconds. No manual entry needed."
              },
              {
                icon: FiLayers,
                title: "Multi-Classroom",
                desc: "Organize students by class, section, or subject. Each with its own attendance history."
              },
              {
                icon: FiClock,
                title: "Save Hours Weekly",
                desc: "Replace 15-minute roll calls with a single photo. Time better spent teaching."
              },
              {
                icon: FiShield,
                title: "Privacy First",
                desc: "Face data stays on your account. No sharing with third parties. Ever."
              },
              {
                icon: FiBarChart2,
                title: "Attendance Records",
                desc: "View history, edit records, and track participation patterns over time."
              },
              {
                icon: FiUsers,
                title: "Easy Enrollment",
                desc: "Add students with a single photo. The system learns to recognize them automatically."
              }
            ].map((feature, i) => (
              <Motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--color-primary)]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] mb-4">
                  <feature.icon size={20} />
                </div>
                <h3 className="font-semibold text-[var(--text-main)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{feature.desc}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-main)] mb-4">
              Three steps. That&apos;s it.
            </h2>
          </Motion.div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Create a classroom",
                desc: "Name it, add a description if you want. Takes about 10 seconds."
              },
              {
                step: "02",
                title: "Enroll your students",
                desc: "Upload a photo of each student. The AI learns their face automatically."
              },
              {
                step: "03",
                title: "Snap and done",
                desc: "Take a group photo. The system marks who's present. Attendance complete."
              }
            ].map((item, i) => (
              <Motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-main)] mb-2">{item.title}</h3>
                  <p className="text-[var(--text-secondary)]">{item.desc}</p>
                </div>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="glass-card p-10 sm:p-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] mb-4">
              Ready to save time?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8">
              Join educators who have simplified their attendance workflow.
            </p>
            <Link
              to="/login?register=true"
              className="btn-primary px-8 py-4 rounded-xl text-base inline-flex items-center gap-2 group"
            >
              Create free account
              <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </Motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
              <FiCamera className="text-[var(--color-primary-text)] text-sm" />
            </div>
            <span className="font-semibold text-[var(--text-main)]">SnapTick</span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Face recognition attendance for modern classrooms.
          </p>
        </div>
      </footer>
    </div>
  );
}
