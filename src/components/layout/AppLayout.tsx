import { Outlet } from "react-router-dom";
import NavBar from "../NavBar"; // keep this path/name if it's already working for you
import Container from "./Container";

export default function AppLayout() {
  return (
    <div className="appX">
      <NavBar />

      <main className="appMainX">
        <Container size="lg">
          <Outlet />
        </Container>
      </main>

      <footer className="footer">© {new Date().getFullYear()} LoopBlog</footer>
    </div>
  );
}
