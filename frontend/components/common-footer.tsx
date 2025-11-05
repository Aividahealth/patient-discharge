"use client"

export function CommonFooter() {
  return (
    <footer className="bg-slate-100 text-slate-600 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-semibold text-slate-700">Aivida Health</span>
            <span>•</span>
            <span>© 2025 All rights reserved</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-slate-800 transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="#" className="hover:text-slate-800 transition-colors">
              Terms of Service
            </a>
            <span>•</span>
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
