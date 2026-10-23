"use client";

/** A short burst of green confetti (it only ever means "done"). */
export function confetti(x: number, y: number) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cv = document.getElementById("confetti") as HTMLCanvasElement | null;
  if (!cv) {
    cv = document.createElement("canvas");
    cv.id = "confetti";
    cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
  }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ["#00C26E", "#4FDC9D", "#00854C", "#CDF3E2"];
  const parts = Array.from({ length: 60 }, () => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    r: Math.random() * 6 + 3,
    c: colors[(Math.random() * colors.length) | 0],
    a: Math.random() * 6,
    va: (Math.random() - 0.5) * 0.4,
    sq: Math.random() > 0.5,
  }));
  let t = 0;
  const frame = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.32;
      p.vx *= 0.985;
      p.a += p.va;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 70);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      if (p.sq) ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    if (++t < 72) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  frame();
}
