import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Lockstep",
  description: "Paste a Postgres migration and get a grounded rollout note.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
