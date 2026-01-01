import fs from 'fs'
import path from 'path'
import { GuideContent } from './guide-content'

interface GuideDoc {
  slug: string
  title: string
  content: string
}

function formatTitle(filename: string): string {
  // Remove .md extension, replace dashes/underscores with spaces, capitalize each word
  return filename
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

async function getGuideDocs(): Promise<GuideDoc[]> {
  const docsDir = path.join(process.cwd(), 'docs', 'user')

  try {
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'))

    return files.map(filename => {
      const filePath = path.join(docsDir, filename)
      const content = fs.readFileSync(filePath, 'utf-8')
      const slug = filename.replace(/\.md$/, '')

      return {
        slug,
        title: formatTitle(filename),
        content,
      }
    }).sort((a, b) => a.title.localeCompare(b.title))
  } catch {
    return []
  }
}

export default async function GuidePage() {
  const docs = await getGuideDocs()

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-8">
        <h1 className="text-foreground mb-2">User Guide</h1>
        <p className="text-muted-foreground text-lg font-light">
          Help and documentation for using the inventory system
        </p>
      </header>

      {docs.length === 0 ? (
        <div className="border border-border rounded-sm p-8 text-center text-muted-foreground">
          <p>No guide documents found</p>
        </div>
      ) : (
        <GuideContent docs={docs} />
      )}
    </div>
  )
}
