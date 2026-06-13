import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

// Called by the Neon Function after it (re)generates a rating, so the page + social images
// drop their cached versions and re-render with the fresh scores.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/opengraph-image`);
  revalidatePath(`/${slug}/twitter-image`);
  revalidatePath("/");

  return NextResponse.json({ revalidated: true, slug });
}
