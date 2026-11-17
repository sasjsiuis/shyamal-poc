import { Navigate, Route, Routes } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { HomePage } from './pages/HomePage';
import { LearnPage } from './pages/LearnPage';
import { MyWorkPage } from './pages/MyWorkPage';
import { TemplatesGalleryPage } from './pages/TemplatesGalleryPage';

export default function App() {
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
