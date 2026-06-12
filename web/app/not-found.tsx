import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 grid place-items-center px-4 py-24">
        <div className="card card-lg p-10 text-center max-w-md">
          <div className="text-6xl mb-4 animate-float-slow">🧐</div>
          <h1 className="font-display font-extrabold text-3xl">Nothing rated here… yet</h1>
          <p className="mt-2 text-ink-soft font-medium">
            We haven&apos;t scored this page. Head back and paste the URL to kick off the agent.
          </p>
          <Link href="/" className="btn-pop inline-block mt-6 bg-coral px-6 py-3">
            ← Back to the leaderboard
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
