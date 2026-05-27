"use client";
import "./BillingDash.css";
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiUpload,
  FiMoreVertical,
  FiFileText,
} from "react-icons/fi";

const data = [
  {
    id: "P10001",
    date: "Feb 14, 2025",
    name: "James Anderson",
    status: "Paid",
    staff: "Bessie Cooper",
    avatar: "https://i.pravatar.cc/32?img=1",
    service: "Diagnostic Evaluation",
    price: "$160.00",
  },
  {
    id: "P10002",
    date: "Apr 22, 2025",
    name: "Alexander Ivanov",
    status: "Paid",
    staff: "Leslie Alexander",
    avatar: "https://i.pravatar.cc/32?img=2",
    service: "Company ITD Solution",
    price: "$267.00",
  },
  {
    id: "P10003",
    date: "Apr 22, 2024",
    name: "Hugo Fernández",
    status: "Overdue",
    staff: "Ralph Edwards",
    avatar: "https://i.pravatar.cc/32?img=3",
    service: "Appointment Add-on",
    price: "$267.18",
  },
  {
    id: "P10004",
    date: "Jun 18, 2025",
    name: "Savannah Nguyen",
    status: "Unpaid",
    staff: "Savannah Nguyen",
    avatar: "https://i.pravatar.cc/32?img=4",
    service: "Standard Appointment",
    price: "$310.30",
  },
  {
    id: "P10005",
    date: "Jun 18, 2025",
    name: "Hugo Fernández",
    status: "Paid",
    staff: "Ralph Edwards",
    avatar: "https://i.pravatar.cc/32?img=4",
    service: "Standard Appointment",
    price: "$153.30",
  },
];

export default function InvoicesPage() {
  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="header">
          <h2>Billing</h2>

          <div className="actions">
            <button className="btn ghost">
              <FiDownload /> Export
            </button>
            <button className="btn ghost">
              <FiUpload /> Import
            </button>
            <button className="btn primary">+ New Invoice</button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="card">
            <p>In Transit</p>
            <h3>$2,307.40</h3>
            <span>Last update: Jan 24</span>
          </div>
          <div className="card">
            <p>Total Paid</p>
            <h3>$34,307.40</h3>
            <span>Last update: Jan 24</span>
          </div>
          <div className="card">
            <p>Total Unpaid</p>
            <h3>$34,307.40</h3>
            <span>Last update: Jan 24</span>
          </div>
          <div className="card">
            <p>Total Overdue</p>
            <h3>$256.87</h3>
            <span>Last update: Jan 24</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="tabs">
            <button className="tab active">All</button>
            <button className="tab">Paid</button>
            <button className="tab">Unpaid</button>
            <button className="tab">Overdue</button>
          </div>

          <div className="right">
            <div className="search">
              <FiSearch />
              <input placeholder="Search..." />
            </div>
            <button className="btn ghost">
              <FiFilter /> Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Billing ID</th>
                <th>Issue Date</th>
                <th>Client Name</th>
                <th>Status</th>
                <th>Assigned Staff</th>
                <th>Services</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {data.map((item, i) => (
                <tr key={i}>
                  <td>
                    <input type="checkbox" />
                  </td>

                  <td className="invoiceId">
                    <FiFileText />
                    {item.id}
                  </td>

                  <td>{item.date}</td>
                  <td>{item.name}</td>

                  <td>
                    <span className={`status ${item.status.toLowerCase()}`}>
                      <span className="dot" />
                      {item.status}
                    </span>
                  </td>

                  <td className="staff">
                    <img src={item.avatar} />
                    {item.staff}
                  </td>

                  <td>{item.service}</td>
                  <td className="price">{item.price}</td>

                  <td>
                    <FiMoreVertical />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="tableFooter">
            <span>Showing 1–4 of 134 entries</span>

            <div className="pagination">
              <button>{"<"}</button>
              <button className="active">1</button>
              <button>2</button>
              <button>3</button>
              <button>...</button>
              <button>12</button>
              <button>{">"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
