import type { ReactNode } from "react";
import Navbar from "../NavBar";
import Container from "./Container";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="appX">
      <Navbar />

      <main className="appMainX">
        <Container as="div" size="lg">
          {children}
        </Container>
      </main>

      <footer className="footer">© {new Date().getFullYear()} LoopBlog</footer>
    </div>
  );
}
