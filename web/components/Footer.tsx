export default function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink/80">
      <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-medium text-ink-soft">
        <p>
          Built with a{" "}
          <a
            href="https://neon.com/docs/compute/functions/overview"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-wavy decoration-grape underline-offset-2"
          >
            Neon Function
          </a>{" "}
          agent + Postgres cache, on Vercel.
        </p>
        <p className="font-mono">made for fun · not affiliated with any rated site</p>
      </div>
    </footer>
  );
}
