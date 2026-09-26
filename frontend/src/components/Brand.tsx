export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <svg aria-label="Float" className={`brand ${compact ? 'brand--compact' : ''}`} fill="currentColor" role="img" viewBox="0 0 274 60">
      <path d="M0 0h41v12H14v13h24v12H14v23H0zM51 0h14v48h27v12H51zM123 0c18 0 27 11 27 30s-9 30-27 30-27-11-27-30 9-30 27-30zm0 12c-9 0-13 6-13 18s4 18 13 18 13-6 13-18-4-18-13-18zM171 0h17l21 60h-15l-4-13h-21l-4 13h-15zm2 35h13l-6-21zM205 0h47v12h-16v48h-14V12h-17z" fillRule="evenodd" />
      <path d="M261 47h13v13h-13z" fill="#f45b24" />
    </svg>
  );
}
