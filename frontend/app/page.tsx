import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-open-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-semibold text-cerner-blue">
                Aivida Healthcare Technology
              </h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#about" className="text-gray-700 hover:text-cerner-blue transition-colors duration-200">
                About
              </a>
              <a href="#features" className="text-gray-700 hover:text-cerner-blue transition-colors duration-200">
                Features
              </a>
              <a href="#testimonials" className="text-gray-700 hover:text-cerner-blue transition-colors duration-200">
                Testimonials
              </a>
              <a href="#contact" className="text-gray-700 hover:text-cerner-blue transition-colors duration-200">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-5xl font-light text-cerner-blue mb-4">
            Aivida Health
          </h2>
          <p className="text-2xl font-light text-gray-800 mb-4 leading-relaxed">
            Solving multi-billion-dollar problems in patient care with AI.
          </p>
          <p className="text-xl font-light text-gray-600 leading-relaxed">
            AI-powered clarity for patients. Confidence for hospitals.
          </p>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="bg-light-gray py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-semibold text-gray-800 mb-6">
            Coming Soon
          </h3>
          <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
            Aivida Healthcare Technology is available for hospital pilots and research evaluations.
            Our demo runs securely in a HIPAA-compliant cloud environment and integrates with test or sandbox EHR data.
          </p>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-semibold text-gray-800 mb-6">
              About
            </h3>
            <div className="max-w-4xl mx-auto">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                We combine AI and human expertise to help hospitals make clinical communication clearer,
                more consistent, and compliant—driving measurable improvements in quality and operational performance.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Every deployment follows the highest privacy and security standards under HIPAA—keeping patient
                data protected while improving clarity and efficiency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Highlights */}
      <section id="features" className="bg-light-gray py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-4xl font-semibold text-gray-800 text-center mb-16">
            Key Highlights
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Human in the Loop */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-cerner-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                Human in the Loop
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Accuracy and oversight in every workflow
              </p>
            </div>

            {/* HIPAA Compliant */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-cerner-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                HIPAA Compliant
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Enterprise-grade privacy and security
              </p>
            </div>

            {/* Multilingual Support */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-cerner-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                Multilingual Support
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Inclusive communication for diverse patients
              </p>
            </div>

            {/* Hospital Ready */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-cerner-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                Hospital Ready
              </h4>
              <p className="text-gray-600 leading-relaxed">
                Integrates easily with sandbox or pilot environments
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-4xl font-semibold text-gray-800 text-center mb-16">
            Testimonials
          </h3>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Testimonial 1 */}
            <div className="bg-light-gray p-8 rounded-lg">
              <p className="text-lg text-gray-700 leading-relaxed mb-6 italic">
                "Aivida Healthcare Technology helps our teams explain care instructions clearly and consistently.
                It feels like an extra teammate focused on communication."
              </p>
              <p className="text-gray-800 font-semibold">
                — Chief Medical Officer
              </p>
              <p className="text-gray-600">
                Texas Regional Hospital
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-light-gray p-8 rounded-lg">
              <p className="text-lg text-gray-700 leading-relaxed mb-6 italic">
                "We've seen real improvements in patient understanding and follow-up.
                The platform is simple, secure, and easy to pilot."
              </p>
              <p className="text-gray-800 font-semibold">
                — VP Patient Experience
              </p>
              <p className="text-gray-600">
                Regional Health System
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contact" className="bg-cerner-blue py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-4xl font-semibold text-white mb-6">
            Ready to explore responsible AI for hospital communication?
          </h3>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-8">
            <a
              href="mailto:ai@aividahealth.ai"
              className="text-white text-lg hover:underline flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              ai@aividahealth.ai
            </a>
            <span className="text-white hidden sm:inline">•</span>
            <p className="text-white text-lg flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Austin, Texas
            </p>
          </div>
          <p className="text-white text-lg font-light">
            Aivida Healthcare Technology — HIPAA Compliant | Hospital Ready
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-footer text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">
            © 2025 Aivida Healthcare Technology, an AIMI Investments LLC company.
          </p>
        </div>
      </footer>
    </div>
  );
}
