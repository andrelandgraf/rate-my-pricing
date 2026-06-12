import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full">
      <div className="mx-auto max-w-5xl px-4 pt-6 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-2xl animate-float-slow inline-block">💸</span>
          <span className="font-display font-extrabold text-xl tracking-tight">
            rate<span className="text-coral">my</span>pricing
          </span>
        </Link>
        <a
          href="https://github.com/andrelandgraf/rate-my-pricing"
          target="_blank"
          rel="noreferrer"
          className="chip text-sm hover:bg-marigold transition-colors"
        >
          ★ github
        </a>
      </div>
    </header>
  );
}
