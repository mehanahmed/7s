import { getGlobalSettings } from '@/lib/settings-service';
import { getSessionUser } from '@/lib/session';
import 'leaflet/dist/leaflet.css';
import { ClientLayout } from './ClientLayout'; 
import { headers } from 'next/headers';
import { getSystemLicenseStatus, normalizeHost } from '@/lib/license-service';
import { redirect } from 'next/navigation';

// This is now a pure Server Component. It fetches data and passes it down.
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = normalizeHost(h.get('x-forwarded-host') || h.get('host') || 'localhost');
  const lic = await getSystemLicenseStatus(host);
  if (!lic.valid) {
    redirect('/license');
  }

  const currentUser = await getSessionUser();

  // Fetch initial settings on the server.
  const globalSettings = await getGlobalSettings();
  
  return (
    <ClientLayout 
      initialUser={currentUser} 
      initialGlobalSettings={globalSettings}
    >
      {children}
    </ClientLayout>
  );
}
