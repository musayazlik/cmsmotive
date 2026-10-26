import type { ReactNode } from "react";

const paths = {
  dashboard: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  calendar: "M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4",
  products: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9v9M3 8l9 4 9-4M7.5 5.5l9 5",
  billing: "M3 5h18v14H3V5Zm0 5h18M7 15h3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6",
  profile: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  external:
    "M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m6 9 6 6 6-6",
  mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
  signOut: "M9 3H3v18h6m0-9h12m-5-5 5 5-5 5",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4.3 13a1.9 1.9 0 0 0 3.4 0",
  check: "m5 12 5 5L20 7",
} as const;

export function AccountIcon({
  name,
  className,
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function AccountHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="customer-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AccountEmpty({
  icon,
  title,
  description,
  children,
  headingLevel = "h3",
}: {
  icon: keyof typeof paths;
  title: string;
  description: string;
  children?: ReactNode;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className="customer-empty">
      <span className="customer-empty-icon">
        <AccountIcon name={icon} />
      </span>
      <Heading>{title}</Heading>
      <p>{description}</p>
      {children}
    </div>
  );
}
