export default function Footer() {
  return (
    <footer className="mt-16 border-t-[3px] border-ink/80">
      <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-center text-sm font-medium text-ink-soft">
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
      </div>
    </footer>
  );
}
