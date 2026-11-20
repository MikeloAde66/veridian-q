'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [covers, setCovers] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Veridian Q';
    fetch('/api/covers')
      .then(r => r.json())
      .then(d => {
        const list: string[] = d.covers || [];
        setCovers(list);
        if (list.length) setCover(list[Math.floor(Math.random() * list.length)]);
      })
      .catch(() => {});
  }, []);

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
        .gate .box{width:100%;max-width:360px;}
        .gate .logo{font-family:Georgia,"Times New Roman",serif;font-size:30px;letter-spacing:4px;margin-bottom:6px;}
        .gate .logo b{color:var(--gold);font-weight:400;}
        .gate .tag{font-size:11.5px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:34px;}
        .gate a.enter, .gate .enter{display:block;width:100%;background:var(--gold);color:#1a1405;border:none;
          padding:13px 14px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:.5px;
          cursor:pointer;text-align:center;text-decoration:none;}
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
          <div className="box">
            <div className="logo">VERIDIAN <b>Q</b></div>
            <div className="tag">Sign in to paint</div>
            <button type="button" className="enter" onClick={() => { window.location.href = '/canvas'; }}>Enter</button>
          </div>
        </div>
      </div>
    </>
  );
}
