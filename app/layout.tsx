import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Xiaomi SU7 Anatomy Studio', description: 'Interactive, exploded 3D study of Xiaomi SU7 systems.' };
export const viewport = {width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" className="dark"><body>{children}</body></html> }
