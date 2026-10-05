import type { ReactNode } from "react";

export const metadata = {
  title: "Lockstep",
  description: "Review a SQL migration before it ships.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
