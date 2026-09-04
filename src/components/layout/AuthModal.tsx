import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../utils/authStore';
type View = 'login' | 'signup' | 'forgot';
type LoginMethod = 'phone' | 'email';
type ForgotMethod = 'phone' | 'email';
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelCls =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400';
const emailOk = (v: string): boolean => /^\S+@\S+\.\S+$/.test(v.trim());
const phoneOk = (v: string): boolean => v.replace(/\D/g, '').length === 10;
const cleanPhone = (v: string): string => v.replace(/\D/g, '').slice(-10);
/* ------------------------------- OTP boxes ------------------------------- */
const OtpBoxes: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  const setDigit = (idx: number, ch: string) => {
    const digits = value.padEnd(6, ' ').split('');
    digits[idx] = ch ? ch.replace(/\D/g, '').slice(-1) : ' ';
    const next = digits.join('').replace(/\s/g, '');
    onChange(next.slice(0, 6));
    if (ch && idx < 5) refs.current[idx + 1]?.focus();
  };
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const digits = value.split('');
      if (digits[idx]) {
        digits.splice(idx, 1);
        onChange(digits.join(''));
      } else if (idx > 0) {
        digits.splice(idx - 1, 1);
        onChange(digits.join(''));
        refs.current[idx - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) refs.current[idx + 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(5, Math.max(0, pasted.length - 1))]?.focus();
  };
  return (
    <div className="flex justify-between gap-2">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => setDigit(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          aria-label={`OTP digit ${i + 1}`}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white text-center text-lg font-extrabold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      ))}
    </div>
  );
};
/* ------------------------------- password field ------------------------------- */
const PasswordField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showStrength?: boolean;
}> = ({ value, onChange, placeholder = '••••••••', showStrength }) => {
  const [show, setShow] = useState(false);
  const strength =
    value.length >= 10
      ? { label: 'Strong', cls: 'text-emerald-600' }
      : value.length >= 8
      ? { label: 'Good', cls: 'text-sky-600' }
      : value.length >= 6
      ? { label: 'Weak', cls: 'text-amber-500' }
      : null;
  return (
    <div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} pr-12`}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-400 transition hover:text-slate-600"
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      {showStrength && value.length > 0 && strength && (
        <p className={`mt-1 text-[11px] font-bold ${strength.cls}`}>
          Password strength: {strength.label}
        </p>
      )}
    </div>
  );
};
/* --------------------------------- the modal --------------------------------- */
interface Props {
  open: boolean;
  onClose: () => void;
}
const AuthModal: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const {
    signup: storeSignup,
    loginWithEmail: storeLoginWithEmail,
    sendOtp: storeSendOtp,
    verifyOtpLogin: storeVerifyOtpLogin,
    forgotPasswordPhone: storeForgotPasswordPhone,
    verifyResetOtp: storeVerifyResetOtp,
    resetPassword: storeResetPassword,
    forgotPasswordEmail: storeForgotPasswordEmail,
  } = useAuthStore();
  const [view, setView] = useState<View>('login');
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  /* login state */
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /* signup state */
  const [suFirst, setSuFirst] = useState('');
  const [suLast, setSuLast] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suTerms, setSuTerms] = useState(false);
  /* forgot state */
  const [fpMethod, setFpMethod] = useState<ForgotMethod>('phone');
  const [fpPhone, setFpPhone] = useState('');
  const [fpStep, setFpStep] = useState<'input' | 'otp' | 'newpass'>('input');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpEmail, setFpEmail] = useState('');
  const [fpEmailSent, setFpEmailSent] = useState(false);
  const [fpResetToken, setFpResetToken] = useState<string>('');
  /* scroll lock + escape */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  /* reset when reopened */
  useEffect(() => {
    if (open) {
      setView('login');
      setNotice(null);
      setErrors([]);
      setSuccess(null);
      setLoginMethod('phone');
      setOtpSent(false);
      setOtp('');
      setFpStep('input');
      setFpEmailSent(false);
      setFpResetToken('');
    }
  }, [open]);
  /* resend countdown */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);
  /* auto close after success */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => onClose(), 1800);
    return () => clearTimeout(t);
  }, [success, onClose]);
  if (!open) return null;
  const switchView = (v: View) => {
    setView(v);
    setErrors([]);
    setNotice(null);
  };
  const finish = (msg: string) => {
    setSuccess(msg);
  };
  const formatPhone = (raw: string) => `+91 ${cleanPhone(raw)}`;
  const redirectBasedOnRole = (role?: string) => {
    if (role === 'supplier') {
      navigate('/supplier/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/dashboard');
    } else if (role === 'delivery') {
      navigate('/delivery/dashboard');
    } else {
      // Default to customer dashboard for 'user' role
      navigate('/customer/dashboard');
    }
  };
  /* ------------------------------- actions ------------------------------- */
  const sendOtp = async () => {
    setErrors([]);
    setBusy(true);
    try {
      await storeSendOtp(formatPhone(phone), 'login');
      setOtpSent(true);
      setOtp('');
      setResendIn(30);
    } catch (err: any) {
      setErrors([err?.message || 'Failed to send OTP']);
    } finally {
      setBusy(false);
    }
  };
  const doPhoneLogin = async () => {
    const errs: string[] = [];
    if (!phoneOk(phone)) errs.push('Enter a valid 10-digit mobile number.');
    if (otp.replace(/\D/g, '').length !== 6) errs.push('Enter the 6-digit OTP.');
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await storeVerifyOtpLogin(formatPhone(phone), otp.trim());
      finish('Welcome back! You are logged in.');
      const role = useAuthStore.getState().user?.role;
      redirectBasedOnRole(role);
    } catch (err: any) {
      setErrors([err?.message || 'Verification failed']);
    } finally {
      setBusy(false);
    }
  };
  const doEmailLogin = async () => {
    const errs: string[] = [];
    if (!emailOk(email)) errs.push('Enter a valid email address.');
    if (password.length < 6) errs.push('Password must be at least 6 characters.');
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await storeLoginWithEmail(email.trim(), password);
      finish('Welcome back! You are logged in.');
      const role = useAuthStore.getState().user?.role;
      redirectBasedOnRole(role);
    } catch (err: any) {
      setErrors([err?.message || 'Login failed']);
    } finally {
      setBusy(false);
    }
  };
  const doSignup = async () => {
    const errs: string[] = [];
    if (!suFirst.trim()) errs.push('First name is required.');
    if (!suLast.trim()) errs.push('Last name is required.');
    if (!emailOk(suEmail)) errs.push('Enter a valid email address.');
    if (!phoneOk(suPhone)) errs.push('Enter a valid 10-digit mobile number.');
    if (suPass.length < 6) errs.push('Password must be at least 6 characters.');
    if (!suTerms) errs.push('Please accept the Terms & Privacy Policy.');
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await storeSignup({
        firstName: suFirst.trim(),
        lastName: suLast.trim(),
        email: suEmail.trim(),
        phone: formatPhone(suPhone),
        password: suPass,
        role: 'user', // Automatically assign customer role
      });
      finish(`Account created — welcome, ${suFirst.trim()}!`);
      const role = useAuthStore.getState().user?.role;
      redirectBasedOnRole(role);
    } catch (err: any) {
      setErrors([err?.message || 'Signup failed']);
    } finally {
      setBusy(false);
    }
  };
  const doFpPhone = async () => {
    const errs: string[] = [];
    if (fpStep === 'input' && !phoneOk(fpPhone))
      errs.push('Enter a valid 10-digit mobile number.');
    if (fpStep === 'otp' && fpOtp.length !== 6) errs.push('Enter the 6-digit OTP.');
    if (fpStep === 'newpass' && fpNewPass.length < 6)
      errs.push('New password must be at least 6 characters.');
    setErrors(errs);
    if (errs.length) return;
    if (fpStep === 'input') {
      setBusy(true);
      try {
        await storeForgotPasswordPhone(formatPhone(fpPhone));
        setFpStep('otp');
        setFpOtp('');
        setResendIn(30);
      } catch (err: any) {
        setErrors([err?.message || 'Failed to send OTP']);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (fpStep === 'otp') {
      setBusy(true);
      try {
        const token = await storeVerifyResetOtp(formatPhone(fpPhone), fpOtp.trim());
        setFpResetToken(token);
        setFpStep('newpass');
      } catch (err: any) {
        setErrors([err?.message || 'Invalid or expired OTP']);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await storeResetPassword(fpResetToken, fpNewPass);
      switchView('login');
      setLoginMethod('phone');
      setNotice('✅ Password reset successfully — please login with your new password.');
    } catch (err: any) {
      setErrors([err?.message || 'Failed to reset password']);
    } finally {
      setBusy(false);
    }
  };
  const doFpEmail = async () => {
    if (!emailOk(fpEmail)) {
      setErrors(['Enter a valid email address.']);
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      await storeForgotPasswordEmail(fpEmail.trim());
      setFpEmailSent(true);
    } catch (err: any) {
      setErrors([err?.message || 'Failed to send reset email']);
    } finally {
      setBusy(false);
    }
  };
  /* --------------------------------- render --------------------------------- */
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-fade-in relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-lg text-white shadow-md shadow-blue-200">
              💧
            </span>
            <div>
              <h3 className="text-base font-extrabold leading-tight text-slate-900">
                {view === 'login'
                  ? 'Welcome back'
                  : view === 'signup'
                  ? 'Create your account'
                  : 'Reset password'}
              </h3>
              <p className="text-[11px] text-slate-400">WaterMarket</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* success screen */}
          {success ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                ✅
              </div>
              <p className="mt-4 text-lg font-extrabold text-slate-900">{success}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600"
              >
                Continue
              </button>
            </div>
          ) : (
            <>
              {/* inline notices / errors */}
              {notice && (
                <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
                  {notice}
                </p>
              )}
              {errors.length > 0 && (
                <ul className="mb-4 list-inside list-disc rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600">
                  {errors.map(e => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              {/* ================================ LOGIN ================================ */}
              {view === 'login' && (
                <div className="space-y-5">
                  {/* method toggle */}
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {(
                      [
                        { id: 'phone', label: '📱 Phone OTP' },
                        { id: 'email', label: '✉️ Email & Password' },
                      ] as { id: LoginMethod; label: string }[]
                    ).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setLoginMethod(m.id);
                          setErrors([]);
                          setOtpSent(false);
                          setOtp('');
                        }}
                        className={`rounded-lg py-2.5 text-xs font-bold transition ${
                          loginMethod === m.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {loginMethod === 'phone' ? (
                    <div className="space-y-4">
                      {!otpSent ? (
                        <>
                          <div>
                            <label className={labelCls}>Mobile number</label>
                            <div className="flex gap-2">
                              <span className="flex flex-shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-600">
                                🇮🇳 +91
                              </span>
                              <input
                                inputMode="numeric"
                                value={phone}
                                onChange={e =>
                                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                                }
                                onKeyDown={e => e.key === 'Enter' && phoneOk(phone) && sendOtp()}
                                placeholder="98765 43210"
                                className={inputCls}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!phoneOk(phone) || busy}
                            onClick={sendOtp}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? 'Sending…' : 'Send OTP →'}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
                            📩 OTP sent to <b>+91 {cleanPhone(phone)}</b>
                            <button
                              type="button"
                              onClick={() => setOtpSent(false)}
                              className="ml-2 font-bold text-blue-600 hover:underline"
                            >
                              Change
                            </button>
                          </div>
                          <div>
                            <label className={labelCls}>Enter 6-digit OTP</label>
                            <OtpBoxes value={otp} onChange={setOtp} />
                            <p className="mt-2 text-center text-[11px] text-slate-400">
                              {resendIn > 0 ? (
                                <span className="font-bold text-slate-500">
                                  Resend in {resendIn}s
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={sendOtp}
                                  className="font-bold text-blue-600 hover:underline"
                                >
                                  Resend OTP
                                </button>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={otp.length !== 6 || busy}
                            onClick={doPhoneLogin}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? 'Verifying…' : 'Verify & Login'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className={labelCls}>Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={inputCls}
                          autoComplete="email"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Password</label>
                        <PasswordField value={password} onChange={setPassword} />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Remember me
                        </label>
                        <button
                          type="button"
                          onClick={() => switchView('forgot')}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={doEmailLogin}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:opacity-60"
                      >
                        {busy ? 'Logging in…' : 'Login'}
                      </button>
                    </div>
                  )}
                  <p className="text-center text-xs text-slate-500">
                    New to WaterMarket?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('signup')}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              )}
              {/* ================================ SIGNUP ================================ */}
              {view === 'signup' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>First name *</label>
                      <input
                        value={suFirst}
                        onChange={e => setSuFirst(e.target.value)}
                        placeholder="Siva"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Last name *</label>
                      <input
                        value={suLast}
                        onChange={e => setSuLast(e.target.value)}
                        placeholder="Prasad"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input
                      type="email"
                      value={suEmail}
                      onChange={e => setSuEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputCls}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile number *</label>
                    <div className="flex gap-2">
                      <span className="flex flex-shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-600">
                        🇮🇳 +91
                      </span>
                      <input
                        inputMode="numeric"
                        value={suPhone}
                        onChange={e =>
                          setSuPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                        }
                        placeholder="98765 43210"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Password *</label>
                    <PasswordField
                      value={suPass}
                      onChange={setSuPass}
                      showStrength
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={suTerms}
                      onChange={e => setSuTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      I agree to the <b>Terms of Service</b> and <b>Privacy Policy</b>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={doSignup}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:opacity-60"
                  >
                    {busy ? 'Creating account…' : 'Create Account'}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('login')}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Login
                    </button>
                  </p>
                </div>
              )}
              {/* ================================ FORGOT ================================ */}
              {view === 'forgot' && (
                <div className="space-y-5">
                  {/* method toggle */}
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {(
                      [
                        { id: 'phone', label: '📱 Phone OTP' },
                        { id: 'email', label: '✉️ Email link' },
                      ] as { id: ForgotMethod; label: string }[]
                    ).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFpMethod(m.id);
                          setErrors([]);
                          setFpStep('input');
                          setFpEmailSent(false);
                        }}
                        className={`rounded-lg py-2.5 text-xs font-bold transition ${
                          fpMethod === m.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {fpMethod === 'phone' ? (
                    <div className="space-y-4">
                      {fpStep === 'input' && (
                        <>
                          <p className="text-xs text-slate-500">
                            Enter your registered mobile number — we'll text you a
                            verification code.
                          </p>
                          <div>
                            <label className={labelCls}>Mobile number</label>
                            <div className="flex gap-2">
                              <span className="flex flex-shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-600">
                                🇮🇳 +91
                              </span>
                              <input
                                inputMode="numeric"
                                value={fpPhone}
                                onChange={e =>
                                  setFpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                                }
                                onKeyDown={e => e.key === 'Enter' && phoneOk(fpPhone) && doFpPhone()}
                                placeholder="98765 43210"
                                className={inputCls}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!phoneOk(fpPhone) || busy}
                            onClick={doFpPhone}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? 'Sending…' : 'Send OTP →'}
                          </button>
                        </>
                      )}
                      {fpStep === 'otp' && (
                        <>
                          <div className="rounded-xl bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
                            📩 OTP sent to <b>+91 {cleanPhone(fpPhone)}</b>
                          </div>
                          <div>
                            <label className={labelCls}>Enter OTP</label>
                            <OtpBoxes value={fpOtp} onChange={setFpOtp} />
                            <p className="mt-2 text-center text-[11px] text-slate-400">
                              {resendIn > 0 ? (
                                <span className="font-bold text-slate-500">
                                  Resend in {resendIn}s
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    storeForgotPasswordPhone(formatPhone(fpPhone))
                                      .then(() => setResendIn(30))
                                      .catch((err: any) => setErrors([err?.message || 'Failed']));
                                  }}
                                  className="font-bold text-blue-600 hover:underline"
                                >
                                  Resend
                                </button>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={fpOtp.length !== 6 || busy}
                            onClick={doFpPhone}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? 'Verifying…' : 'Verify OTP'}
                          </button>
                        </>
                      )}
                      {fpStep === 'newpass' && (
                        <>
                          <p className="text-xs text-slate-500">
                            ✅ Verified! Now set a new password for your account.
                          </p>
                          <div>
                            <label className={labelCls}>New password</label>
                            <PasswordField
                              value={fpNewPass}
                              onChange={setFpNewPass}
                              showStrength
                              placeholder="Min 6 characters"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={doFpPhone}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:opacity-60"
                          >
                            {busy ? 'Saving…' : 'Reset Password'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!fpEmailSent ? (
                        <>
                          <p className="text-xs text-slate-500">
                            Enter your account email — we'll send you a secure reset
                            link.
                          </p>
                          <div>
                            <label className={labelCls}>Email</label>
                            <input
                              type="email"
                              value={fpEmail}
                              onChange={e => setFpEmail(e.target.value)}
                              onKeyDown={e =>
                                e.key === 'Enter' && emailOk(fpEmail) && doFpEmail()
                              }
                              placeholder="you@example.com"
                              className={inputCls}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={doFpEmail}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:opacity-60"
                          >
                            {busy ? 'Sending…' : 'Send Reset Link →'}
                          </button>
                        </>
                      ) : (
                        <div className="py-6 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-3xl">
                            📧
                          </div>
                          <p className="mt-3 text-sm font-bold text-slate-900">
                            Reset link sent!
                          </p>
                          <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                            We emailed a password reset link to{' '}
                            <b>{fpEmail.trim()}</b>. Click the link in your inbox to set
                            a new password.
                          </p>
                          <button
                            type="button"
                            onClick={() => switchView('login')}
                            className="mt-5 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            ← Back to Login
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-center text-xs text-slate-500">
                    Remembered it?{' '}
                    <button
                      type="button"
                      onClick={() => switchView('login')}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Back to Login
                    </button>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
export default AuthModal;
