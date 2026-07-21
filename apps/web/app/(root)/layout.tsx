import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DiscountOfferPopup } from "@/components/discount-offer-popup";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      {children}
      <DiscountOfferPopup />
    </>
  );
}
