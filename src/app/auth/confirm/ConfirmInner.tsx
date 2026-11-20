'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ConfirmInner() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/';

  const [status, setStatus] = useState<'idle' | 'confirming' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Veridian Q — Confirm Sign In';
  }, []);

  async function confirm() {
    if (!tokenHash || !type) return;
    setStatus('confirming');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email',
      token_hash: tokenHash,
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      window.location.href = next;
    }
  }

  const linkInvalid = !tokenHash || !type;

  return (
    <>
      <style>{`
        :root{ --bg:#0a0a0a; --panel:#111111; --line:#2a2520; --gold:#f2b94e; --gold-dim:#b08a3e; --text:#faf8f3; --text-dim:#c7c1b4; }
        *{box-sizing:border-box;}
        html,body{height:100%;margin:0;background:var(--bg);color:var(--text);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;}
        .confirm{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px;}
        .confirm .box{width:100%;max-width:360px;text-align:center;}
        .confirm .logo{font-family:Georgia,"Times New Roman",serif;font-size:30px;letter-spacing:4px;margin-bottom:6px;}
        .confirm .logo b{color:var(--gold);font-weight:400;}
        .confirm .tag{font-size:11.5px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:34px;}
        .confirm button{width:100%;background:var(--gold);color:#1a1405;border:none;padding:13px 14px;
          border-radius:8px;font-size:14px;font-weight:600;letter-spacing:.5px;cursor:pointer;}
        .confirm button:disabled{opacity:.6;cursor:default;}
        .confirm .msg{margin-top:16px;font-size:13.5px;line-height:1.5;}
        .confirm .msg.err{color:#e2685f;}
      `}</style>
      <div className="confirm">
        <div className="box">
          <div className="logo">VERIDIAN <b>Q</b></div>
          <div className="tag">Confirm sign in</div>
          {linkInvalid ? (
            <div className="msg err">This link is invalid or has expired. Go back and request a new one.</div>
          ) : (
            <>
              <button onClick={confirm} disabled={status === 'confirming'}>
                {status === 'confirming' ? 'Signing in…' : 'Confirm Sign In'}
              </button>
              {status === 'error' && (
                <div className="msg err">{errorMsg || 'That link has already been used or has expired. Go back and request a new one.'}</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
