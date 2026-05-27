"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./Sidebar.css";
import {
  FiGrid,
  FiUsers,
  FiBarChart2,
  FiPhoneCall,
  FiTrendingUp,
  FiCreditCard,
  FiSettings,
  FiHelpCircle
} from "react-icons/fi";

const menuItems = [
  { label: "Dashboard", href: "/", icon: FiGrid },
  { label: "Clients", href: "/clients", icon: FiUsers },
  { label: "Leads", href: "/leads", icon: FiBarChart2 },
  { label: "AI Calls", href: "/ai-calls", icon: FiPhoneCall },
  // { label: "Analytics", href: "/analytics", icon: FiTrendingUp },
  { label: "Billing", href: "/billing", icon: FiCreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="ai-adminDash-sidebar">

      {/* Top Background */}
      <div className="ai-adminDash-topBg"></div>

      {/* Logo */}
      <div className="ai-adminDash-logo">
        <div className="ai-adminDash-logo-icon">
          <img
            src="https://res.cloudinary.com/dd9tagtiw/image/upload/v1777445405/Background_kpmrrs.png"
            alt="logo"
          />
        </div>
        <div>
          <h3>Editorial</h3>
          <p>INTELLIGENCE</p>
        </div>
      </div>

      {/* Menu */}
      <ul className="ai-adminDash-menu">
        {menuItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <li key={href} className={isActive ? "active" : ""}>
              <Link href={href} className="ai-adminDash-menu-link">
                <Icon /> <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Button */}
      <button className="ai-adminDash-btn">New Campaign</button>

      {/* Bottom */}
      <div className="ai-adminDash-bottom">
        <p><FiSettings /> Settings</p>
        <p><FiHelpCircle /> Support</p>
      </div>
    </div>
  );
}