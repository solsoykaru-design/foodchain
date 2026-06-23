import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a192f]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
