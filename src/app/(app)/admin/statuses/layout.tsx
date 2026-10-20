import { notFound } from 'next/navigation';

// Status Management is disabled: nobody can open this page.
export default function StatusesLayout(_: { children: React.ReactNode }) {
  notFound();
}
