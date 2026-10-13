import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, object, rows, str, problem } from "../../shared/api/client";
import { useSession } from "../../shared/auth/session";
import { SchemaForm } from "../../shared/forms/SchemaForm";
import { f, academic } from "../courses/fields";
import { ErrorPanel, Loading } from "../../shared/ui/primitives";
import wordmark from "../../assets/logo-word-black.webp";
import hero from "../../assets/hero.png";
export function Auth({ signup = false }: { signup?: boolean }) {
  const state = useSession((s) => s.state),
    authenticate = useSession((s) => s.authenticate),
    [email, setEmail] = useState(""),
    [role, setRole] = useState(""),
    [otp, setOtp] = useState(false),
    [expiry, setExpiry] = useState(""),
    [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(0);
  const [resendError, setResendError] = useState<unknown>();
  const [resending, setResending] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const choices = useQuery({
    queryKey: ["signup-roles"],
    queryFn: async ({ signal }) =>
      rows(
        object((await request("roles", "GET", undefined, signal, true)).data)
          .roles,
      ),
    enabled: signup,
  });
  if (state === "ready") return <Navigate to="/dashboard" replace />;
  if (state === "onboarding") return <Navigate to="/onboarding" replace />;
  if (state === "restricted") return <Navigate to="/account-status" replace />;
  const fields = otp
    ? [{ ...f("otp", "text", true), label: "Six-digit verification code" }]
    : [
        f("email", "email", true),
        signup
          ? {
              ...f("role", "select", true),
              options: choices.data
                ?.filter((r) =>
                  ["educator", "tutor", "contributor"].includes(str(r.name)),
                )
                .map((r) => ({
                  value: str(r.name),
                  label: str(r.display_name),
                })),
            }
          : f("password", "password", true),
      ];
  return (
    <div className="auth-layout">
      <div className="auth-side">
        <img className="wordmark" src={wordmark} alt="UniVybe" />
        <div>
          <span className="eyebrow">A LITTLE KNOWLEDGE. A BIG DIFFERENCE.</span>
          <h1>
            Create something
            <br />
            that opens doors.
          </h1>
          <p>
            Your space to share knowledge, inspire learners,
            <br />
            and grow the UniVybe community.
          </p>
          <img src={hero} className="auth-hero" alt="" />
        </div>
        <small>Built for creators. Made for possibility.</small>
      </div>
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">UNIVYBE CREATION PORTAL</span>
          <h1>
            {otp
              ? "Check your inbox"
              : signup
                ? "Join the creator community"
                : "Welcome back"}
          </h1>
          <p>
            {otp
              ? `Enter the code sent to ${email}. ${expiry}`
              : signup
                ? "Start with your email and creator role."
                : "Sign in to your calm corner of the workspace."}
          </p>
          {choices.isError && signup ? (
            <ErrorPanel
              error={choices.error}
              retry={() => void choices.refetch()}
            />
          ) : choices.isPending && signup ? (
            <Loading />
          ) : (
            <SchemaForm
              key={otp ? "otp" : signup ? "signup" : "login"}
              fields={fields}
              button={
                otp
                  ? "Verify email"
                  : signup
                    ? "Send verification code"
                    : "Sign in"
              }
              submit={async (values) => {
                if (otp) {
                  const r = await request(
                    "tutor/auth/verify-otp",
                    "POST",
                    { email, role, otp: values.otp },
                    undefined,
                    true,
                  );
                  await authenticate(r.data);
                } else if (signup) {
                  const r = await request("tutor/auth/send-otp", "POST", {
                    email: values.email,
                  });
                  setEmail(str(values.email));
                  setRole(str(values.role));
                  setExpiry(
                    `Code expires in ${str(object(r.data).expiry_minutes)} minutes.`,
                  );
                  setOtp(true);
                } else {
                  const r = await request(
                    "tutor/auth/login",
                    "POST",
                    values,
                    undefined,
                    true,
                  );
                  await authenticate(r.data);
                }
              }}
            />
          )}{" "}
          {resendError !== undefined && <ErrorPanel error={resendError} />}
          {otp && (
            <button
              disabled={resending || now < retryAt}
              onClick={async () => {
                setResending(true);
                setResendError(undefined);
                try {
                  const r = await request(
                    "tutor/auth/send-otp",
                    "POST",
                    { email },
                    undefined,
                    true,
                  );
                  setExpiry(
                    `Code expires in ${str(object(r.data).expiry_minutes)} minutes.`,
                  );
                } catch (e) {
                  const value = problem(e);
                  setResendError(value);
                  if (value.status === 429)
                    setRetryAt(
                      Date.now() + Number(value.retryAfter || 60) * 1000,
                    );
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending
                ? "Sending…"
                : now < retryAt
                  ? `Resend in ${Math.ceil((retryAt - now) / 1000)}s`
                  : "Resend code"}
            </button>
          )}
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to UniVybe?"}{" "}
            <Link to={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Become a creator"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
export function AccountStatus() {
  const session = useSession();
  const cache = useQueryClient();
  if (session.state === "ready") return <Navigate to="/dashboard" replace />;
  if (session.state === "anonymous") return <Navigate to="/login" replace />;
  if (session.state === "onboarding")
    return <Navigate to="/onboarding" replace />;
  return (
    <div className="center-state">
      <img src={wordmark} alt="UniVybe" className="wordmark" />
      <h1>
        {session.state === "unavailable"
          ? "Your session needs a connection"
          : session.state === "booting"
            ? "Checking your session…"
            : `Account ${session.user?.status || "pending"}`}
      </h1>
      <p>
        {session.state === "booting"
          ? "Checking your connection and account access."
          : session.error ||
            "Your account is not yet eligible for the workspace. Complete review or contact your administrator."}
      </p>
      <button
        className="primary"
        disabled={session.state === "booting"}
        onClick={() => void session.bootstrap()}
      >
        {session.state === "booting" ? "Checking…" : "Check account state"}
      </button>
      <button
        onClick={async () => {
          await cache.cancelQueries();
          cache.clear();
          session.clear();
        }}
      >
        Sign out locally
      </button>
    </div>
  );
}
export function Onboarding() {
  const session = useSession(),
    role = session.user?.role.name;
  const fields = [
    f("firstname", "text", true),
    f("lastname", "text", true),
    f("phone", "text", true),
    f("password", "password", true),
    f("password_confirmation", "password", true),
    ...academic
      .filter((x) => !["level", "semester"].includes(x.name))
      .map((x) => ({
        ...x,
        required: x.name === "university_id" && role !== "admin",
      })),
    { ...f("qualification"), required: role !== "admin" },
    ...(["educator", "tutor", "contributor"].includes(role || "")
      ? [
          f("expertise_area", "text", true),
          f("years_experience", "number", true),
          f("bio", "textarea"),
        ]
      : []),
  ];
  if (session.state === "booting") return <Loading />;
  if (session.state === "anonymous") return <Navigate to="/login" replace />;
  if (session.state === "ready") return <Navigate to="/dashboard" replace />;
  if (session.state === "restricted" || session.state === "unavailable")
    return <Navigate to="/account-status" replace />;
  return (
    <div className="onboarding panel">
      <h1>Make yourself at home</h1>
      <p>
        Complete your profile and set your password. Your account then awaits
        administrator approval.
      </p>
      <SchemaForm
        fields={fields}
        validate={(v) =>
          str(v.password).length < 8
            ? "Use a password with at least eight characters."
            : v.password !== v.password_confirmation
              ? "Passwords must match."
              : Boolean(v.faculty_id) !== Boolean(v.department_id)
                ? "Faculty and department must be provided together."
                : undefined
        }
        submit={async (values) => {
          await request("tutor/auth/complete-onboarding", "POST", values);
          await session.bootstrap();
        }}
      />
    </div>
  );
}
