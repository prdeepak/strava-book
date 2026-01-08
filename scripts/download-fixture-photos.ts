#!/usr/bin/env npx tsx
/**
 * Download photos from Strava fixtures and save locally
 * Updates fixture files to reference local paths
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

const FIXTURES_DIR = path.join(__dirname, '../web/lib/testing/fixtures')
const PHOTOS_DIR = path.join(FIXTURES_DIR, 'photos')

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true })
}

interface PhotoUrl {
    url: string
    localPath: string
    filename: string
}

function extractFilename(url: string): string {
    // Extract filename from URL like https://...cloudfront.net/abc123-768x576.jpg
    const match = url.match(/\/([^/]+)$/)
    return match ? match[1] : `photo-${Date.now()}.jpg`
}

async function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath)
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                const redirectUrl = response.headers.location
                if (redirectUrl) {
                    downloadFile(redirectUrl, destPath).then(resolve).catch(reject)
                    return
                }
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
                return
            }
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
        }).on('error', (err) => {
            fs.unlink(destPath, () => {}) // Delete partial file
            reject(err)
        })
    })
}

function findAllPhotoUrls(obj: unknown, urls: Set<string>): void {
    if (typeof obj !== 'object' || obj === null) return

    if (Array.isArray(obj)) {
        obj.forEach(item => findAllPhotoUrls(item, urls))
        return
    }

    for (const [key, value] of Object.entries(obj)) {
        if (key === '600' && typeof value === 'string' && value.startsWith('http')) {
            urls.add(value)
        } else if (typeof value === 'object') {
            findAllPhotoUrls(value, urls)
        }
    }
}

function replaceUrls(obj: unknown, urlMap: Map<string, string>): unknown {
    if (typeof obj !== 'object' || obj === null) return obj

    if (Array.isArray(obj)) {
        return obj.map(item => replaceUrls(item, urlMap))
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
        if ((key === '600' || key === '100') && typeof value === 'string') {
            // Replace with local path or keep original for 100 size
            const localPath = urlMap.get(value)
            if (localPath) {
                result[key] = localPath
            } else if (key === '100') {
                // For thumbnails, use the 600 version's local path if available
                const url600 = (obj as Record<string, unknown>)['600'] as string
                const local600 = urlMap.get(url600)
                result[key] = local600 || value
            } else {
                result[key] = value
            }
        } else if (typeof value === 'object') {
            result[key] = replaceUrls(value, urlMap)
        } else {
            result[key] = value
        }
    }
    return result
}

async function main() {
    console.log('Scanning fixtures for photo URLs...')

    // Collect all unique photo URLs
    const allUrls = new Set<string>()
    const fixtureFiles = fs.readdirSync(FIXTURES_DIR)
        .filter(f => f.endsWith('.json') && !f.includes('raw-activities') && !f.includes('all-fixtures'))

    const fixtures: Map<string, unknown> = new Map()

    for (const file of fixtureFiles) {
        const filePath = path.join(FIXTURES_DIR, file)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        fixtures.set(file, content)
        findAllPhotoUrls(content, allUrls)
    }

    console.log(`Found ${allUrls.size} unique photo URLs`)

    // Download photos
    const urlMap = new Map<string, string>()
    let downloaded = 0
    let skipped = 0

    for (const url of allUrls) {
        const filename = extractFilename(url)
        const localPath = path.join(PHOTOS_DIR, filename)
        const relativePath = `photos/${filename}`

        if (fs.existsSync(localPath)) {
            console.log(`  Skipping (exists): ${filename}`)
            skipped++
        } else {
            console.log(`  Downloading: ${filename}`)
            try {
                await downloadFile(url, localPath)
                downloaded++
            } catch (err) {
                console.error(`  Failed to download ${filename}:`, err)
                continue
            }
        }

        urlMap.set(url, relativePath)
    }

    console.log(`\nDownloaded: ${downloaded}, Skipped: ${skipped}`)

    // Update fixture files
    console.log('\nUpdating fixture files...')
    for (const [file, content] of fixtures) {
        const updated = replaceUrls(content, urlMap)
        const filePath = path.join(FIXTURES_DIR, file)
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2))
        console.log(`  Updated: ${file}`)
    }

    // Update all-fixtures.json too
    const allFixturesPath = path.join(FIXTURES_DIR, 'all-fixtures.json')
    if (fs.existsSync(allFixturesPath)) {
        const allFixtures = JSON.parse(fs.readFileSync(allFixturesPath, 'utf-8'))
        const updatedAll = replaceUrls(allFixtures, urlMap)
        fs.writeFileSync(allFixturesPath, JSON.stringify(updatedAll, null, 2))
        console.log('  Updated: all-fixtures.json')
    }

    console.log('\nDone! Photos saved to:', PHOTOS_DIR)
}

main().catch(console.error)
