import type { Metadata } from 'next';
import { ThemeProvider } from '../lib/ThemeContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import '../index.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://apptoolkitlab.com'),
  title: 'AppToolkitLab — Free Online Tools, Cloud SaaS & Software Marketplace',
  description:
    'All-in-one digital platform for high-speed PDF conversions, developer tools, downloadable software, and cloud document editing.',
  keywords: [
    'pdf converter',
    'free tools',
    'pdf to word',
    'ocr text extractor',
    'markdown to pdf',
    'saas tools',
    'software marketplace',
    'document editor',
  ],
  authors: [{ name: 'AppToolkitLab by Gonexel' }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'AppToolkitLab — Free Tools & Software Marketplace',
    description:
      'Convert documents, extract text with OCR, download developer software, and build in our cloud SaaS workspace.',
    siteName: 'AppToolkitLab',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased"
        style={{
          backgroundColor: 'var(--bg)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <ThemeProvider>
          <Navbar />
          <main className="w-full flex-1 pt-[4.5rem]">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
