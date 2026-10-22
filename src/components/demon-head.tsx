// Demon head drawn in the logo's line style: horns, pointed chin, slanted eyes, sly smile
export function DemonHead(props: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <DemonHeadPaths />
    </svg>
  );
}

// The head's lines in a 24 by 24 box, for drawings that put the head on a body
export function DemonHeadPaths() {
  return (
    <>
      <path d="M12 6.5C8.6 6.5 6 8.9 6 12.3c0 4.1 2.9 7.5 6 9.2 3.1-1.7 6-5.1 6-9.2 0-3.4-2.6-5.8-6-5.8Z" />
      <path d="M7.4 8.7C4.9 7.6 3.5 5.2 3.5 2.5c1.5 2 3.8 3.3 6.7 4.3" />
      <path d="M16.6 8.7c2.5-1.1 3.9-3.5 3.9-6.2-1.5 2-3.8 3.3-6.7 4.3" />
      <path d="M8.2 11.6c1.3.3 2.5 1 3.1 1.9-1.5.4-2.7-.3-3.1-1.9Z" fill="currentColor" stroke="none" />
      <path d="M15.8 11.6c-1.3.3-2.5 1-3.1 1.9 1.5.4 2.7-.3 3.1-1.9Z" fill="currentColor" stroke="none" />
      <path d="M8.6 15.2c.3.5.6.8.9 1 1.5 1.2 3.5 1.2 5 0 .3-.2.6-.5.9-1" />
    </>
  );
}
