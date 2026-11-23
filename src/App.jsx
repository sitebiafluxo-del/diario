import { AuthProvider } from './contexts/AuthContext';
import PaperGalleryHome from './components/PaperGalleryHome';

function App() {
  return (
    <AuthProvider>
      <div className="app-root">
        <PaperGalleryHome />
      </div>
    </AuthProvider>
  );
}

export default App;
