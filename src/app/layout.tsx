
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Providers } from './providers'; // Import the new client-side provider
import 'leaflet/dist/leaflet.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Seven Solution',
  description: 'Seamless Order Tracking and Management',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={GeistSans.style}>
      <body className='font-sans antialiased' suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `
          // Errors thrown by browser extensions are not ours; keep them out of the Next error overlay.
          window.addEventListener('error', function (e) {
            if (e.filename && e.filename.indexOf('-extension://') !== -1) { e.stopImmediatePropagation(); e.preventDefault(); }
          }, true);
          window.addEventListener('unhandledrejection', function (e) {
            var st = e.reason && e.reason.stack ? String(e.reason.stack) : '';
            if (st.indexOf('-extension://') !== -1) { e.stopImmediatePropagation(); e.preventDefault(); }
          }, true);
          (function () {
            var A = "bis_skin_checked";
            function strip(n) { if (n.removeAttribute) n.removeAttribute(A); }
            new MutationObserver(function (ms) {
              ms.forEach(function (m) {
                if (m.type === "attributes") strip(m.target);
                else m.addedNodes.forEach(function (n) {
                  strip(n);
                  if (n.querySelectorAll) n.querySelectorAll("[" + A + "]").forEach(strip);
                });
              });
            }).observe(document.documentElement, { attributes: true, attributeFilter: [A], childList: true, subtree: true });
          })();
        ` }} />
        <Providers>
          {children}
        </Providers>
        <Script
          type="module"
          src="https://unpkg.com/spoilerjs/dist/components/spoiler-span.js"
          strategy="lazyOnload"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('wheel', function(event) {
            if (document.activeElement.type === 'number') {
              event.preventDefault();
            }
          }, { passive: false });

          window.addEventListener('error', function(event) {
            var errorText = event.message || (event.error && event.error.message) || '';
            if (errorText.indexOf('ChunkLoadError') !== -1 || errorText.indexOf('Loading chunk') !== -1) {
              var lastReload = null;
              try { lastReload = sessionStorage.getItem('last-chunk-reload'); } catch (e) {}
              var now = Date.now();
              if (!lastReload || (now - parseInt(lastReload, 10)) > 10000) {
                try { sessionStorage.setItem('last-chunk-reload', now.toString()); } catch (e) {}
                window.location.reload();
              }
            }
          });

          window.addEventListener('unhandledrejection', function(event) {
            var errorText = (event.reason && event.reason.message) || '';
            if (errorText.indexOf('ChunkLoadError') !== -1 || errorText.indexOf('Loading chunk') !== -1) {
              var lastReload = null;
              try { lastReload = sessionStorage.getItem('last-chunk-reload'); } catch (e) {}
              var now = Date.now();
              if (!lastReload || (now - parseInt(lastReload, 10)) > 10000) {
                try { sessionStorage.setItem('last-chunk-reload', now.toString()); } catch (e) {}
                window.location.reload();
              }
            }
          });
        ` }} />
      </body>
    </html>
  );
}
