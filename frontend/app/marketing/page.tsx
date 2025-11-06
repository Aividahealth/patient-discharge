import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart, Users, Shield, Globe } from "lucide-react"
import Link from "next/link"
import { PasswordProtection } from "@/components/password-protection"
import { CommonFooter } from "@/components/common-footer"

export default function MarketingPage() {
  return (
    <PasswordProtection correctPassword="Adyar2Austin">
      <div className="min-h-screen bg-white font-open-sans">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerner-blue text-white hover:bg-hover-blue transition-colors"
                >
                  <Heart className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">Aivida</h1>
                  <p className="text-sm text-gray-600">Discharge Instructions Platform</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="h-8 rounded-md px-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
                  <Link href="/login">Sign In</Link>
                </button>
                <button className="h-8 rounded-md px-3 bg-cerner-blue text-white hover:bg-hover-blue transition-colors text-sm font-medium">
                  <Link href="/login">Get Started</Link>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-16 px-4 bg-white">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="mb-6">
              <div className="inline-block bg-cerner-blue px-8 py-4 rounded-lg">
                <div className="text-white text-xl font-bold">Tackling $17B in Preventable Readmissions</div>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6 text-balance">
              Cut Preventable Readmissions. Boost Patient Satisfaction. Save Millions.
            </h2>
            <p className="text-lg text-gray-600 mb-8 text-pretty max-w-2xl mx-auto">
              Aivida is the AI-powered discharge companion that transforms complex medical instructions into clear,
              multilingual summaries with medication clarity, appointment scheduling, and 24/7 patient support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/patient" className="h-10 rounded-md px-6 bg-cerner-blue text-white hover:bg-hover-blue transition-colors font-medium inline-flex items-center justify-center">
                See the Patient Experience
              </Link>
              <Link href="/clinician" className="h-10 rounded-md px-6 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium inline-flex items-center justify-center">
                Explore Clinician Portal
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 px-4 bg-light-gray">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-800 mb-4">
                Three Connected Interfaces. One Seamless Discharge Experience.
              </h3>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Aivida empowers patients with clarity, clinicians with efficiency, and administrators with compliance and
                insights — all in one platform.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Patient Interface */}
              <Card className="border-2 hover:border-cerner-blue/50 transition-colors bg-white">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerner-blue text-white">
                      <Users className="h-5 w-5" />
                    </div>
                    <CardTitle>Patient Portal</CardTitle>
                  </div>
                  <CardDescription>
                    Clarity and confidence at discharge — so patients know what to do, when to do it, and why it matters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Personalized medication schedules with reminders</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Integrated follow-up appointment calendar</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Plain-language diet & activity guidance</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>24/7 AI companion for safe Q&A and multilingual support</span>
                  </div>
                </CardContent>
              </Card>

              {/* Clinician Interface */}
              <Card className="border-2 hover:border-cerner-blue/50 transition-colors bg-white">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerner-blue text-white">
                      <Shield className="h-5 w-5" />
                    </div>
                    <CardTitle>Clinician Dashboard</CardTitle>
                  </div>
                  <CardDescription>
                    AI-powered assistance that saves time, reduces burden, and keeps clinicians fully in control.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>AI-assisted draft generation of discharge instructions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Side-by-side editing interface for quick customization</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Prompts for required sections so nothing is missed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>One-click PDF export & print for patient records and EHR attachment</span>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Interface */}
              <Card className="border-2 hover:border-cerner-blue/50 transition-colors bg-white">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerner-blue text-white">
                      <Globe className="h-5 w-5" />
                    </div>
                    <CardTitle>Admin Control</CardTitle>
                  </div>
                  <CardDescription>
                    Enterprise-grade control for IT and leadership — secure, compliant, and measurable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>FHIR & HL7 integration setup for seamless EHR connectivity</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>User access & role management to safeguard data</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Audit trails for HIPAA/SOC2 compliance</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-cerner-blue rounded-full"></div>
                    <span>Readmission analytics to measure ROI and track quality metrics</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">
              Turn Discharge Clarity into Fewer Readmissions and Millions in Savings.
            </h3>
            <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
              Hospitals lose up to $15M each year from preventable readmissions. Aivida gives patients clarity, clinicians
              efficiency, and administrators insights — delivering measurable ROI from day one.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="h-10 rounded-md px-6 bg-cerner-blue text-white hover:bg-hover-blue transition-colors font-medium inline-flex items-center justify-center">
                Schedule Demo
              </Link>
              <Link href="/login" className="h-10 rounded-md px-6 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium inline-flex items-center justify-center">
                Access Documentation
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <CommonFooter />
      </div>
    </PasswordProtection>
  )
}
