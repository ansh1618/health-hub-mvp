import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, AlertTriangle, Activity, BarChart3, ShieldCheck, User, Stethoscope, HeartPulse, ChevronDown, ChevronUp, Bell } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import PatientCard from "@/components/dashboard/PatientCard";
import RiskChart from "@/components/dashboard/RiskChart";
import UrgencyMatrix from "@/components/dashboard/UrgencyMatrix";
import PatientDetailModal from "@/components/dashboard/PatientDetailModal";
import { patients, RiskLevel, Patient } from "@/data/mockPatients";
import { useAuth } from "@/hooks/useAuth";

// Sparkline SVG for patient view
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = 32;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const trending = data[data.length - 1] > data[data.length - 2];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-[120px] h-[32px]">
        <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
      <span className={`text-xs font-bold ${trending ? "text-destructive" : "text-emerald-500"}`}>
        {trending ? "↑" : "↓"}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [alertExpanded, setAlertExpanded] = useState(false);
  const { roles } = useAuth();

  const primaryRole = roles[0] || "patient";
  const isDoctor = primaryRole === "doctor";
  const isAdmin = primaryRole === "admin";
  const isPatient = primaryRole === "patient";

  const visiblePatients = isPatient ? patients.slice(0, 1) : patients;
  const filtered = filter === "all" ? visiblePatients : visiblePatients.filter((p) => p.riskLevel === filter);
  const criticalCount = visiblePatients.filter((p) => p.riskLevel === "critical").length;
  const moderateCount = visiblePatients.filter((p) => p.riskLevel === "moderate").length;
  const avgMEWS = Math.round(visiblePatients.reduce((s, p) => s + p.mews.total, 0) / (visiblePatients.length || 1) * 10) / 10;
  const criticalPatients = visiblePatients.filter((p) => p.riskLevel === "critical");

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  const filters: { label: string; value: RiskLevel | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Critical", value: "critical" },
    { label: "Moderate", value: "moderate" },
    { label: "Stable", value: "stable" },
  ];

  const roleLabel = isAdmin ? "Hospital Overview" : isDoctor ? "Doctor Portal" : "My Health Summary";
  const roleSubtitle = isAdmin
    ? `Full hospital monitoring · ${visiblePatients.length} active patients`
    : isDoctor
    ? `Your clinical dashboard · ${visiblePatients.length} active patients`
    : "Your personal health dashboard";

  // Patient-specific data
  const myPatient = patients[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{roleLabel}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{roleSubtitle}</p>
          </div>
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
            isAdmin ? "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
            : isDoctor ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          }`}>
            {isAdmin ? <ShieldCheck className="w-3 h-3" /> : isDoctor ? <Stethoscope className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)} View
          </div>
        </motion.div>

        {/* Doctor: AI Alert Banner */}
        {isDoctor && criticalPatients.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={() => setAlertExpanded(!alertExpanded)}
              className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between hover:bg-destructive/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-destructive" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-destructive">{criticalPatients.length} Critical Patients Need Attention</p>
                  <p className="text-xs text-muted-foreground">Click to view AI predictions and recommended actions</p>
                </div>
              </div>
              {alertExpanded ? <ChevronUp className="w-4 h-4 text-destructive" /> : <ChevronDown className="w-4 h-4 text-destructive" />}
            </button>
            <AnimatePresence>
              {alertExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    {criticalPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPatient(p)}
                        className="rounded-xl border border-destructive/20 bg-card p-4 text-left hover:border-destructive/40 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{p.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">MEWS {p.mews.total}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{p.condition}</p>
                        {p.aiPrediction && (
                          <p className="text-xs text-destructive/80 leading-relaxed">{p.aiPrediction}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Stats */}
        {isPatient ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard title="Risk Score" value={`${myPatient.riskScore}%`} icon={HeartPulse}
              variant={myPatient.riskLevel === "critical" ? "critical" : myPatient.riskLevel === "moderate" ? "warning" : "primary"}
              subtitle="Overall health risk" />
            <StatCard title="MEWS Score" value={myPatient.mews.total} icon={Activity} variant="primary" subtitle="Early warning score" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title={isAdmin ? "Total Patients" : "My Patients"} value={visiblePatients.length} icon={Users} subtitle={isAdmin ? "Active admissions" : "Assigned to you"} />
            <StatCard title="Critical" value={criticalCount} icon={AlertTriangle} variant="critical" trend={isAdmin ? { value: 8, positive: false } : undefined} />
            <StatCard title="Moderate" value={moderateCount} icon={Activity} variant="warning" />
            <StatCard title="Avg MEWS" value={avgMEWS} icon={BarChart3} variant="primary" subtitle="Modified Early Warning Score" />
          </div>
        )}

        {/* Patient-specific: Risk trend sparkline, Lab results table, Vitals, Comorbidities */}
        {isPatient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Risk Trend */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">6-Day Risk Trend</h3>
              <Sparkline data={myPatient.trends} />
              <p className="text-xs text-muted-foreground mt-2">
                {myPatient.trends[myPatient.trends.length - 1] > myPatient.trends[myPatient.trends.length - 2]
                  ? "⚠️ Risk is trending upward — follow up with your doctor"
                  : "✅ Risk is improving — keep up your treatment plan"}
              </p>
            </div>

            {/* Vitals with labels */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Current Vitals</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Heart Rate", value: `${myPatient.vitals.heartRate} bpm`, normal: myPatient.vitals.heartRate >= 60 && myPatient.vitals.heartRate <= 100 },
                  { label: "Blood Pressure", value: myPatient.vitals.bloodPressure, normal: myPatient.vitals.systolicBP <= 130 },
                  { label: "SpO₂", value: `${myPatient.vitals.oxygenSat}%`, normal: myPatient.vitals.oxygenSat >= 95 },
                  { label: "Temperature", value: `${myPatient.vitals.temperature}°C`, normal: myPatient.vitals.temperature <= 37.5 },
                ].map((v) => (
                  <div key={v.label} className="rounded-lg bg-muted/30 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{v.label}</p>
                    <p className="text-sm font-bold">{v.value}</p>
                    <span className={`text-[10px] font-medium ${v.normal ? "text-emerald-500" : "text-orange-500"}`}>
                      {v.normal ? "Normal" : "Monitor"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lab Results Table */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Lab Results</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Test</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPatient.labResults.map((lab, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{lab.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{lab.value}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lab.flag === "critical" ? "bg-destructive/10 text-destructive" :
                            lab.flag === "high" ? "bg-orange-500/10 text-orange-500" :
                            lab.flag === "low" ? "bg-orange-500/10 text-orange-500" :
                            "bg-emerald-500/10 text-emerald-500"
                          }`}>{lab.flag}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comorbidities */}
            {myPatient.comorbidities.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Comorbidities</h3>
                <div className="flex flex-wrap gap-2">
                  {myPatient.comorbidities.map((c, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Current Medications</h3>
              <div className="space-y-1.5">
                {myPatient.medications.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Doctor/Admin: Charts */}
        {!isPatient && (
          <div className="grid lg:grid-cols-2 gap-4">
            <UrgencyMatrix onSelectPatient={handleSelectPatient} />
            <RiskChart />
          </div>
        )}

        {/* Patient list (doctor/admin) */}
        {!isPatient && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Patients</h2>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                {filters.map((f) => (
                  <button key={f.value} onClick={() => setFilter(f.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filter === f.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((p, i) => (
                <PatientCard key={p.id} patient={p} index={i} onClick={() => handleSelectPatient(p)} />
              ))}
            </div>
          </div>
        )}
      </div>
      <PatientDetailModal patient={selectedPatient} open={modalOpen} onClose={() => setModalOpen(false)} />
    </DashboardLayout>
  );
}
