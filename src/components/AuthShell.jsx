/* Split layout shared by the sign-in, forgot-password and reset-password pages:
   brand panel on the left (large screens), the form on the right. */
export default function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: 'radial-gradient(900px 500px at 90% -10%, rgba(154,106,242,.55), transparent 60%), radial-gradient(700px 500px at -10% 110%, rgba(90,36,176,.7), transparent 60%), linear-gradient(160deg, #150E24 0%, #2A1B4D 60%, #3B2270 100%)' }}
      >
        <img src="/brand/logo-horizontal-white.png" alt="NandiVex Technologies" className="h-12 w-auto self-start" />

        <div className="relative z-10 max-w-md">
          <h1 className="text-[44px] font-extrabold leading-[1.08]">Software, apps and automation for businesses.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/70">Welcome to NandiVex Technologies.</p>
        </div>

        <p className="relative z-10 text-xs text-white/45">© {new Date().getFullYear()} NandiVex Technologies. All rights reserved.</p>
        <img src="/brand/app-icon-violet.png" alt="" aria-hidden="true" className="float-slow pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-[64px] opacity-[.12]" />
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col bg-paper">
        <div className="px-5 py-5 sm:px-8 lg:hidden">
          <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="page-in w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
