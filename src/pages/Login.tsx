import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Mail, Lock, Loader2, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type RoleTab = "doctor" | "patient";

const roles = [
  {
    id: "doctor" as const,
    label: "Doctor",
    icon: Stethoscope,
    color: "text-blue-600",
    description: "Access patient records, AI diagnosis & clinical decision tools",
  },
  {
    id: "patient" as const,
    label: "Patient",
    icon: User,
    color: "text-emerald-600",
    description: "View your health records, risk score and AI suggestions",
  },
];

export default function Login() {
  const [activeRole, setActiveRole] = useState<RoleTab>("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const selectedRole = roles.find((r) => r.id === activeRole)!;

  const goToDashboard = (role: RoleTab) => {
    navigate(role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { role: activeRole }, // server trigger reads this
          },
        });
        if (error) throw error;
        toast({
          title: "Account created",
          description: `Signed up as ${activeRole}. You can sign in now.`,
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Pull role from DB (don't trust the tab) and route accordingly
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id);
          const dbRole = roleRows?.[0]?.role as RoleTab | "admin" | undefined;
          if (dbRole === "doctor" || dbRole === "admin") goToDashboard("doctor");
          else goToDashboard("patient");
        }
      }
    } catch (err: any) {
      toast({ title: "Auth error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] bg-sidebar px-10 py-12 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-primary-foreground">MediMind AI</h1>
              <p className="text-[11px] text-sidebar-foreground/50">Predictive Clinical Intelligence</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-sidebar-primary-foreground leading-tight mb-4">
            AI-powered healthcare for modern hospitals
          </h2>
          <p className="text-sm text-sidebar-foreground/60 leading-relaxed mb-10">
            Predict risks, analyze records, and support clinical decisions — powered by Google Gemini.
          </p>
          <div className="space-y-4">
            {[
              "Multi-disease risk prediction",
              "Gemini-powered AI diagnosis",
              "Role-based access (Doctor & Patient)",
              "Secure profiles & records",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
                <span className="text-xs text-sidebar-foreground/60">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-sidebar-foreground/30">MediMind AI · Hackathon MVP</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">MediMind AI</span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight">
              {isSignUp ? "Create your account" : "Sign in to your account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Select your role to continue</p>
          </div>

          {/* Role selector — exactly 2 options */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {roles.map((role) => {
              const Icon = role.icon;
              const isActive = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setActiveRole(role.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? role.color : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className={`font-medium ${selectedRole.color}`}>{selectedRole.label}: </span>
              {selectedRole.description}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 text-sm"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 text-sm"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground border-0"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isSignUp ? `Create ${selectedRole.label} Account` : `Sign In as ${selectedRole.label}`}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-medium hover:underline">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
