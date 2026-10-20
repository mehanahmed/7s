
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Frown } from 'lucide-react';
import { motion } from 'framer-motion';
import { addPaymentMethodAction } from './(app)/admin/service-management/actions';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-black text-foreground p-6 text-center selection:bg-primary/20 selection:text-primary">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Frown className="h-32 w-32 text-primary mb-8 drop-shadow-[0_5px_15px_rgba(var(--primary-rgb),0.3)]" />
      </motion.div>

      <motion.h1
        className="text-8xl sm:text-9xl font-extrabold text-primary tracking-tighter mb-6 drop-shadow-[0_2px_5px_rgba(var(--primary-rgb),0.2)]"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 120 }}
      >
        404
      </motion.h1>

      <motion.p
        className="text-2xl sm:text-3xl font-semibold text-foreground mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Oops! Page Not Found.
      </motion.p>

      <motion.p
        className="text-md sm:text-lg text-gray-300 mb-10 max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        It seems the page you are looking for has wandered off into the digital wilderness. Don't worry, we can guide you back.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg py-3 px-8 rounded-lg shadow-lg hover:shadow-primary/40 transition-all duration-300 ease-in-out transform hover:scale-105">
          <Link href="/dashboard">
            <Home className="mr-2 h-5 w-5" />
            Go Back Home
          </Link>
        </Button>
      </motion.div>

      <style jsx global>{`
        :root {
          --primary-rgb: 25 95% 53%; /* Assuming HSL for primary is 25 95% 53% */
        }
        .dark {
           --primary-rgb: 25 90% 58%; /* Assuming HSL for primary in dark mode */
        }
      `}</style>
    </div>
  ); 
}