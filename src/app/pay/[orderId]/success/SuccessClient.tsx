"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  companyName: string;
  trxId: string | null;
  amount: string | null;
}

const GREENS = ["#10b981", "#34d399", "#059669", "#6ee7b7", "#047857", "#a7f3d0"];

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 80 }, (_, i) => {
      const isLarge = i < 12;
      return {
        id: i,
        left: Math.random() * 100,
        startY: Math.random() * 80 - 10,
        width: isLarge ? 10 + Math.random() * 10 : 5 + Math.random() * 8,
        height: isLarge ? 8 + Math.random() * 7 : 3 + Math.random() * 5,
        color: GREENS[i % GREENS.length],
        delay: Math.random() * 0.15,
        duration: 5 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 80,
        rotStart: Math.random() * 360,
        rotEnd: 360 + Math.random() * 720,
      };
    })
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-[1px]"
          style={{
            left: `${p.left}%`,
            top: `${p.startY}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            opacity: 0,
            animation: `confettiRain ${p.duration}s linear ${p.delay}s forwards`,
            ["--drift" as string]: `${p.drift}px`,
            ["--rs" as string]: `${p.rotStart}deg`,
            ["--re" as string]: `${p.rotEnd}deg`,
          }}
        />
      ))}
    </div>
  );
}

function CheckmarkCircle({ visible }: { visible: boolean }) {
  return (
    <div className="relative mx-auto" style={{ width: 80, height: 80 }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center bg-emerald-500"
        style={{
          transform: visible ? "scale(1)" : "scale(0)",
          animation: visible ? "sphereBounce 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 42 42" fill="none">
          <path
            d="M11 21L18 28L31 15"
            stroke="white"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="42"
            strokeDashoffset="42"
            style={{
              animation: visible ? "checkDraw 0.35s ease-out 0.5s forwards" : "none",
            }}
          />
        </svg>
      </div>
    </div>
  );
}

function ZigzagEdge({ flip }: { flip?: boolean }) {
  return (
    <div className="w-full overflow-hidden" style={{ height: 12, ...(flip ? { marginBottom: -1 } : { marginTop: -1 }) }}>
      <svg
        viewBox="0 0 400 12"
        preserveAspectRatio="none"
        className="w-full h-full block"
        style={flip ? { transform: "scaleY(-1)" } : undefined}
      >
        <path
          d={"M0,0 " + Array.from({ length: 28 }, (_, i) => `L${i * 14.3 + 7.15},12 L${(i + 1) * 14.3},0`).join(" ") + " L400,0 Z"}
          fill="white"
          className="dark:fill-neutral-900"
        />
      </svg>
    </div>
  );
}

function CoinBurst({ active, originRect }: { active: boolean; originRect: DOMRect | null }) {
  const [coins] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 300,
      y: -(80 + Math.random() * 200),
      fallY: 400 + Math.random() * 300,
      size: 16 + Math.random() * 14,
      delay: Math.random() * 0.2,
      duration: 0.8 + Math.random() * 0.5,
      rotEnd: 360 + Math.random() * 720,
    }))
  );

  if (!active || !originRect) return null;

  const cx = originRect.left + originRect.width / 2;
  const cy = originRect.top + originRect.height / 2;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {coins.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            left: cx,
            top: cy,
            width: c.size,
            height: c.size,
            animation: `coinBurst ${c.duration}s cubic-bezier(0.22,1,0.36,1) ${c.delay}s forwards`,
            ["--cx" as string]: `${c.x}px`,
            ["--cy" as string]: `${c.y}px`,
            ["--fy" as string]: `${c.fallY}px`,
            ["--cr" as string]: `${c.rotEnd}deg`,
          }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: "radial-gradient(ellipse at 35% 30%, #fcd34d 0%, #f59e0b 50%, #d97706 100%)",
              boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 8px rgba(217,119,6,0.3)",
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.4) 0%, transparent 50%)" }}
            >
              <span className="text-amber-800 font-bold" style={{ fontSize: c.size * 0.4 }}>৳</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenWipe({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-[70]"
      style={{
        background: "linear-gradient(to top, #059669 0%, #10b981 40%, #34d399 100%)",
        animation: "screenWipe 0.6s cubic-bezier(0.4,0,0.2,1) 0.5s forwards",
        transform: "translateY(100%)",
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div style={{ animation: "screenWipeContent 0.4s ease-out 0.8s forwards", opacity: 0 }}>
          <svg width="48" height="48" viewBox="0 0 42 42" fill="none" className="mx-auto mb-3">
            <path d="M11 21L18 28L31 15" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-white font-semibold text-lg text-center">Redirecting...</p>
        </div>
      </div>
    </div>
  );
}

export function SuccessClient({ orderId, companyName, trxId, amount }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState(0);
  const [peeling, setPeeling] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => setPhase(3), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleCopyTrx = () => {
    if (!trxId) return;
    navigator.clipboard.writeText(trxId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTrack = () => {
    if (peeling) return;
    if (btnRef.current) setBtnRect(btnRef.current.getBoundingClientRect());
    setPeeling(true);
    setTimeout(() => router.push(`/track/${orderId}`), 1300);
  };

  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {phase >= 1 && <Confetti />}
      <CoinBurst active={peeling} originRect={btnRect} />
      <ScreenWipe active={peeling} />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        <CheckmarkCircle visible={phase >= 1} />

        <div className="text-center mt-5 mb-6" style={{ perspective: 600 }}>
          <h1
            className="text-[22px] font-bold text-foreground tracking-tight"
            style={{
              opacity: phase >= 2 ? undefined : 0,
              transform: phase >= 2 ? undefined : "rotateX(90deg)",
              transformOrigin: "center bottom",
              animation: phase >= 2 ? "textFlipIn 0.6s cubic-bezier(0.22,1,0.36,1) forwards" : "none",
              ...(phase < 2 ? { opacity: 0, transform: "rotateX(90deg)" } : {}),
            }}
          >
            Payment Complete
          </h1>
        </div>

        <div
          className="w-full"
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? "translateY(0)" : "translateY(60px)",
            transition: "all 0.8s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <ZigzagEdge flip />

          <div className="bg-white dark:bg-neutral-900 px-5 pt-5 pb-5 shadow-xl shadow-black/[0.04]">
            {amount && (
              <div className="text-center pb-4 mb-4 border-b border-gray-200 dark:border-neutral-700">
                <span className="text-[32px] font-bold text-foreground tracking-tight leading-none">
                  ৳{Number(amount).toLocaleString()}
                </span>
              </div>
            )}

            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              <div className="flex items-center gap-3 py-3 first:pt-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-400" />
                    <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-gray-400" />
                  </svg>
                </div>
                <p className="font-mono text-sm font-semibold text-foreground truncate">{orderId}</p>
              </div>

              <div className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {companyName.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate flex-1">{companyName}</p>
                {amount && (
                  <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
                      <span className="text-[8px]">৳</span>
                    </span>
                    {Number(amount).toLocaleString()}
                  </span>
                )}
              </div>

              {trxId && (
                <div className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">TX</span>
                  </div>
                  <button
                    onClick={handleCopyTrx}
                    className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground hover:text-emerald-600 transition-colors"
                  >
                    <span className="truncate">{trxId}</span>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                </div>
              )}

              <div className="py-3">
                <p className="text-sm text-muted-foreground">{dateStr}</p>
              </div>
            </div>

            <div className="mt-4 relative overflow-hidden rounded-full">
              <button
                ref={btnRef}
                onClick={handleTrack}
                className="w-full py-3 px-6 rounded-full font-semibold text-foreground bg-transparent border-2 border-gray-200 dark:border-neutral-700 hover:border-emerald-500 hover:text-emerald-600 transition-all text-sm flex items-center justify-center gap-2 relative z-10"
                style={peeling ? {
                  animation: "btnPeel 0.5s cubic-bezier(0.4,0,1,1) forwards",
                } : undefined}
              >
                Track Your Order
                <ArrowRight className="h-4 w-4" />
              </button>
              {peeling && (
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(90deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)",
                    animation: "btnReveal 0.4s ease-out 0.3s forwards",
                    opacity: 0,
                  }}
                >
                  <span className="text-emerald-700 font-bold text-sm flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Done
                  </span>
                </div>
              )}
            </div>
          </div>

          <ZigzagEdge />
        </div>
      </div>

      <style jsx global>{`
        @keyframes confettiRain {
          0% {
            opacity: 1;
            transform: translateX(0) translateY(0) rotate(var(--rs)) scale(1);
          }
          25% {
            opacity: 1;
            transform: translateX(calc(var(--drift) * 0.15)) translateY(8vh) rotate(calc(var(--rs) + 90deg)) scale(0.97);
          }
          50% {
            opacity: 1;
            transform: translateX(calc(var(--drift) * 0.4)) translateY(30vh) rotate(calc(var(--rs) + 200deg)) scale(0.9);
          }
          75% {
            opacity: 0.9;
            transform: translateX(calc(var(--drift) * 0.7)) translateY(60vh) rotate(calc(var(--rs) + 320deg)) scale(0.7);
          }
          90% { opacity: 0.4; }
          100% {
            opacity: 0;
            transform: translateX(var(--drift)) translateY(110vh) rotate(var(--re)) scale(0.4);
          }
        }
        @keyframes sphereBounce {
          0% { transform: scale(0); }
          30% { transform: scale(1.5); }
          50% { transform: scale(0.88); }
          65% { transform: scale(1.1); }
          80% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 42; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes textFlipIn {
          0% { opacity: 0; transform: rotateX(90deg); }
          100% { opacity: 1; transform: rotateX(0deg); }
        }
        @keyframes btnPeel {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          60% { transform: translateX(110%) scale(0.9); opacity: 0.6; }
          100% { transform: translateX(150%) scale(0.7); opacity: 0; }
        }
        @keyframes btnReveal {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes coinBurst {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(0);
            opacity: 0;
          }
          15% {
            transform: translate(calc(var(--cx) * 0.4), calc(var(--cy) * 0.5)) rotate(calc(var(--cr) * 0.3)) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(var(--cx), var(--cy)) rotate(calc(var(--cr) * 0.6)) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--cx), var(--fy)) rotate(var(--cr)) scale(0.5);
            opacity: 0;
          }
        }
        @keyframes screenWipe {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0%); }
        }
        @keyframes screenWipeContent {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
