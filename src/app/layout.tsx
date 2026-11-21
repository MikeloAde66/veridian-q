import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veridian Q",
  description: "Veridian Q -- digital canvas and drawing studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
