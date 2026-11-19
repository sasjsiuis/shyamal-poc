import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { HomePage } from './pages/HomePage';
import { LearnPage } from './pages/LearnPage';
import { MyWorkPage } from './pages/MyWorkPage';
import { TemplatesGalleryPage } from './pages/TemplatesGalleryPage';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function App() {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    if (lastTrackedPathRef.current === null) {
      lastTrackedPathRef.current = pagePath;
      return;
    }
    if (lastTrackedPathRef.current === pagePath) return;
    lastTrackedPathRef.current = pagePath;

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/templates" element={<TemplatesGalleryPage />} />
      <Route path="/my-work" element={<MyWorkPage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/editor/:templateId" element={<EditorPage />} />
      <Route path="/editor/:templateId/:projectId" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
