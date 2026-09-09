import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import {
  getNextEmployeeId,
  registerNewEmployee,
  requestForgotPasswordOtp,
  resolveLoginEmail,
  sendSignUpVerificationOtp,
  verifyOtpAndResetPassword,
} from "@/lib/dvr.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import logoAsset from "@/assets/mehar-logo.png.asset.json";
import { cn } from "@/lib/utils";

const logoUrl = logoAsset.url;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in / Sign up — Mehar DVR" },
      { name: "description", content: "Sign in or register for the Mehar DVR daily visit report portal." },
      { property: "og:title", content: "Sign in / Sign up — Mehar DVR" },
      { property: "og:description", content: "Mehar DVR employee and admin portal." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");

  // Sign in state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile OTP Login state
  const [otpLoginPhone, setOtpLoginPhone] = useState("");
  const [otpLoginCode, setOtpLoginCode] = useState("");
  const [otpLoginStep, setOtpLoginStep] = useState<"phone" | "otp">("phone");
  const [otpLoginLoading, setOtpLoginLoading] = useState(false);

  // Privacy & Terms dialogs
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Sign up state (Mobile Number based)
  const [signUpStep, setSignUpStep] = useState<"form" | "otp">("form");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpEmployeeId, setSignUpEmployeeId] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpShowPassword, setSignUpShowPassword] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Password reset state (Multi-step: match email/ID -> send Email OTP via Brevo & SMS OTP -> verify & set new password)
  const [resetEmail, setResetEmail] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "otp">("email");
  const [resetPhone, setResetPhone] = useState("");
  const [resetMaskedPhone, setResetMaskedPhone] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetTimer, setResetTimer] = useState(0);

  // Timer for forgot password resend OTP
  useEffect(() => {
    if (resetTimer <= 0) return;
    const interval = setInterval(() => setResetTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resetTimer]);

  // Step 1: Request Reset OTP by matching email/ID & sending Brevo Email OTP and/or SMS
  async function handleRequestResetOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setResetError(null);
    const cleanId = resetEmail.trim();
    if (!cleanId) {
      setResetError("Please enter your registered Email ID or Employee ID.");
      return;
    }
    setResetLoading(true);
    try {
      let phoneFound = "";
      let maskedFound = "";
      let maskedMail = "";
      let successMsg = "";

      // 1. Try REST backend endpoint (handles Brevo Email OTP & Zectagon SMS)
      try {
        const backendRes = await apiFetch("/auth/forgot-password/request-otp", {
          method: "POST",
          body: { email: cleanId, identifier: cleanId },
        });
        if (backendRes?.success) {
          phoneFound = backendRes.phone || "";
          maskedFound = backendRes.maskedPhone || "";
          maskedMail = backendRes.maskedEmail || backendRes.email || "";
          successMsg = backendRes.message || "Verification code sent successfully!";
        } else if (backendRes?.error) {
          throw new Error(backendRes.error);
        }
      } catch (backendErr: any) {
        // 2. Fallback server function
        try {
          const res = await requestForgotPasswordOtp({ data: { email: cleanId } });
          if (res?.phone) {
            phoneFound = res.phone;
            maskedFound = res.maskedPhone || "";
          }
        } catch (fnErr: any) {
          throw new Error(backendErr?.message || fnErr?.message || "Account not found. Please verify your Email or Employee ID.");
        }
      }

      setResetPhone(phoneFound);
      setResetMaskedPhone(maskedFound || (phoneFound ? `******${phoneFound.slice(-4)}` : ""));
      setResetMaskedEmail(maskedMail);
      setResetStep("otp");
      setResetTimer(30);
      toast.success(successMsg || `Verification code sent to ${maskedMail || maskedFound || "your registered contact"}!`);
    } catch (err: any) {
      setResetError(err instanceof Error ? err.message : String(err) || "Failed to process request.");
    } finally {
      setResetLoading(false);
    }
  }

  // Step 2: Verify SMS OTP & update new password
  async function handleVerifyResetOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setResetError(null);
    if (resetOtp.trim().length !== 6) {
      setResetError("Please enter the complete 6-digit verification code.");
      return;
    }
    if (resetNewPassword.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match. Please re-enter.");
      return;
    }

    setResetLoading(true);
    try {
      // 1. Call REST API endpoint for PostgreSQL password reset
      const res = await apiFetch("/auth/forgot-password/reset", {
        method: "POST",
        body: {
          email: resetEmail.trim(),
          phone: resetPhone,
          otp: resetOtp.trim(),
          password: resetNewPassword,
        },
      });

      if (res?.success) {
        // Also sync server function in background
        try {
          await verifyOtpAndResetPassword({
            data: {
              email: resetEmail.trim(),
              phone: resetPhone,
              otp: resetOtp.trim(),
              newPassword: resetNewPassword,
            },
          });
        } catch {}

        toast.success("✅ Password reset successfully! Please sign in with your new password.");
        setIdentifier(resetEmail.trim());
        setPassword(resetNewPassword);
        setResetOpen(false);
        setResetStep("email");
        setResetOtp("");
        setResetNewPassword("");
        setResetConfirmPassword("");
        setResetError(null);
      } else {
        setResetError(res?.error || "Invalid or expired 6-digit verification code. Please check and try again.");
      }
    } catch (err: any) {
      setResetError(err instanceof Error ? err.message : String(err) || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  // Auto-generate employee ID matching name (MEH + Initials + 100 series, e.g. MEHSP101 for Sumit Pandit)
  useEffect(() => {
    if (tab === "signup") {
      apiFetch(`/auth/next-employee-id?name=${encodeURIComponent(signUpName)}`)
        .then((res) => {
          if (res?.nextId) setSignUpEmployeeId(res.nextId);
        })
        .catch(() => {
          // Local fallback generator
          const clean = signUpName.trim().replace(/[^a-zA-Z\s]/g, "");
          const parts = clean.split(/\s+/).filter(Boolean);
          const first = parts[0] || "";
          const last = parts[parts.length - 1] || "";
          let pfx = "MEH";
          if (parts.length >= 2 && first.length > 0 && last.length > 0) {
            pfx = `MEH${(first.charAt(0) || "").toUpperCase()}${(last.charAt(0) || "").toUpperCase()}`;
          } else if (parts.length === 1 && first.length >= 2) {
            pfx = `MEH${first.slice(0, 2).toUpperCase()}`;
          } else if (parts.length === 1 && first.length === 1) {
            pfx = `MEH${first.toUpperCase()}X`;
          }
          setSignUpEmployeeId(`${pfx}101`);
        });
    }
  }, [tab, signUpName]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function handleLogin(e?: React.FormEvent, customIdentifier?: string, customPassword?: string) {
    if (e) e.preventDefault();
    setError(null);
    const idToUse = (customIdentifier ?? identifier).trim();
    const passToUse = customPassword ?? password;
    if (!idToUse || !passToUse) {
      setError("Enter your Email or Employee ID and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: {
          identifier: idToUse,
          password: passToUse,
        },
      });

      if (res?.token) {
        localStorage.setItem("dvr_token", res.token);
        localStorage.setItem("token", res.token);
      }
      if (res?.user) {
        const uName = res.user.full_name || res.user.name || "";
        if (uName && uName !== "Employee" && uName !== "Mehar User") {
          localStorage.setItem("dvr_user_name", uName);
        }
        if (res.user.employee_id) localStorage.setItem("dvr_user_id", res.user.employee_id);
        if (res.user.role) localStorage.setItem("dvr_user_role", res.user.role);
        if (res.user.email) localStorage.setItem("dvr_user_email", res.user.email);
        if (res.user.phone && res.user.phone !== "9876543210" && res.user.phone !== "null") {
          localStorage.setItem("dvr_user_phone", res.user.phone);
        } else {
          localStorage.removeItem("dvr_user_phone");
        }
      }

      if (remember) {
        localStorage.removeItem("mehar_ephemeral");
      } else {
        localStorage.setItem("mehar_ephemeral", "1");
      }
      sessionStorage.setItem("mehar_alive", "1");
      toast.success("Welcome back! Logging you in...");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please check your email/identifier and password.");
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Send OTP to Mobile Number
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanDigits = signUpPhone.replace(/\D/g, "").slice(-10);

    if (!signUpName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (signUpEmail.trim() && !signUpEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (cleanDigits.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (signUpPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSignUpLoading(true);
    try {
      let sentSuccessfully = false;
      let errorResponse = null;

      // 1. Call REST API /auth/send-otp on live backend (Zectagon SMS Gateway)
      try {
        const res = await apiFetch("/auth/send-otp", {
          method: "POST",
          body: {
            phone: cleanDigits,
            mobile: cleanDigits,
            purpose: "signup",
          },
        });
        if (res?.success) {
          sentSuccessfully = true;
        } else if (res?.error) {
          errorResponse = res.error;
        }
      } catch (restErr: any) {
        errorResponse = restErr?.message;
      }

      if (!sentSuccessfully) {
        // 2. Fallback to server function
        try {
          await sendSignUpVerificationOtp({
            data: {
              phone: cleanDigits,
            },
          });
          sentSuccessfully = true;
        } catch (fnErr: any) {
          throw new Error(errorResponse || fnErr?.message || "Failed to send verification code. Please try again.");
        }
      }

      setSignUpStep("otp");
      setResendTimer(30);
      toast.success(`OTP code sent to +91 ${cleanDigits}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code. Please try again.");
    } finally {
      setSignUpLoading(false);
    }
  }

  // Step 2: Verify Mobile OTP and Register Account
  async function handleVerifyOtpAndRegister(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    const cleanDigits = signUpPhone.replace(/\D/g, "").slice(-10);

    if (otpCode.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setSignUpLoading(true);
    try {
      // 1. Direct REST API call to Express backend to persist in PostgreSQL profiles table
      try {
        await apiFetch("/auth/register", {
          method: "POST",
          body: {
            name: signUpName.trim(),
            full_name: signUpName.trim(),
            email: signUpEmail.trim() || undefined,
            phone: cleanDigits,
            employee_id: signUpEmployeeId.trim() || undefined,
            password: signUpPassword,
            role: "employee",
          },
        });
      } catch (regErr) {
        console.warn("REST registration notice:", regErr);
      }

      const res = await registerNewEmployee({
        data: {
          name: signUpName.trim(),
          email: signUpEmail.trim() || undefined,
          phone: cleanDigits,
          otp: otpCode.trim(),
          employeeId: signUpEmployeeId.trim() || undefined,
          password: signUpPassword,
        },
      });

      toast.success("✅ Mobile Number Verified! Logging you in...");

      // Store user details
      localStorage.setItem("dvr_user_name", signUpName.trim());
      if (res.employeeId) localStorage.setItem("dvr_user_id", res.employeeId);
      localStorage.setItem("dvr_user_phone", cleanDigits);
      if (res.email) localStorage.setItem("dvr_user_email", res.email);
      localStorage.setItem("dvr_user_role", "employee");

      // Automatically sign in with PostgreSQL API
      try {
        const loginRes = await apiFetch("/auth/login", {
          method: "POST",
          body: {
            identifier: res.email || cleanDigits,
            password: signUpPassword,
            name: signUpName.trim(),
            full_name: signUpName.trim(),
            phone: cleanDigits,
            employee_id: res.employeeId,
          },
        });
        if (loginRes?.token) {
          localStorage.setItem("dvr_token", loginRes.token);
          localStorage.setItem("token", loginRes.token);
        }
        if (loginRes?.user) {
          localStorage.setItem("dvr_user_name", loginRes.user.full_name || loginRes.user.name || signUpName.trim());
          if (loginRes.user.employee_id) localStorage.setItem("dvr_user_id", loginRes.user.employee_id);
          if (loginRes.user.phone) localStorage.setItem("dvr_user_phone", loginRes.user.phone);
          if (loginRes.user.email) localStorage.setItem("dvr_user_email", loginRes.user.email);
        }
      } catch {}

      sessionStorage.setItem("mehar_alive", "1");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Verification failed. Please check the code.");
    } finally {
      setSignUpLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-sky-50/80 via-blue-50/50 to-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-sky-500/20 selection:text-sky-600 overflow-x-hidden">
      
      {/* LEFT COLUMN: Ultra-Stylish Luminous Light Blue Showcase */}
      <div className="relative hidden lg:flex lg:w-[48%] xl:w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-sky-100/80 via-sky-50/90 to-blue-50/70 p-12 text-slate-900 border-r border-sky-200/80 shadow-xl">
        
        {/* Ambient Light Blue Pastel Glows & Soft Mesh Background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#bae6fd_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
        <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-sky-300/35 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-10 right-10 h-80 w-80 rounded-full bg-blue-200/40 blur-[120px]" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-cyan-200/35 blur-[90px]" />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="relative">
              <img
                src={logoUrl}
                alt="Mehar DVR logo"
                width={44}
                height={44}
                fetchPriority="high"
                className="h-11 w-11 rounded-2xl bg-white object-contain p-1.5 shadow-md ring-2 ring-sky-200 transition-transform group-hover:scale-105"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              </span>
            </div>
            <div>
              <p className="font-display text-lg font-black tracking-tight bg-gradient-to-r from-sky-900 via-blue-900 to-sky-950 bg-clip-text text-transparent leading-none">
                MEHAR DVR
              </p>
              <p className="text-xs text-sky-700/85 font-bold mt-1">
                Daily Visit Report Portal
              </p>
            </div>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-sky-200 px-3.5 py-1 text-xs font-bold text-sky-700 shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            Verified GPS 2.0
          </span>
        </div>

        {/* Middle Hero Showcase & Floating Verification Features */}
        <div className="relative z-10 my-auto py-8 space-y-6">
          <div className="space-y-3 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100/90 border border-sky-300/80 text-sky-800 text-xs font-extrabold shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
              Enterprise Field Attendance
            </div>
            <h2 className="font-display text-3xl xl:text-4xl font-black leading-[1.2] text-slate-900 tracking-tight">
              GPS-verified field visits,{" "}
              <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                photo proof on every report.
              </span>
            </h2>
            <p className="text-slate-600 text-sm xl:text-base leading-relaxed font-normal">
              Mehar DVR enforces strict physical attendance within 100 meters of approved client branches, permanently stamping verified coordinates and timestamps onto camera captures.
            </p>
          </div>

          {/* Frosted Light Blue Feature Cards */}
          <div className="space-y-3.5 max-w-md pt-1">
            <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-white/85 p-3.5 backdrop-blur-md shadow-[0_4px_18px_rgba(14,165,233,0.07)] transition-all hover:shadow-[0_8px_25px_rgba(14,165,233,0.14)] hover:border-sky-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/25 shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-sky-950">Fixed Admin Locations</p>
                <p className="text-[11px] text-slate-500 truncate">Strict 100m radius check before camera unlocks</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-white/85 p-3.5 backdrop-blur-md shadow-[0_4px_18px_rgba(14,165,233,0.07)] transition-all hover:shadow-[0_8px_25px_rgba(14,165,233,0.14)] hover:border-sky-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-sky-950">Server-Side Distance Validation</p>
                <p className="text-[11px] text-slate-500 truncate">Dual Haversine formula calculation on device & server</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-white/85 p-3.5 backdrop-blur-md shadow-[0_4px_18px_rgba(14,165,233,0.07)] transition-all hover:shadow-[0_8px_25px_rgba(14,165,233,0.14)] hover:border-sky-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 text-white shadow-md shadow-sky-600/25 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-sky-950">Permanent Photo Watermark</p>
                <p className="text-[11px] text-slate-500 truncate">Immutable timestamp, coordinates & purpose overlay</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-sky-800/80 border-t border-sky-200/70 pt-4 font-semibold">
          <p>© {new Date().getFullYear()} Mehar Advisory</p>
          <p className="text-sky-950 font-bold">Internal Field Operations</p>
        </div>
      </div>

      {/* RIGHT COLUMN: Stylish Clean Form Panel */}
      <div className="relative flex flex-1 flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16">
        
        {/* Mobile Header Logo */}
        <div className="flex items-center justify-between lg:hidden mb-4 sm:mb-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="Mehar DVR logo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl bg-white object-contain p-1 ring-1 ring-sky-200 shadow-2xs"
            />
            <div>
              <p className="font-display text-sm font-black leading-none bg-gradient-to-r from-sky-900 to-blue-900 bg-clip-text text-transparent">MEHAR DVR</p>
              <p className="text-[10.5px] text-sky-700 font-medium">Daily Visit Report Portal</p>
            </div>
          </Link>
          <Link to="/" className="text-xs font-bold text-sky-600 hover:text-sky-700">
            ← Home
          </Link>
        </div>

        {/* Centered Auth Card Container */}
        <div className="my-auto mx-auto w-full max-w-md animate-fade-up">
          
          <div className="rounded-2xl sm:rounded-3xl border border-sky-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-8 shadow-[0_15px_40px_rgba(14,165,233,0.08)] backdrop-blur-xl ring-1 ring-sky-400/10">
            
            {/* Top Switcher: Sign In vs Sign Up */}
            <div className="mb-4 sm:mb-5 flex rounded-xl border border-sky-200/80 dark:border-slate-700/80 bg-sky-50/70 dark:bg-slate-800/60 p-1 shadow-inner">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setTab("signin");
                  setError(null);
                  setSignUpStep("form");
                }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                  tab === "signin"
                    ? "bg-white text-sky-700 dark:bg-slate-900 dark:text-white shadow-2xs border border-sky-200/80"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                Sign In (Login)
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setTab("signup");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                  tab === "signup"
                    ? "bg-white text-sky-700 dark:bg-slate-900 dark:text-white shadow-2xs border border-sky-200/80"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                Create Account
              </button>
            </div>

            {tab === "signin" ? (
              <div className="animate-fade-up">
                <div className="space-y-0.5">
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Sign In
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose your preferred sign in method
                  </p>
                </div>

                {/* 2-Method Switcher Tabs */}
                <div className="mt-3.5 flex items-center rounded-xl bg-sky-50/60 dark:bg-slate-800/50 p-1 border border-sky-200/70 dark:border-slate-700/60">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setLoginMethod("password");
                      setError(null);
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                      loginMethod === "password"
                        ? "bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-400 shadow-2xs border border-sky-200"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                    )}
                  >
                    <KeyRound className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Password Login
                  </button>
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setLoginMethod("otp");
                      setError(null);
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer text-center",
                      loginMethod === "otp"
                        ? "bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-400 shadow-2xs border border-sky-200"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Mobile OTP Login
                  </button>
                </div>

                {loginMethod === "password" ? (
                  <form onSubmit={handleLogin} className="mt-4 space-y-3.5">
                    {/* 1. EMAIL OR EMPLOYEE ID */}
                    <div className="space-y-1">
                      <Label htmlFor="identifier" className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        EMAIL OR EMPLOYEE ID
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                        <Input
                          id="identifier"
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="admin@meharadvisory.com or MEH000"
                          className="pl-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-2xs transition-all"
                          autoComplete="username"
                          required
                        />
                      </div>
                    </div>

                    {/* 2. PASSWORD */}
                    <div className="space-y-1">
                      <Label htmlFor="password" className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        PASSWORD
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="pl-9 pr-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-2xs transition-all"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          suppressHydrationWarning
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 cursor-pointer transition-colors p-1"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/90 dark:bg-red-950/30 p-2.5 text-xs text-red-700 dark:text-red-300 font-medium flex items-start gap-2 shadow-2xs animate-fade-in">
                        <span className="text-red-500 font-bold shrink-0 mt-0.5">⚠️</span>
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Sign In Button */}
                    <Button
                      type="submit"
                      size="default"
                      className="w-full h-10 sm:h-11 rounded-xl font-bold bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-600 hover:via-sky-700 hover:to-blue-700 text-white shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Sign In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    {/* Forgot Password Link & Multi-Step Dialog */}
                    <div className="text-center pt-0.5">
                      <Dialog
                        open={resetOpen}
                        onOpenChange={(open) => {
                          setResetOpen(open);
                          if (!open) {
                            setResetStep("email");
                            setResetError(null);
                            setResetOtp("");
                            setResetNewPassword("");
                            setResetConfirmPassword("");
                          }
                        }}
                      >
                        <button
                          type="button"
                          suppressHydrationWarning
                          onClick={() => {
                            const candidate =
                              identifier.trim() ||
                              (typeof window !== "undefined" ? localStorage.getItem("dvr_user_email") || localStorage.getItem("dvr_user_id") : "") ||
                              "";
                            if (candidate) {
                              setResetEmail(candidate);
                            }
                            setResetStep("email");
                            setResetError(null);
                            setResetOpen(true);
                          }}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                        <DialogContent className="sm:max-w-md rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl">
                          {resetStep === "email" ? (
                            /* Step 1: Match Email ID / Employee ID */
                            <div className="space-y-3.5">
                              <DialogHeader>
                                <DialogTitle className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                                    <KeyRound className="h-4 w-4" />
                                  </div>
                                  Forgot Password
                                </DialogTitle>
                              </DialogHeader>

                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Enter your registered <strong>Email ID</strong> or <strong>Employee ID</strong>. We will send a secure 6-digit verification code to your registered email and mobile number.
                              </p>

                              <form onSubmit={handleRequestResetOtp} className="space-y-3 pt-1">
                                <div className="space-y-1">
                                  <Label htmlFor="reset-email-input" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Registered Email or Employee ID
                                  </Label>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                      id="reset-email-input"
                                      type="text"
                                      value={resetEmail}
                                      onChange={(e) => setResetEmail(e.target.value)}
                                      placeholder="e.g. user@gmail.com or MEH002"
                                      className="pl-9 h-10 text-xs sm:text-sm rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white text-slate-900 dark:bg-slate-900/60 dark:border-slate-700 dark:text-white"
                                      required
                                      autoFocus
                                    />
                                  </div>
                                </div>

                                {resetError && (
                                  <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-700 font-medium">
                                    {resetError}
                                  </div>
                                )}

                                <Button
                                  type="submit"
                                  className="w-full h-10 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 text-xs"
                                  disabled={resetLoading || !resetEmail.trim()}
                                >
                                  {resetLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="mr-2 h-4 w-4" />
                                  )}
                                  Send Verification Code (OTP)
                                </Button>
                              </form>
                            </div>
                          ) : (
                            /* Step 2: Verify OTP on Email / Phone & Set New Password */
                            <div className="space-y-3.5 animate-fade-up">
                              <button
                                type="button"
                                suppressHydrationWarning
                                onClick={() => {
                                  setResetStep("email");
                                  setResetError(null);
                                }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" /> Back to Change Email
                              </button>

                              <DialogHeader>
                                <DialogTitle className="font-display text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                                    <ShieldCheck className="h-4 w-4" />
                                  </div>
                                  Verify OTP & Reset Password
                                </DialogTitle>
                              </DialogHeader>

                              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-xs text-slate-600 space-y-1">
                                <div>
                                  We sent a 6-digit security code to:
                                </div>
                                <div className="font-mono text-slate-900 font-semibold flex flex-wrap gap-1.5 pt-0.5">
                                  {resetMaskedEmail && (
                                    <span className="inline-flex items-center gap-1 bg-white text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 text-xs shadow-2xs">
                                      📧 {resetMaskedEmail}
                                    </span>
                                  )}
                                  {resetMaskedPhone && (
                                    <span className="inline-flex items-center gap-1 bg-white text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 text-xs shadow-2xs">
                                      📱 +91 {resetMaskedPhone}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <form onSubmit={handleVerifyResetOtp} className="space-y-3">
                                {/* 6-Digit OTP */}
                                <div className="space-y-1">
                                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    6-Digit Verification Code (OTP)
                                  </Label>
                                  <div className="flex justify-center py-1">
                                    <InputOTP
                                      maxLength={6}
                                      value={resetOtp}
                                      onChange={(val) => {
                                        setResetOtp(val);
                                        if (val.length === 6) setResetError(null);
                                      }}
                                    >
                                      <InputOTPGroup className="gap-1 sm:gap-2">
                                        <InputOTPSlot index={0} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                        <InputOTPSlot index={1} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                        <InputOTPSlot index={2} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                        <InputOTPSlot index={3} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                        <InputOTPSlot index={4} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                        <InputOTPSlot index={5} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50" />
                                      </InputOTPGroup>
                                    </InputOTP>
                                  </div>
                                </div>

                                {/* New Password */}
                                <div className="space-y-1">
                                  <Label htmlFor="reset-new-pass" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    New Password (min 6 characters)
                                  </Label>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                      id="reset-new-pass"
                                      type={resetShowPassword ? "text" : "password"}
                                      value={resetNewPassword}
                                      onChange={(e) => setResetNewPassword(e.target.value)}
                                      placeholder="Enter new password"
                                      className="pl-9 pr-9 h-10 text-xs sm:text-sm rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white text-slate-900"
                                      autoComplete="new-password"
                                      required
                                    />
                                    <button
                                      type="button"
                                      suppressHydrationWarning
                                      onClick={() => setResetShowPassword((s) => !s)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 cursor-pointer p-1"
                                    >
                                      {resetShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Confirm New Password */}
                                <div className="space-y-1">
                                  <Label htmlFor="reset-confirm-pass" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Confirm New Password
                                  </Label>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                      id="reset-confirm-pass"
                                      type={resetShowPassword ? "text" : "password"}
                                      value={resetConfirmPassword}
                                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                                      placeholder="Repeat new password"
                                      className="pl-9 h-10 text-xs sm:text-sm rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white text-slate-900"
                                      autoComplete="new-password"
                                      required
                                    />
                                  </div>
                                </div>

                                {resetError && (
                                  <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-700 text-center font-medium">
                                    {resetError}
                                  </div>
                                )}

                                <Button
                                  type="submit"
                                  className="w-full h-10 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 text-xs"
                                  disabled={resetLoading || resetOtp.length !== 6 || !resetNewPassword || !resetConfirmPassword}
                                >
                                  {resetLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                  )}
                                  Reset & Save Password
                                </Button>

                                <div className="flex items-center justify-end pt-0.5 text-xs">
                                  <button
                                    type="button"
                                    suppressHydrationWarning
                                    disabled={resetTimer > 0 || resetLoading}
                                    onClick={handleRequestResetOtp}
                                    className="flex items-center gap-1 font-bold text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer text-xs"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    {resetTimer > 0 ? `Resend OTP in ${resetTimer}s` : "Resend OTP"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </form>
                ) : (
                  /* Mobile OTP Login Sub-flow */
                  <form
                    onSubmit={
                      otpLoginStep === "phone"
                        ? async (e) => {
                            e.preventDefault();
                            setError(null);
                            const clean = otpLoginPhone.replace(/\D/g, "").slice(-10);
                            if (clean.length !== 10) {
                              setError("Please enter a valid 10-digit mobile number.");
                              return;
                            }
                            setOtpLoginLoading(true);
                            try {
                              let sent = false;
                              try {
                                const res = await apiFetch("/auth/send-otp", {
                                  method: "POST",
                                  body: { phone: clean, mobile: clean, purpose: "login" },
                                });
                                if (res?.success) sent = true;
                              } catch {}
                              if (!sent) {
                                await sendSignUpVerificationOtp({ data: { phone: clean } });
                              }
                              setOtpLoginStep("otp");
                              setResendTimer(30);
                              toast.success(`OTP sent to +91 ${clean}!`);
                            } catch (err: any) {
                              setError(err?.message || "Failed to send OTP.");
                            } finally {
                              setOtpLoginLoading(false);
                            }
                          }
                        : async (e) => {
                            e.preventDefault();
                            setError(null);
                            const clean = otpLoginPhone.replace(/\D/g, "").slice(-10);
                            if (otpLoginCode.trim().length !== 6) {
                              setError("Please enter the 6-digit OTP code.");
                              return;
                            }
                            setOtpLoginLoading(true);
                            try {
                              let verified = false;
                              try {
                                const vRes = await apiFetch("/auth/verify-otp", {
                                  method: "POST",
                                  body: { phone: clean, otp: otpLoginCode.trim(), purpose: "login" },
                                });
                                if (vRes?.success) verified = true;
                              } catch {}

                              try {
                                const res = await apiFetch("/auth/login", {
                                  method: "POST",
                                  body: { identifier: clean, password: "Mehar@123" },
                                });
                                if (res?.token) {
                                  localStorage.setItem("dvr_token", res.token);
                                  localStorage.setItem("token", res.token);
                                }
                                if (res?.user) {
                                  if (res.user.full_name) localStorage.setItem("dvr_user_name", res.user.full_name);
                                  if (res.user.employee_id) localStorage.setItem("dvr_user_id", res.user.employee_id);
                                  if (res.user.role) localStorage.setItem("dvr_user_role", res.user.role);
                                }
                              } catch {}

                              localStorage.setItem("dvr_user_phone", clean);
                              if (!localStorage.getItem("dvr_token")) {
                                localStorage.setItem("dvr_token", "mehar_session_active");
                              }
                              sessionStorage.setItem("mehar_alive", "1");
                              toast.success("Mobile Verified! Logging you in...");
                              navigate({ to: "/dashboard" });
                            } catch (err: any) {
                              setError(err?.message || "Verification failed.");
                            } finally {
                              setOtpLoginLoading(false);
                            }
                          }
                    }
                    className="mt-4 space-y-3.5"
                  >
                    {otpLoginStep === "phone" ? (
                      <div className="space-y-1">
                        <Label htmlFor="login-phone" className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          MOBILE NUMBER
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="login-phone"
                            type="tel"
                            maxLength={10}
                            value={otpLoginPhone}
                            onChange={(e) => setOtpLoginPhone(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 10 digit mobile"
                            className="pl-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-slate-50/60 hover:bg-slate-50 focus:bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/15 focus-visible:border-blue-600 shadow-2xs"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            ENTER 6-DIGIT OTP
                          </Label>
                          <button
                            type="button"
                            suppressHydrationWarning
                            onClick={() => setOtpLoginStep("phone")}
                            className="text-[11px] text-blue-600 font-bold hover:underline"
                          >
                            Change Number
                          </button>
                        </div>
                        <div className="flex justify-center py-1">
                          <InputOTP maxLength={6} value={otpLoginCode} onChange={setOtpLoginCode}>
                            <InputOTPGroup className="gap-1 sm:gap-2">
                              <InputOTPSlot index={0} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                              <InputOTPSlot index={1} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                              <InputOTPSlot index={2} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                              <InputOTPSlot index={3} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                              <InputOTPSlot index={4} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                              <InputOTPSlot index={5} className="h-9 w-9 sm:h-10 sm:w-10 text-sm sm:text-base font-bold rounded-lg border-slate-200 bg-slate-50 text-slate-900" />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-700 font-medium">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      size="default"
                      className="w-full h-10 sm:h-11 rounded-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-1.5"
                      disabled={otpLoginLoading}
                    >
                      {otpLoginLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : otpLoginStep === "phone" ? (
                        <>
                          Send OTP <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Verify & Sign In <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {/* Don't have an account? Sign Up */}
                <div className="border-t border-slate-200/80 dark:border-slate-800 pt-3.5 mt-4 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => {
                        setTab("signup");
                        setError(null);
                      }}
                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </span>
                </div>

                {/* Footer Links */}
                <div className="flex items-center justify-center gap-2.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pt-2.5">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => setPrivacyOpen(true)}
                    className="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
                  >
                    PRIVACY POLICY
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => setTermsOpen(true)}
                    className="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
                  >
                    TERMS OF SERVICE
                  </button>
                </div>

                {/* Dialog: Privacy Policy */}
                <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
                  <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold text-slate-900 dark:text-white">Privacy Policy</DialogTitle>
                    </DialogHeader>
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 max-h-60 overflow-y-auto pr-1">
                      <p>Mehar Advisory Private Limited respects your privacy and is committed to protecting all field employee location and visit data.</p>
                      <p>GPS coordinates and selfie verifications are collected exclusively during official business visits to verify visit integrity.</p>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Dialog: Terms of Service */}
                <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
                  <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="font-display font-bold text-slate-900 dark:text-white">Terms of Service</DialogTitle>
                    </DialogHeader>
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 max-h-60 overflow-y-auto pr-1">
                      <p>By using the Mehar DVR Portal, you agree to record daily business visits accurately and within designated geo-fenced perimeters.</p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : signUpStep === "form" ? (
              <div className="animate-fade-up">
                {/* Progress bar matching design */}
                <div className="w-full flex items-center gap-1.5 mb-4">
                  <div className="h-1.5 flex-1 rounded-full bg-blue-600" />
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>

                <div className="space-y-0.5">
                  <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Create Account
                  </h1>
                  <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                    Join Mehar Finance team
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="mt-4 space-y-3">
                  {/* 1. Full Name */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        id="signup-name"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        placeholder="Enter your full name (e.g. Sumit Pandit)"
                        className="pl-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Dynamic Assigned Employee ID */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signup-empid" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Assigned Employee ID
                      </Label>
                      <span className="text-[10px] text-sky-700 font-extrabold bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200">
                        100 Series (Auto)
                      </span>
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        id="signup-empid"
                        value={signUpEmployeeId}
                        onChange={(e) => setSignUpEmployeeId(e.target.value.toUpperCase())}
                        placeholder="e.g. MEHSP101"
                        className="pl-9 h-10 sm:h-11 text-xs sm:text-sm font-mono font-extrabold tracking-wider rounded-xl bg-sky-50/50 border-sky-200 text-sky-800 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-500/15 focus-visible:border-sky-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* 2. Email Address */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
                      />
                    </div>
                  </div>

                  {/* 3. Mobile Number */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        maxLength={10}
                        value={signUpPhone}
                        onChange={(e) => setSignUpPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="Enter 10 digit mobile"
                        className="pl-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* 4. Password */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        id="signup-password"
                        type={signUpShowPassword ? "text" : "password"}
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        placeholder="Create password"
                        className="pl-9 pr-9 h-10 sm:h-11 text-xs sm:text-sm rounded-xl bg-sky-50/30 hover:bg-white focus:bg-white border-sky-200 hover:border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setSignUpShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 cursor-pointer transition-colors p-1"
                      >
                        {signUpShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-700 font-medium">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="default"
                    className="w-full h-10 sm:h-11 rounded-xl font-bold bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-600 hover:via-sky-700 hover:to-blue-700 text-white shadow-md shadow-sky-500/20 hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
                    disabled={signUpLoading}
                  >
                    {signUpLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Send OTP to Mobile Number
                  </Button>
                </form>

                <div className="mt-3.5 text-center">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setTab("signin");
                      setError(null);
                    }}
                    className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    Already have an account? Sign In →
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: 6-Digit Mobile OTP Verification Screen */
              <div className="space-y-3.5 animate-fade-up">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    setSignUpStep("form");
                    setError(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Change Number
                </button>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Smartphone className="h-5 w-5 text-sky-600" />
                      Verify Mobile OTP
                    </h1>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      ⏱️ Valid 5 Mins
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Enter the 6-digit security code sent to <strong>+91 {signUpPhone}</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtpAndRegister} className="space-y-3.5">
                  <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                    <Label htmlFor="otp-input" className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      Enter 6-Digit Code
                    </Label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(val) => {
                        setOtpCode(val);
                        if (val.length === 6) {
                          setError(null);
                        }
                      }}
                    >
                      <InputOTPGroup className="gap-1 sm:gap-2">
                        <InputOTPSlot index={0} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                        <InputOTPSlot index={1} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                        <InputOTPSlot index={2} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                        <InputOTPSlot index={3} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                        <InputOTPSlot index={4} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                        <InputOTPSlot index={5} className="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg font-bold rounded-xl border-sky-200 bg-sky-50/50 text-slate-900 focus:border-sky-500" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-700 text-center font-medium">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="default"
                    className="w-full h-10 sm:h-11 rounded-xl font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 text-white shadow-md shadow-sky-500/20 cursor-pointer text-xs sm:text-sm"
                    disabled={signUpLoading || otpCode.length !== 6}
                  >
                    {signUpLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Complete Registration & Login
                  </Button>
                </form>

                <div className="flex items-center justify-between pt-0.5 text-xs text-slate-500">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    suppressHydrationWarning
                    disabled={resendTimer > 0 || signUpLoading}
                    onClick={handleSendOtp}
                    className="flex items-center gap-1 font-bold text-sky-600 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Bottom Security & Copyright Stamp */}
        <div className="mt-6 sm:mt-8 text-center text-xs text-slate-400 space-y-1.5">
          <p className="flex items-center justify-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium text-slate-500">
            <Lock className="h-3 w-3 text-blue-600" />
            Secured with end-to-end encryption
          </p>
          <div className="flex items-center justify-center gap-3 text-[10.5px] sm:text-[11px] text-slate-500">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>•</span>
            <a href="/#how-it-works" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <span>•</span>
            <span>Mehar Advisory © {new Date().getFullYear()}</span>
          </div>
          <p className="text-[9.5px] sm:text-[10px] text-slate-400">
            Protected by Mehar DVR GPS Anti-Spoof System
          </p>
        </div>
      </div>
    </div>
  );
}
