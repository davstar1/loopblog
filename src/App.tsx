import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

import Home from "./pages/Home";
import Write from "./pages/Write";
import Post from "./pages/Post";
import Playlist from "./pages/Playlist";
import Gallery from "./pages/Gallery";
import Admin from "./pages/Admin";
import RequireAuth from "./components/RequireAuth";
import EditPost from "./pages/EditPost";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/write"
          element={
            <RequireAuth>
              <Write />
            </RequireAuth>
          }
        />

        <Route
          path="/edit/:id"
          element={
            <RequireAuth>
              <EditPost />
            </RequireAuth>
          }
        />

        <Route path="/post/:id" element={<Post />} />
        <Route path="/playlist" element={<Playlist />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/admin" element={<Admin />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
