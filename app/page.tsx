import { TodoList } from "@/components/todo-list"
import type { Metadata } from "next"
import { appDescription, developer, siteUrl } from "@/lib/site-metadata"

export const metadata: Metadata = {
  alternates: siteUrl ? { canonical: siteUrl } : undefined,
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Tasks",
  description: appDescription,
  url: siteUrl,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern browser with JavaScript enabled",
  author: {
    "@type": "Person",
    "@id": `${developer.url}#person`,
    name: developer.name,
    url: developer.url,
    sameAs: developer.profiles,
  },
}

export default function Home() {
  return (
    <main className="h-full bg-background flex items-start justify-center px-4 overflow-x-hidden overflow-y-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <TodoList />
    </main>
  )
}
