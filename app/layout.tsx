import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: '아아트립 (Aa-Trip) | Naver Map Route Planner',
  description: '아아트립 (Aa-Trip) - 네이버 지도 리스트 연동, 요일별 휴무일 실시간 자동 검증 및 커스텀 마커 동선 시각화',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: ['/icons/icon-192.png', '/icons/icon-512.png'],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '아아트립',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#059669',
};

const navKey = (process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || 'scqr0strs4').trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="light">
      <head>
        <Script
          id="naver-map-auth-failure-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.navermap_authFailure = function() {
                console.error('[Naver Maps SDK] Authentication Failed (OpenAPI3.0 Unauthenticated)');
                window.__NAVER_MAP_AUTH_FAILED__ = true;
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('naver_map_auth_failed'));
                }
              };
              window.naver_map_auth_failure = window.navermap_authFailure;
              window.navermap_auth_failure = window.navermap_authFailure;
            `,
          }}
        />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 h-screen w-screen overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
