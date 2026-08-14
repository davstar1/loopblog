import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import Videos from "./pages/Videos";
import Music from "./pages/Music";
import Journal from "./pages/Journal";
import Write from "./pages/Write";
import Post from "./pages/Post";
import Admin from "./pages/Admin";
import EditPost from "./pages/EditPost";
import LogoOptions from "./pages/LogoOptions";

import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Videos />} />
        <Route path="/music" element={<Music />} />
        <Route path="/journal" element={<Journal />} />

        <Route
          path="/write"
          element={
            <RequireAuth>
              <Write />
            </RequireAuth>
          }
        />

        <Route path="/post/:id" element={<Post />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/edit/:id" element={<EditPost />} />
        <Route path="/logo-options" element={<LogoOptions />} />

        {/* keep this LAST */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
