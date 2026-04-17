import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Activity, AlertTriangle, CheckCircle, Stethoscope, User, TrendingUp, Bell, Server } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { patients } from "@/data/mockPatients";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const mockUsers = [
  { id: "u1", name: "Dr. Priya Sharma", email: "priya.sharma@hospital.com", role: "doctor", status: "active", patients: 6 },
  { id: "u2", name: "Dr. Arjun Mehta", email: "arjun.mehta@hospital.com", role: "doctor", status: "active", patients: 4 },
  { id: "u3", name: "Admin Kavya", email: "kavya@hospital.com", role: "admin", status: "active", patients: 0 },
  { id: "u4", name: "Deepak Joshi", email: "deepak.joshi@patient.com", role: "patient", status: "active", patients: 0 },
  { id: "u5", name: "Dr. Anita Rao", email: "anita.rao@hospital.com", role: "doctor", status: "inactive", patients: 2 },
  { id: "u6", name: "Meera Kulkarni", email: "meera.k@patient.com", role: "patient", status: "active", patients: 0 },
];

const clinicalAlerts = [
  { patient: "Rajesh Sharma", id: "P-1001", severity: "critical", condition: "Acute MI", message: "Troponin rising — ICU transfer needed within 2 hours", time: "12 min ago" },
  { patient: "Priya Iyer", id: "P-1008", severity: "critical", condition: "Sub-massive PE", message: "Thrombolysis window closing — decision in 2 hours", time: "28 min ago" },
  { patient: "Mohan Patel", id: "P-1003", severity: "critical", condition: "COPD Exacerbation", message: "Silent hypoxia SpO₂ 86% — ventilator support required", time: "45 min ago" },
  { patient: "Vikram Singh", id: "P-1005", severity: "warning", condition: "AFib with RVR", message: "CHA₂DS₂-VASc 3 — anticoagulation review pending", time: "1 hr ago" },
  { patient: "Arun Nair", id: "P-1007", severity: "warning", condition: "CKD Stage 3a", message: "eGFR declining — risk of Stage 3b within 6 months", time: "2 hr ago" },
];

const systemServices = [
  { name: "Gemini AI Gateway", status: "online" },
  { name: "Database (Supabase)", status: "online" },
  { name: "Risk Prediction Engine", status: "online" },
  { name: "NLP Pipeline", status: "online" },
  { name: "Alert System", status: "online" },
];

const roleColors: Record<string, string> = {
  doctor: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300",
  admin: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
  patient: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300",
};
const roleIcons: Record<string, React.ElementType> = { doctor: Stethoscope, admin: ShieldCheck, patient: User };

const criticalCount = patients.filter((p) => p.riskLevel === "critical").length;
const moderateCount = patients.filter((p) => p.riskLevel === "moderate").length;
const stableCount = patients.filter((p) => p.riskLevel === "stable").length;
const avgRisk = Math.round(patients.reduce((s, p) => s + p.riskScore, 0) / patients.length);
const alertCriticalCount = clinicalAlerts.filter((a) => a.severity === "critical").length;

export default function AdminPanel() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "alerts">("overview");

  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Hospital-wide oversight, alerts & user management</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-xs font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300">
            <ShieldCheck className="w-3 h-3" />
            Admin View
          </div>
        </motion.div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
          {(["overview", "alerts", "users"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all flex items-center gap-1.5 ${activeTab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
              {t === "alerts" && alertCriticalCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">{alertCriticalCount}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total patients", value: patients.length, icon: Users, color: "text-primary" },
                { label: "Critical", value: criticalCount, icon: AlertTriangle, color: "text-destructive" },
                { label: "Moderate", value: moderateCount, icon: Activity, color: "text-orange-500" },
                { label: "Avg risk score", value: `${avgRisk}%`, icon: TrendingUp, color: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Patient risk distribution</h3>
              <div className="space-y-3">
                {[
                  { label: "Critical", count: criticalCount, color: "bg-destructive", pct: Math.round((criticalCount / patients.length) * 100) },
                  { label: "Moderate", count: moderateCount, color: "bg-orange-500", pct: Math.round((moderateCount / patients.length) * 100) },
                  { label: "Stable", count: stableCount, color: "bg-emerald-500", pct: Math.round((stableCount / patients.length) * 100) },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${r.color}`} />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{r.count} ({r.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Patients by department</h3>
                <div className="space-y-2">
                  {Object.entries(
                    patients.reduce((acc, p) => { acc[p.department] = (acc[p.department] || 0) + 1; return acc; }, {} as Record<string, number>)
                  ).map(([dept, count]) => (
                    <div key={dept} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <span className="text-xs text-muted-foreground truncate">{dept}</span>
                      <span className="text-xs font-semibold ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Status */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">System Status</h3>
                </div>
                <div className="space-y-2">
                  {systemServices.map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                      <span className="text-xs text-muted-foreground">{svc.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-medium text-emerald-500 capitalize">{svc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "alerts" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-destructive" />
                  <h3 className="text-sm font-semibold">Active Clinical Alerts</h3>
                </div>
                <span className="text-xs text-muted-foreground">{clinicalAlerts.length} active</span>
              </div>
              <div className="divide-y divide-border">
                {clinicalAlerts.map((alert) => (
                  <div key={alert.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          alert.severity === "critical"
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                        }`}>{alert.severity}</span>
                        <span className="text-sm font-semibold">{alert.patient}</span>
                        <span className="text-[10px] text-muted-foreground">({alert.id})</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{alert.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{alert.condition}</span> — {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">System users</h3>
                <span className="text-xs text-muted-foreground">{mockUsers.length} total</span>
              </div>
              <div className="divide-y divide-border">
                {mockUsers.map((u) => {
                  const RoleIcon = roleIcons[u.role];
                  return (
                    <div key={u.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <RoleIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {u.role === "doctor" && (
                          <span className="text-xs text-muted-foreground hidden sm:block">{u.patients} patients</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${roleColors[u.role]}`}>{u.role}</span>
                        <span className={`flex items-center gap-1 text-xs ${u.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                          {u.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
