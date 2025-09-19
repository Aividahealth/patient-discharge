"use client"

import Image from "next/image"
import { Heart, Shield, Globe, Mail, MapPin } from "lucide-react"

export function CommonFooter() {
  return (
    <footer className="bg-slate-100 text-slate-700 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Logo and Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-3">
              <Image
                src="/aivida-logo.png"
                alt="Aivida Healthcare Technologies"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-slate-900">Aivida Healthcare Technologies</span>
            </div>
            <p className="text-slate-600 mb-3 max-w-md text-sm">
              AI-powered solutions, guided by human expertise, to make healthcare communication clearer and hospital operations more efficient
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2 text-slate-600">
                <Shield className="h-3 w-3" />
                <span className="text-xs">HIPAA Compliant</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Globe className="h-3 w-3" />
                <span className="text-xs">Hospital Ready</span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-base font-semibold mb-3 text-slate-900">Contact</h3>
            <div className="space-y-2 text-slate-600">
              <div className="flex items-center space-x-2">
                <Mail className="h-3 w-3" />
                <span className="text-xs">ai@aividahealth.ai</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-3 w-3" />
                <span className="text-xs">Austin, TX</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-300 mt-4 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 text-slate-500 text-xs mb-2 md:mb-0">
              <span>© 2025 Aivida Healthcare Technologies. All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-4 text-slate-500 text-xs">
              <a href="#" className="hover:text-slate-700 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-slate-700 transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-slate-700 transition-colors">
                HIPAA Compliance
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
