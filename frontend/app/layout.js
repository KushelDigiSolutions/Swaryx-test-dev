
import { Poppins } from "next/font/google";
import "./globals.css";
import Navbar from "./COMMON/Navbar";
import Sidebar from "./COMMON/Sidebar";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "AI Calling Dashboard",
  description: "A modern dashboard for managing AI calling campaigns, tracking leads, and analyzing performance.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-screen min-w-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] font-sans">
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 ml-[240px] pt-[70px]">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}