import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeBody from "@/components/HomeBody";
import { fetchLeaderboard } from "@/lib/api";
import type { SortKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = ["category", "worst", "best", "agent", "recent"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort: SortKey = SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "category";

  const ratings = await fetchLeaderboard(sort);

  return (
    <>
      <Header />
      <main className="flex-1">
        <HomeBody ratings={ratings} sort={sort} />
      </main>
      <Footer />
    </>
  );
}
