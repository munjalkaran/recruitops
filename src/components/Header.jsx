export default function Header({ pageTitle }) {
  return (
    <header className="glass-header sticky top-0 z-20 border-b border-app px-4 py-2.5 sm:px-6 lg:px-10">
      <div className="flex min-h-8 items-center pl-12 lg:pl-0">
        <h1 className="text-base font-semibold tracking-tight text-primary">{pageTitle}</h1>
      </div>
    </header>
  );
}
