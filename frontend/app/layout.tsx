import "./globals.css";

export const metadata = {
  title: "Wiener-IA",
  description: "Wiener-IA — système d'intelligence artificielle cognitive."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
