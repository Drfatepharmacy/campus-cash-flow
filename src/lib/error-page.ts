export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load — UniEgo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet" />
    <style>
      :root { --royal:#332158; --gold:#c99a3f; --ink:#241d33; --muted:#6b6580; --bg:#faf9f7; }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; display:grid; place-items:center; padding:1.5rem;
        font:400 15px/1.6 Inter, system-ui, -apple-system, sans-serif; color:var(--ink);
        background:radial-gradient(60rem 40rem at 110% -10%, rgba(51,33,88,.10), transparent 60%),
                   radial-gradient(50rem 36rem at -10% 110%, rgba(201,154,63,.14), transparent 60%), var(--bg); }
      .wrap { width:100%; max-width:30rem; text-align:center; }
      .brand { display:inline-flex; align-items:center; gap:.65rem; margin-bottom:2rem; }
      .mark { width:36px; height:36px; border-radius:12px; display:grid; place-items:center; color:var(--gold);
        font:800 18px/1 "Plus Jakarta Sans", sans-serif; background:linear-gradient(140deg,#3d2a66,#241a44);
        box-shadow:0 14px 28px -14px rgba(36,29,51,.5); }
      .name { font:800 16px/1 "Plus Jakarta Sans", sans-serif; letter-spacing:-.02em; }
      .name span { color:var(--royal); }
      .card { background:rgba(255,255,255,.82); backdrop-filter:blur(14px); border:1px solid rgba(36,29,51,.08);
        border-radius:24px; padding:2.25rem 2rem; box-shadow:0 24px 48px -24px rgba(36,29,51,.22); }
      .icon { width:48px; height:48px; margin:0 auto; border-radius:16px; display:grid; place-items:center;
        background:rgba(201,154,63,.16); font-size:22px; }
      h1 { font:700 21px/1.3 "Plus Jakarta Sans", sans-serif; letter-spacing:-.02em; margin:1.25rem 0 .5rem; }
      p { color:var(--muted); margin:0 auto; max-width:22rem; font-size:14px; }
      .actions { display:flex; gap:.5rem; justify-content:center; flex-wrap:wrap; margin-top:1.75rem; }
      a, button { padding:.6rem 1.1rem; border-radius:.7rem; font:500 14px/1 Inter, sans-serif; cursor:pointer;
        text-decoration:none; border:1px solid transparent; transition:opacity .15s ease; }
      a:hover, button:hover { opacity:.9; }
      .primary { background:var(--royal); color:#fff; }
      .secondary { background:#fff; color:var(--ink); border-color:rgba(36,29,51,.14); }
      .foot { margin-top:1.5rem; font-size:12px; color:var(--muted); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="brand"><div class="mark">U</div><div class="name">Uni<span>Ego</span></div></div>
      <div class="card">
        <div class="icon">&#9888;&#65039;</div>
        <h1>This page didn't load</h1>
        <p>Something interrupted the page. Your account and payments are safe — please try again in a moment.</p>
        <div class="actions">
          <button class="primary" onclick="location.reload()">Try again</button>
          <a class="secondary" href="/">Go home</a>
        </div>
      </div>
      <div class="foot">Need help? Contact the UniEgo support team.</div>
    </div>
  </body>
</html>`;
}
