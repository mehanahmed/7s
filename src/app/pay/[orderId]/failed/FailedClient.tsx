"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  orderId: string;
  companyName: string;
  reason: string | null;
}

function CardIllustration({ visible }: { visible: boolean }) {
  return (
    <svg width="240" height="200" viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      {/* Dotted arc */}
      <path d="M50 120 Q120 20 190 120" stroke="#d1d5db" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" className="dark:stroke-neutral-600" />

      {/* Shadow ellipse */}
      <ellipse cx="120" cy="185" rx="70" ry="6" fill="rgba(0,0,0,0.06)" />

      {/* Left card half */}
      <g style={{ opacity: visible ? 1 : 0, transform: visible ? "rotate(-8deg)" : "rotate(0deg)", transformOrigin: "95px 120px", transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)", transitionDelay: "0.2s" }}>
        <defs>
          <linearGradient id="cardGradL" x1="30" y1="60" x2="95" y2="175">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        {/* Card body with jagged right edge */}
        <path d="M45,65 L45,65 Q45,55 55,55 L92,55 L89,63 L93,72 L88,82 L92,92 L89,102 L93,112 L88,122 L92,132 L89,142 L93,152 L89,162 L92,172 L55,172 Q45,172 45,162 Z" fill="url(#cardGradL)" />
        {/* Chip */}
        <rect x="56" y="72" width="20" height="15" rx="3" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {/* Magnetic stripe */}
        <rect x="45" y="100" width="48" height="10" fill="rgba(0,0,0,0.15)" />
        {/* Card numbers */}
        <circle cx="58" cy="140" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="66" cy="140" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="74" cy="140" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="82" cy="140" r="2.5" fill="rgba(255,255,255,0.4)" />
      </g>

      {/* Right card half */}
      <g style={{ opacity: visible ? 1 : 0, transform: visible ? "rotate(10deg)" : "rotate(0deg)", transformOrigin: "145px 125px", transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)", transitionDelay: "0.3s" }}>
        <defs>
          <linearGradient id="cardGradR" x1="145" y1="60" x2="200" y2="175">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        {/* Card body with jagged left edge */}
        <path d="M148,60 L185,60 Q195,60 195,70 L195,170 Q195,180 185,180 L148,180 L151,172 L147,162 L152,152 L148,142 L151,132 L147,122 L152,112 L148,102 L151,92 L147,82 L151,72 L148,62 Z" fill="url(#cardGradR)" />
        {/* Magnetic stripe */}
        <rect x="147" y="105" width="48" height="10" fill="rgba(0,0,0,0.15)" />
        {/* Card numbers */}
        <circle cx="158" cy="145" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="166" cy="145" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="174" cy="145" r="2.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="182" cy="145" r="2.5" fill="rgba(255,255,255,0.4)" />
        {/* Network logo */}
        <circle cx="176" cy="168" r="7" fill="rgba(255,255,255,0.25)" />
        <circle cx="184" cy="168" r="7" fill="rgba(255,255,255,0.15)" />
      </g>

      {/* Lightning crack */}
      <path
        d="M126,62 L118,85 L128,88 L116,115 L126,118 L114,145"
        stroke="#fbbf24"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease-out", transitionDelay: "0.7s" }}
      />

      {/* Exclamation bubble */}
      <g style={{ transform: visible ? "scale(1)" : "scale(0)", transformOrigin: "120px 42px", transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)", transitionDelay: "0.6s" }}>
        <circle cx="120" cy="42" r="20" fill="white" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.08))" }} />
        <text x="120" y="50" textAnchor="middle" fill="#f87171" fontSize="22" fontWeight="bold" fontFamily="system-ui">!</text>
      </g>

      {/* Spark lines left */}
      <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease-out", transitionDelay: "0.9s" }}>
        <line x1="82" y1="38" x2="76" y2="34" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
        <line x1="86" y1="28" x2="84" y2="22" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
        <line x1="78" y1="46" x2="72" y2="46" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
      </g>

      {/* Spark lines right */}
      <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease-out", transitionDelay: "1s" }}>
        <line x1="158" y1="38" x2="164" y2="34" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
        <line x1="154" y1="28" x2="156" y2="22" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
        <line x1="162" y1="46" x2="168" y2="46" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-neutral-500" />
      </g>
    </svg>
  );
}

export function FailedClient({ orderId, companyName, reason }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  const displayReason = reason || "Your payment could not be processed. Please try again.";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div
        className="w-full max-w-sm flex flex-col items-center"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <CardIllustration visible={show} />

        <h1
          className="text-[26px] font-bold text-foreground tracking-tight mt-6"
          style={{
            opacity: 0,
            animation: show ? "fadeSlideUp 0.5s ease-out 0.8s forwards" : "none",
          }}
        >
          Payment Failed
        </h1>

        <p
          className="text-muted-foreground text-center mt-3 text-[15px] leading-relaxed max-w-[280px]"
          style={{
            opacity: 0,
            animation: show ? "fadeSlideUp 0.5s ease-out 1s forwards" : "none",
          }}
        >
          {displayReason}
        </p>

        <div
          className="w-full mt-8 space-y-3"
          style={{
            opacity: 0,
            animation: show ? "fadeSlideUp 0.5s ease-out 1.2s forwards" : "none",
          }}
        >
          <Link
            href={`/pay/${orderId}`}
            className="w-full py-3.5 px-8 rounded-full font-semibold text-white text-[15px] flex items-center justify-center tracking-wide"
            style={{
              background: "linear-gradient(135deg, #fb923c 0%, #f87171 50%, #fb7185 100%)",
              boxShadow: "0 8px 24px rgba(251,113,133,0.3)",
            }}
          >
            TRY AGAIN
          </Link>

          <Link
            href={`/track/${orderId}`}
            className="w-full py-3 px-6 rounded-full font-medium text-muted-foreground text-sm flex items-center justify-center hover:text-foreground transition-colors"
          >
            View Order Details
          </Link>
        </div>

        <p
          className="text-xs text-muted-foreground/60 text-center mt-6 max-w-[260px]"
          style={{
            opacity: 0,
            animation: show ? "fadeSlideUp 0.4s ease-out 1.4s forwards" : "none",
          }}
        >
          No money was deducted. If charged, refund happens within 24-72 hours automatically.
        </p>
      </div>

      <style jsx global>{`
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
