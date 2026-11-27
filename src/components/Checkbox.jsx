/* A checkbox that matches the app: a rounded box with a check mark, a visible focus ring, and a label
   that is part of the click target. The real <input> stays in the page (visually hidden) for keyboards and screen readers. */
export default function Checkbox({ checked, onChange, children, className = '', ...rest }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-sm ${className}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" {...rest} />
      <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-md border border-line bg-surface text-white transition peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/20 peer-checked:[&_svg]:opacity-100">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-0 transition-opacity">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}
