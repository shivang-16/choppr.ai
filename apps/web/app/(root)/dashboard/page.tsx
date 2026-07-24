import Sidebar from "./_components/sidebar";
import Topbar from "./_components/topbar";
import DashboardClient from "./_components/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="md:ml-14 mt-0 md:mt-12 flex-1 flex flex-col pb-20 md:pb-0 overflow-y-auto">
        <DashboardClient />
      </main>
    </div>
  );
}
