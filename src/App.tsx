import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/NavBar";
import Home from "./pages/Home";
import Write from "./pages/Write";
import Post from "./pages/Post";
import Videos from "./pages/Videos";
import Playlist from "./pages/Playlist";
import Gallery from "./pages/Gallery";

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/write" element={<Write />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/playlist" element={<Playlist />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} LoopBlog</footer>
    </div>
  );
}
