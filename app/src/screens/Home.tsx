// The shell's only screen (M0). Sign-in and the rest arrive with M1.
export function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-5 py-16">
      <h1 className="font-title text-5xl font-bold tracking-tight text-ink">MakonBook</h1>
      <p className="text-lg text-ink-2">
        SAT practice tests, vocabulary and classes for SAT MAKON students. The web version is being built;
        sign-in comes next.
      </p>
      <p className="text-ink-3">
        Students and teachers use the MakonBook app on their phones for now.
      </p>
    </main>
  );
}
