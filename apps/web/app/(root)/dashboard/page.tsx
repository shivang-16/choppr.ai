import Sidebar from "./_components/sidebar";
import Topbar from "./_components/topbar";
import DashboardClient from "./_components/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <Topbar />
      <main className="ml-14 mt-12 flex-1 flex flex-col">
        <DashboardClient />
      </main>
    </div>
  );
}
