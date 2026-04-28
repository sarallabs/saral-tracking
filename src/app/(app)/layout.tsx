import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const status = (session.user as { status?: string }).status;
  if (status === "pending") {
    redirect("/pending");
  }

  const isGlobalAdmin = (session.user as { isGlobalAdmin?: boolean }).isGlobalAdmin ?? false;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          isGlobalAdmin,
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
