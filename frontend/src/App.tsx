import { Outlet } from "react-router-dom";
import SideNav from "./components/SideNav";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--void)" }}>
      {/* Floating orbs — global atmosphere */}
      <div className="orb orb-acid fixed" style={{ top: "-150px", left: "-100px", zIndex: 0 }} />
      <div className="orb orb-plasma fixed" style={{ bottom: "-100px", right: "-80px", zIndex: 0 }} />
      <div className="orb orb-cyan fixed" style={{ top: "40%", left: "40%", zIndex: 0 }} />

      <SideNav />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <Outlet />
      </div>
    </div>
  );
}
