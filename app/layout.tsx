import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { SignOutButton } from '@/components/SignOutButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'ArtePay Boards',
    description: 'Board and table management with automations'
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                {children}
                <Toaster />
            </body>
        </html>
    );
}
