"use client";

export default function Footer() {
  return (
    <footer className="w-full">
      <div className="bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#0f172a] py-6">
        <p className="text-center text-sm text-gray-400">
          © {new Date().getFullYear()} VidyaLabs — An Initiative by{" "}
          <span className="text-[#ff7a7a] font-medium">
            Cognio Labs
          </span>
        </p>
      </div>
    </footer>
  );
}
