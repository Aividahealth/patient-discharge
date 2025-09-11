import Image from "next/image"
import { CommonHeader } from "@/components/common-header"
import { CommonFooter } from "@/components/common-footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CommonHeader />
      
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8 max-w-4xl px-4">
          <div className="flex justify-center mb-8">
            <Image
              src="/aivida-logo.png"
              alt="Aivida Health"
              width={120}
              height={120}
              className="rounded-2xl shadow-lg"
            />
          </div>
          <h1 className="text-6xl md:text-8xl font-bold text-foreground">
            Aivida Health
          </h1>
          <h2 className="text-2xl md:text-4xl font-semibold text-purple-600">
            Solving multi-billion-dollar problems in patient care with AI.
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Coming soon
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            AividaHealth.ai is available for hospital pilots today. Our demo runs securely in a HIPAA-compliant cloud
            environment and integrates with test or sandbox data.
          </p>
        </div>
      </main>
      
      <CommonFooter />
    </div>
  )
}