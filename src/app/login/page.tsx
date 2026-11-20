'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [covers, setCovers] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Veridian Q — Sign In';
    fetch('/api/covers')
      .then(r => r.json())
      .then(d => {
        const list: string[] = d.covers || [];
        setCovers(list);
        if (list.length) setCover(list[Math.floor(Math.random() * list.length)]);
      })
      .catch(() => {});
  }, []);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setStatus('verifying');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (error) {
      setStatus('sent');
      setErrorMsg(error.message);
    } else {
      window.location.href = '/';
    }
  }

  function pickAnotherCover() {
    if (covers.length < 2) return;
    let next = cover;
    while (next === cover) next = covers[Math.floor(Math.random() * covers.length)];
    setCover(next);
  }

  return (
    <>
      <style>{`
        :root{ --bg:#0a0a0a; --panel:#111111; --line:#2a2520; --gold:#f2b94e; --gold-dim:#b08a3e; --text:#faf8f3; --text-dim:#c7c1b4; }
        *{box-sizing:border-box;}
        html,body{height:100%;margin:0;background:var(--bg);color:var(--text);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;}
        .gate{min-height:100dvh;display:flex;}
        .gate .art{flex:1.2;position:relative;background:#000;display:none;}
        .gate .art img{width:100%;height:100%;object-fit:cover;display:block;opacity:.92;}
        .gate .art .swap{position:absolute;bottom:18px;right:18px;background:rgba(0,0,0,.55);
          border:1px solid var(--gold-dim);color:var(--gold);font-size:11px;letter-spacing:1px;
          text-transform:uppercase;padding:8px 12px;border-radius:6px;cursor:pointer;}
        .gate .panel{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
        .gate form{width:100%;max-width:360px;}
        .gate .logo{font-family:Georgia,"Times New Roman",serif;font-size:30px;letter-spacing:4px;margin-bottom:6px;}
        .gate .logo b{color:var(--gold);font-weight:400;}
        .gate .tag{font-size:11.5px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:34px;}
        .gate label{display:block;font-size:12px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px;}
        .gate input{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);
          padding:13px 14px;border-radius:8px;font-size:15px;margin-bottom:16px;}
        .gate input:focus{outline:none;border-color:var(--gold-dim);}
        .gate input.code{letter-spacing:6px;font-size:20px;text-align:center;}
        .gate button{width:100%;background:var(--gold);color:#1a1405;border:none;padding:13px 14px;
          border-radius:8px;font-size:14px;font-weight:600;letter-spacing:.5px;cursor:pointer;}
        .gate button:disabled{opacity:.6;cursor:default;}
        .gate button.link{background:none;color:var(--text-dim);margin-top:12px;padding:0;font-weight:400;
          text-decoration:underline;width:auto;}
        .gate .msg{margin-top:16px;font-size:13.5px;line-height:1.5;}
        .gate .msg.ok{color:var(--gold);}
        .gate .msg.err{color:#e2685f;}
        @media(min-width:760px){ .gate .art{display:block;} }
      `}</style>
      <div className="gate">
        <div className="art">
          {cover && <img src={cover} alt="" />}
          {covers.length > 1 && (
            <button type="button" className="swap" onClick={pickAnotherCover}>New Cover</button>
          )}
        </div>
        <div className="panel">
          {status === 'sent' || status === 'verifying' ? (
            <form onSubmit={verifyCode}>
              <div className="logo">VERIDIAN <b>Q</b></div>
              <div className="tag">Enter your code</div>
              <label htmlFor="code">6-digit code</label>
              <input
                id="code" className="code" type="text" inputMode="numeric" pattern="[0-9]*"
                maxLength={6} autoFocus placeholder="000000"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={status === 'verifying'}
              />
              <button type="submit" disabled={status === 'verifying' || code.trim().length < 6}>
                {status === 'verifying' ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <div className="msg ok">We emailed a 6-digit code to {email.trim()}. Enter it above — no need to click anything in the email.</div>
              {errorMsg && <div className="msg err">{errorMsg}</div>}
              <button
                type="button" className="link"
                onClick={() => { setStatus('idle'); setCode(''); setErrorMsg(''); }}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form onSubmit={sendCode}>
              <div className="logo">VERIDIAN <b>Q</b></div>
              <div className="tag">Sign in to paint</div>
              <label htmlFor="email">Email</label>
              <input
                id="email" type="email" required placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                disabled={status === 'sending'}
              />
              <button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send Code'}
              </button>
              {status === 'error' && (
                <div className="msg err">{errorMsg || 'Something went wrong sending that code.'}</div>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
