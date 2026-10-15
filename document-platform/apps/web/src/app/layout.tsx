import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { THEME_BOOTSTRAP_SCRIPT, ThemeProvider } from '../lib/ThemeContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import '../index.css';
import '../blog-studio-themes.css';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0d14' },
  ],
};

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
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg', apple: '/favicon.svg' },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        {/* Applies the saved/system theme before first paint. Injected by Next
            into the initial HTML (a raw <script> in <head> intermittently broke
            hydration and reset the theme). */}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        <ThemeProvider>
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <Navbar />
          <main id="main-content" className="site-main w-full flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
