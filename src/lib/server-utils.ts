import { headers } from 'next/headers';

export async function getAppUrl(): Promise<string> {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    if (host) {
      let proto = headersList.get('x-forwarded-proto') || 'https';
      // Handle multi-proxy forwarded proto header (e.g. "https, https")
      proto = proto.split(',')[0].trim();
      if (proto !== 'http' && proto !== 'https') {
        proto = 'https';
      }
      return `${proto}://${host}`;
    }
  } catch (e) {
    // headers() might throw when called outside request context (e.g., background jobs)
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.colorhutbd.xyz';
}
