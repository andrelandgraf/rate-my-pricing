import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeBody from "@/components/HomeBody";
import { fetchLeaderboard } from "@/lib/api";
import { CATEGORY_ORDER, type SortKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = ["worst", "best", "agent", "recent"];
const CATEGORIES = [...CATEGORY_ORDER, "all"] as string[];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; category?: string }>;
}) {
  const params = await searchParams;
  const sort: SortKey = SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "best";
  const category =
    params.category && CATEGORIES.includes(params.category) ? params.category : "devtools";

  const ratings = await fetchLeaderboard(sort, category);

  return (
    <>
      <Header />
      <main className="flex-1">
        <HomeBody ratings={ratings} sort={sort} category={category} />
      </main>
      <Footer />
    </>
  );
}
