import Sidebar from "./Sidebar";
import BotaoTopo from "./BotaoTopo";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div id="scroll-container" className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
      <BotaoTopo />
    </div>
  );
}
