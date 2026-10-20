"use client";

import React from "react";
import { Info } from "lucide-react";

interface TornPaperTermsProps {
  className?: string;
}

export const TornPaperTerms: React.FC<TornPaperTermsProps> = ({ className = "" }) => {
  return (
    <div className={`w-full max-w-md select-none print:break-inside-avoid ${className}`}>
      {/* Top Torn Edge SVG - Double Layered for Paper Fiber Depth */}
      <div className="w-full overflow-hidden leading-none block -mb-[1px]">
        <svg
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
          className="w-full h-4 sm:h-5 block"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Backing Fiber Layer (Subtle Grayish Paper Shadow #e2e6eb) */}
          <polygon
            points="
              0,0
              0,6
              18,8 35,5 55,10 75,6 98,12 122,7 148,11 175,5 200,10 228,6 255,12 282,7 310,11 340,6 370,12 400,7 432,13 465,6 498,11 530,6 562,12 595,7 625,12 658,5 688,11 720,6 752,12 785,7 818,12 850,5 882,11 915,6 945,12 975,7 1000,9
              1000,24
              0,24
            "
            fill="#dbe1e8"
          />
          {/* Front White Ripped Paper Layer */}
          <polygon
            points="
              0,0
              0,10
              15,7 32,12 52,8 72,13 95,9 118,14 142,8 168,13 195,8 222,14 250,9 278,13 305,8 335,14 365,9 395,14 428,8 460,14 492,9 525,14 558,8 590,14 620,9 652,14 682,8 715,13 748,8 780,14 812,9 845,14 878,8 910,13 940,8 970,13 1000,11
              1000,24
              0,24
            "
            fill="#ffffff"
          />
        </svg>
      </div>

      {/* Main Body of Torn Paper */}
      <div className="bg-[#ffffff] px-4 py-2 sm:px-5 sm:py-2.5 text-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm tracking-wide uppercase mb-2 border-b border-slate-200/80 pb-1.5">
          <Info className="h-3.5 w-3.5 text-primary" />
          <span>Terms & Conditions</span>
        </div>
        <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-700 leading-snug">
          <li className="flex items-start gap-1.5">
            <span className="text-primary font-black leading-none mt-0.5">•</span>
            <span>
              <strong className="text-slate-900 font-semibold">Advance Payment:</strong> Minimum 50% advance required with official work order.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-primary font-black leading-none mt-0.5">•</span>
            <span>
              <strong className="text-slate-900 font-semibold">Delivery Timeline:</strong> Maximum delivery time is 1 month from confirmation.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-primary font-black leading-none mt-0.5">•</span>
            <span>
              <strong className="text-slate-900 font-semibold">Excluded Charges:</strong> Tax, VAT & delivery charges are excluded.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-primary font-black leading-none mt-0.5">•</span>
            <span>
              <strong className="text-slate-900 font-semibold">Refund Policy:</strong> Advance payment is strictly non-refundable.
            </span>
          </li>
        </ul>
      </div>

      {/* Bottom Torn Edge SVG - Double Layered for Paper Fiber Depth */}
      <div className="w-full overflow-hidden leading-none block -mt-[1px]">
        <svg
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
          className="w-full h-4 sm:h-5 block"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Backing Fiber Layer */}
          <polygon
            points="
              0,0
              1000,0
              1000,16
              980,10 955,18 928,11 900,17 870,22 845,12 820,18 790,11 762,17 732,10 705,18 675,11 645,17 615,9 585,18 555,11 525,18 495,10 465,17 435,11 405,18 375,10 345,18 315,11 285,17 255,9 225,18 195,11 165,17 135,10 105,18 75,11 45,17 20,11 0,16
            "
            fill="#dbe1e8"
          />
          {/* Front White Ripped Paper Layer */}
          <polygon
            points="
              0,0
              1000,0
              1000,12
              978,7 952,14 925,8 898,14 868,19 842,9 818,15 788,8 758,14 728,7 700,15 670,8 640,14 610,6 580,15 550,8 520,15 490,7 460,14 430,8 400,15 370,7 340,15 310,8 280,14 250,6 220,15 190,8 160,14 130,7 100,15 70,8 40,14 18,8 0,12
            "
            fill="#ffffff"
          />
        </svg>
      </div>
    </div>
  );
};
