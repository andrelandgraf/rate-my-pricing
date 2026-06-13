import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink/80">
      <div className="mx-auto max-w-5xl px-4 py-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium text-ink-soft">
        <p>
          made by{" "}
          <a
            href="https://x.com/andrelandgraf"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ink underline decoration-wavy decoration-grape underline-offset-2 hover:text-grape transition-colors"
          >
            andrelandgraf
          </a>
        </p>
        <span aria-hidden className="text-ink/30">
          ·
        </span>
        <Link
          href="/the-heuristic"
          className="underline decoration-dotted underline-offset-2 hover:text-ink transition-colors"
        >
          the heuristic
        </Link>
      </div>
    </footer>
  );
}
