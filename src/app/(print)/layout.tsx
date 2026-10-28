import './proposal.css';

// Print pages: no sidebar, white page, A4 sheets. The root layout still provides fonts and metadata.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#e9e6e2] py-6 print:bg-white print:py-0">{children}</div>;
}
