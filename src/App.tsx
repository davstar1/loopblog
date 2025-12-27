import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import Home from "./pages/Home";
import Write from "./pages/Write";
import Post from "./pages/Post";
import Playlist from "./pages/Playlist";
import Gallery from "./pages/Gallery";
import Admin from "./pages/Admin";
import EditPost from "./pages/EditPost";

import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      {/* ✅ Everything inside here is globally wrapped by AppLayout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />

        <Route
          path="/write"
          element={
            <RequireAuth>
              <Write />
            </RequireAuth>
          }
        />

        <Route path="/post/:id" element={<Post />} />
        <Route path="/playlist" element={<Playlist />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/edit/:id" element={<EditPost />} />

        {/* keep this LAST */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
