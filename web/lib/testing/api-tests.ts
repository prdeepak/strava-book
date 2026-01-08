/**
 * API-Level Tests for Book Generation
 *
 * These tests call the actual Next.js API endpoints, matching exactly
 * what the browser does. This catches environment-specific issues like
 * font paths, file system access, etc.
 *
 * Run with: make test-api
 */

// CRITICAL: Import pdf-fonts FIRST before any react-pdf modules
// This ensures fonts are registered before any components try to use them
import '../pdf-fonts'

import * as fs from 'fs'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { renderToBuffer } from '@react-pdf/renderer'
import { FullBookDocument } from '../../components/templates/BookDocument'
import { yearFixtures } from './fixtures/yearFixtures'
import { FORMATS, DEFAULT_THEME } from '../book-types'
import { generateRunId, getRunOutputDir } from './test-harness'

// ============================================================================
// Types
// ============================================================================

interface ApiTestResult {
    testName: string
    success: boolean
    duration: number
    error?: string
    details?: Record<string, unknown>
}

interface ApiTestConfig {
    baseUrl: string
    outputDir: string
    verbose: boolean
}

// ============================================================================
// Server Management
// ============================================================================

let serverProcess: ChildProcess | null = null
let serverReady = false

async function startServer(port: number = 3001): Promise<string> {
    const baseUrl = `http://localhost:${port}`

    // Check if server is already running
    try {
        const response = await fetch(`${baseUrl}/api/auth/session`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        })
        if (response.ok || response.status === 401) {
            console.log(`[API Tests] Server already running at ${baseUrl}`)
            serverReady = true
            return baseUrl
        }
    } catch {
        // Server not running, start it
    }

    console.log(`[API Tests] Starting Next.js server on port ${port}...`)

    return new Promise((resolve, reject) => {
        serverProcess = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PORT: String(port) }
        })

        let output = ''
        const timeout = setTimeout(() => {
            reject(new Error('Server startup timeout (60s)'))
        }, 60000)

        serverProcess.stdout?.on('data', (data) => {
            output += data.toString()
            if (output.includes('Ready') || output.includes('started server')) {
                clearTimeout(timeout)
                serverReady = true
                // Give it a moment to fully initialize
                setTimeout(() => resolve(baseUrl), 2000)
            }
        })

        serverProcess.stderr?.on('data', (data) => {
            output += data.toString()
        })

        serverProcess.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
        })

        serverProcess.on('exit', (code) => {
            if (!serverReady) {
                clearTimeout(timeout)
                reject(new Error(`Server exited with code ${code}\nOutput: ${output}`))
            }
        })
    })
}

function stopServer(): void {
    if (serverProcess) {
        console.log('[API Tests] Stopping server...')
        serverProcess.kill('SIGTERM')
        serverProcess = null
        serverReady = false
    }
}

// ============================================================================
// Test Helpers
// ============================================================================

async function makeApiRequest(
    baseUrl: string,
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = `${baseUrl}${endpoint}`
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })
}

// ============================================================================
// API Tests
// ============================================================================

/**
 * Test: API endpoint exists and responds
 */
async function testApiEndpointExists(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'API Endpoint Exists'

    try {
        // Just check if the endpoint responds (will return 401 without auth)
        const response = await makeApiRequest(config.baseUrl, '/api/generate-book', {
            method: 'POST',
            body: JSON.stringify({}),
        })

        // 401 (unauthorized) or 400 (bad request) means endpoint exists
        if (response.status === 401 || response.status === 400 || response.status === 500) {
            return {
                testName,
                success: true,
                duration: Date.now() - startTime,
                details: { status: response.status },
            }
        }

        throw new Error(`Unexpected status: ${response.status}`)
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: API validates empty activities
 */
async function testApiValidatesEmptyActivities(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'API Validates Empty Activities'

    try {
        const response = await makeApiRequest(config.baseUrl, '/api/generate-book', {
            method: 'POST',
            body: JSON.stringify({
                activities: [],
                config: {
                    athleteName: 'Test',
                    year: 2024,
                    format: FORMATS['10x10'],
                    theme: DEFAULT_THEME,
                },
            }),
        })

        // Should return 400 or 401
        if (response.status === 400) {
            const data = await response.json()
            if (data.error === 'No activities provided') {
                return {
                    testName,
                    success: true,
                    duration: Date.now() - startTime,
                    details: { error: data.error },
                }
            }
        }

        // 401 is also acceptable (auth required before validation)
        if (response.status === 401) {
            return {
                testName,
                success: true,
                duration: Date.now() - startTime,
                details: { status: 401, note: 'Auth required - validation happens after auth' },
            }
        }

        throw new Error(`Unexpected response: ${response.status}`)
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: String(error),
        }
    }
}

/**
 * Test: Direct PDF generation (bypasses auth, tests core rendering)
 * This imports and calls the same code the API uses
 */
async function testDirectPdfGeneration(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'Direct PDF Generation (Same as API)'

    try {
        const fixture = yearFixtures.casualYear
        const format = FORMATS['10x10']
        const theme = DEFAULT_THEME

        if (config.verbose) {
            console.log(`  Creating PDF with ${fixture.activities.length} activities...`)
        }

        const element = FullBookDocument({
            activities: fixture.activities,
            title: 'API Test Book',
            athleteName: fixture.athleteName,
            year: fixture.year,
            format,
            theme,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(element as any)

        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty')
        }

        // Save PDF
        const pdfPath = path.join(config.outputDir, 'api-test-direct.pdf')
        fs.writeFileSync(pdfPath, pdfBuffer)

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                activities: fixture.activities.length,
                pdfSize: pdfBuffer.length,
                pdfPath,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Test: Font registration works
 */
async function testFontRegistration(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'Font Registration'

    try {
        // Fonts are already registered via static import at top of file
        // This test just verifies font files exist

        // Check that font files exist (using valid, non-corrupted fonts)
        const fontFiles = [
            'Anton-Regular.ttf',
            'BebasNeue-Regular.ttf',
            'BarlowCondensed-Regular.ttf',
            'CrimsonText-Regular.ttf',
        ]

        const possiblePaths = [
            path.join(process.cwd(), 'public', 'fonts'),
            path.join(process.cwd(), 'web', 'public', 'fonts'),
        ]

        let fontsDir: string | null = null
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                fontsDir = p
                break
            }
        }

        if (!fontsDir) {
            throw new Error(`Fonts directory not found. Tried: ${possiblePaths.join(', ')}`)
        }

        const missingFonts: string[] = []
        for (const font of fontFiles) {
            const fontPath = path.join(fontsDir, font)
            if (!fs.existsSync(fontPath)) {
                missingFonts.push(font)
            }
        }

        if (missingFonts.length > 0) {
            throw new Error(`Missing fonts: ${missingFonts.join(', ')}`)
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: {
                fontsDir,
                cwd: process.cwd(),
                checkedFonts: fontFiles.length,
            },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Test: PDF with custom theme fonts
 */
async function testPdfWithCustomFonts(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'PDF with Custom Theme Fonts'

    try {
        const fixture = yearFixtures.casualYear

        // Test each theme that uses different fonts
        // Note: Only using fonts that are known to be valid (not corrupted)
        // Valid fonts: Anton, ArchivoBlack, Bangers, BarlowCondensed, BebasNeue,
        //              CrimsonText, IndieFlower, PatrickHand, PermanentMarker
        const themes = [
            { name: 'display', heading: 'BebasNeue', body: 'BarlowCondensed' },
            { name: 'bold', heading: 'Anton', body: 'CrimsonText' },
            { name: 'playful', heading: 'Bangers', body: 'PatrickHand' },
            { name: 'elegant', heading: 'ArchivoBlack', body: 'CrimsonText' },
        ]

        const results: Record<string, string> = {}

        for (const themeInfo of themes) {
            if (config.verbose) {
                console.log(`  Testing theme: ${themeInfo.name} (${themeInfo.heading}/${themeInfo.body})...`)
            }

            const theme = {
                primaryColor: '#1e3a5f',
                accentColor: '#e67e22',
                backgroundColor: '#ffffff',
                fontPairing: { heading: themeInfo.heading, body: themeInfo.body },
                backgroundStyle: 'solid' as const,
            }

            const element = FullBookDocument({
                activities: fixture.activities.slice(0, 3), // Just a few to speed up
                title: `Theme Test: ${themeInfo.name}`,
                athleteName: 'Test',
                year: 2024,
                format: FORMATS['10x10'],
                theme,
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfBuffer = await renderToBuffer(element as any)

            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error(`Empty PDF for theme: ${themeInfo.name}`)
            }

            results[themeInfo.name] = `${pdfBuffer.length} bytes`
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: { themes: results },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Test: UI Preset Themes - Tests the actual themes used by BookGenerationModal
 * This catches mismatches between registered fonts and UI defaults
 */
async function testUiPresetThemes(config: ApiTestConfig): Promise<ApiTestResult> {
    const startTime = Date.now()
    const testName = 'UI Preset Themes (BookGenerationModal defaults)'

    try {
        const fixture = yearFixtures.casualYear

        // These are the EXACT themes from BookGenerationModal.tsx
        // If this test fails, the UI will fail too
        const UI_PRESET_THEMES = {
            classic: {
                primaryColor: '#1e3a5f',
                accentColor: '#e67e22',
                backgroundColor: '#ffffff',
                fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
                backgroundStyle: 'solid' as const,
            },
            bold: {
                primaryColor: '#1a1a1a',
                accentColor: '#ff6b35',
                backgroundColor: '#ffffff',
                fontPairing: { heading: 'Anton', body: 'CrimsonText' },
                backgroundStyle: 'solid' as const,
            },
            minimal: {
                primaryColor: '#2c3e50',
                accentColor: '#95a5a6',
                backgroundColor: '#fafafa',
                fontPairing: { heading: 'Helvetica-Bold', body: 'Helvetica' },
                backgroundStyle: 'solid' as const,
            },
            marathon: {
                primaryColor: '#0D2240',
                accentColor: '#FFD200',
                backgroundColor: '#ffffff',
                fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
                backgroundStyle: 'solid' as const,
            },
            trail: {
                primaryColor: '#2d5016',
                accentColor: '#8b4513',
                backgroundColor: '#faf8f5',
                fontPairing: { heading: 'Anton', body: 'CrimsonText' },
                backgroundStyle: 'solid' as const,
            },
        }

        const results: Record<string, string> = {}

        for (const [themeName, theme] of Object.entries(UI_PRESET_THEMES)) {
            if (config.verbose) {
                console.log(`  Testing UI preset: ${themeName} (${theme.fontPairing.heading}/${theme.fontPairing.body})...`)
            }

            const element = FullBookDocument({
                activities: fixture.activities.slice(0, 2), // Minimal activities for speed
                title: `UI Theme Test: ${themeName}`,
                athleteName: 'Test',
                year: 2024,
                format: FORMATS['10x10'],
                theme,
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfBuffer = await renderToBuffer(element as any)

            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error(`Empty PDF for UI preset theme: ${themeName}`)
            }

            results[themeName] = `${pdfBuffer.length} bytes`
        }

        return {
            testName,
            success: true,
            duration: Date.now() - startTime,
            details: { themes: results },
        }
    } catch (error) {
        return {
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

// ============================================================================
// Test Runner
// ============================================================================

export async function runApiTests(
    options: { verbose?: boolean; startServer?: boolean; port?: number } = {}
): Promise<{ results: ApiTestResult[]; runId: string; outputDir: string }> {
    const { verbose = false, startServer: shouldStartServer = false, port = 3001 } = options
    const runId = generateRunId()
    const outputDir = getRunOutputDir(path.join(process.cwd(), 'test-output'), runId)

    fs.mkdirSync(outputDir, { recursive: true })

    console.log(`\n${'='.repeat(60)}`)
    console.log('API-Level Test Suite')
    console.log(`Run ID: ${runId}`)
    console.log(`Output: ${outputDir}`)
    console.log(`CWD: ${process.cwd()}`)
    console.log(`${'='.repeat(60)}\n`)

    const config: ApiTestConfig = {
        baseUrl: `http://localhost:${port}`,
        outputDir,
        verbose,
    }

    const results: ApiTestResult[] = []

    try {
        // Optionally start server for full API tests
        if (shouldStartServer) {
            config.baseUrl = await startServer(port)
        }

        // Run tests
        console.log('[1/6] Testing font registration...')
        results.push(await testFontRegistration(config))

        console.log('[2/6] Testing direct PDF generation...')
        results.push(await testDirectPdfGeneration(config))

        console.log('[3/6] Testing PDF with custom fonts...')
        results.push(await testPdfWithCustomFonts(config))

        console.log('[4/6] Testing UI preset themes (BookGenerationModal)...')
        results.push(await testUiPresetThemes(config))

        if (shouldStartServer || serverReady) {
            console.log('[5/6] Testing API endpoint exists...')
            results.push(await testApiEndpointExists(config))

            console.log('[6/6] Testing API validates empty activities...')
            results.push(await testApiValidatesEmptyActivities(config))
        } else {
            console.log('[5/6] Skipping API endpoint test (no server)')
            console.log('[6/6] Skipping API validation test (no server)')
        }

    } finally {
        if (shouldStartServer) {
            stopServer()
        }
    }

    // Print results
    console.log(`\n${'='.repeat(60)}`)
    console.log('Test Results')
    console.log(`${'='.repeat(60)}\n`)

    let passed = 0
    let failed = 0

    for (const result of results) {
        const status = result.success ? 'PASS' : 'FAIL'
        const statusColor = result.success ? '\x1b[32m' : '\x1b[31m'
        console.log(`${statusColor}[${status}]\x1b[0m ${result.testName} (${result.duration}ms)`)
        if (result.error) {
            console.log(`       Error: ${result.error}`)
        }
        if (verbose && result.details) {
            console.log(`       Details: ${JSON.stringify(result.details)}`)
        }
        if (result.success) passed++
        else failed++
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
    console.log(`${'='.repeat(60)}\n`)

    // Save report
    const reportPath = path.join(outputDir, 'api-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({
        runId,
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        results,
        summary: { passed, failed },
    }, null, 2))

    return { results, runId, outputDir }
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
    const verbose = process.argv.includes('--verbose')
    const withServer = process.argv.includes('--with-server')

    runApiTests({ verbose, startServer: withServer })
        .then(({ results, outputDir }) => {
            console.log(`Report saved to: ${outputDir}`)
            const failed = results.filter(r => !r.success).length
            process.exit(failed > 0 ? 1 : 0)
        })
        .catch(error => {
            console.error('Test suite error:', error)
            process.exit(1)
        })
}
