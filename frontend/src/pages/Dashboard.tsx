import { Outlet, useMatch } from "react-router-dom";
import Sidebar from "../components/chat/Sidebar";

export default function Dashboard() {
  const hasSelectedChat = Boolean(useMatch("/dashboard/chat_room/:id"));

  return (
    <main className="flex h-dvh min-h-[420px] overflow-hidden bg-stone-50 text-stone-900">
      <Sidebar
        className={`w-full shrink-0 md:w-80 ${
          hasSelectedChat ? "hidden md:flex" : "flex"
        }`}
      />
      <section
        className={`min-h-0 flex-1 ${
          hasSelectedChat ? "flex w-full" : "hidden md:flex"
        }`}
      >
        <Outlet />
      </section>
    </main>
  );
}
