
import { getGlobalSettings } from '@/lib/settings-service';
import { getSessionUser } from '@/lib/session';
import 'leaflet/dist/leaflet.css';
import { ClientLayout } from './ClientLayout'; 

// This is now a pure Server Component. It fetches data and passes it down.
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
