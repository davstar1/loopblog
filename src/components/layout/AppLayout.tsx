import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import NavBar from "../NavBar"; // keep this path/name if it's already working for you
import Container from "./Container";

export default function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const route = encodeURIComponent(location.pathname || "/");
    const icons: Record<string, string> = {
      svg: `${base}loopblog-icon-01.svg?v=3&route=${route}`,
      png: `${base}favicon-32x32.png?v=3&route=${route}`,
      ico: `${base}favicon.ico?v=3&route=${route}`,
    };

    Object.entries(icons).forEach(([kind, href]) => {
      const icon = document.querySelector<HTMLLinkElement>(
        `link[data-loopblog-favicon="${kind}"]`,
      );
      if (icon) icon.href = href;
    });
  }, [location.pathname]);

  return (
    <div className="appX">
      <NavBar />

      <main className="appMainX">
        <Container size="lg">
          <Outlet />
        </Container>
      </main>

      <footer className="footer"><span>© {new Date().getFullYear()} LoopBlog</span><span>Videos · music · journal</span></footer>
    </div>
  );
}
