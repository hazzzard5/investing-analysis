import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Investing Analysis", description: "Multi-agent research and paper portfolio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Investing Analysis</Link>
          <Link href="/tracker">Trade tracker</Link>
          <span className="muted">Paper trading only. Research, not financial advice. You make the decisions.</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
