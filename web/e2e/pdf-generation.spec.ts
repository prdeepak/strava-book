import { test, expect } from '@playwright/test'

/**
 * PDF Generation API E2E Tests
 *
 * These tests verify that PDF generation works correctly by actually
 * calling the API endpoint and rendering PDFs. This catches:
 * - Font registration errors ("Unknown font format")
 * - Missing font files
 * - Invalid font configurations
 * - PDF rendering issues
 *
 * IMPORTANT: These tests catch errors that the UI-only tests miss,
 * such as font errors that only appear during actual PDF rendering.
 */

test.describe('PDF Generation API', () => {
  // All preset themes that should be tested
  const THEMES = ['classic', 'bold', 'minimal', 'marathon', 'trail']

  test.describe('Theme PDF Generation', () => {
    for (const theme of THEMES) {
      test(`should generate valid PDF with ${theme} theme`, async ({ request }) => {
        // Call the test endpoint with the theme
        const response = await request.get(`/api/test/generate-book?theme=${theme}`)

        // Should return 200 OK
        expect(response.status()).toBe(200)

        // Should have PDF content type
        expect(response.headers()['content-type']).toBe('application/pdf')

        // Get the response body
        const buffer = await response.body()

        // PDF should have content
        expect(buffer.length).toBeGreaterThan(0)

        // PDF should start with %PDF (PDF magic bytes)
        const pdfHeader = buffer.slice(0, 4).toString()
        expect(pdfHeader).toBe('%PDF')

        // Log success for visibility in CI
        console.log(`[PDF Test] ${theme} theme: ${buffer.length} bytes, render time: ${response.headers()['x-render-time']}ms`)
      })
    }
  })

  test.describe('Custom Theme PDF Generation', () => {
    test('should generate PDF with custom font pairing', async ({ request }) => {
      const customTheme = {
        primaryColor: '#1a1a1a',
        accentColor: '#3b82f6',
        backgroundColor: '#ffffff',
        fontPairing: {
          heading: 'Oswald',
          body: 'OpenSans',
        },
        backgroundStyle: 'solid' as const,
      }

      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: customTheme,
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')

      const buffer = await response.body()
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    })

    test('should generate PDF with serif body font', async ({ request }) => {
      const customTheme = {
        primaryColor: '#1a1a1a',
        accentColor: '#10b981',
        backgroundColor: '#ffffff',
        fontPairing: {
          heading: 'PlayfairDisplay',
          body: 'Lora',
        },
        backgroundStyle: 'solid' as const,
      }

      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: customTheme,
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')

      const buffer = await response.body()
      expect(buffer.length).toBeGreaterThan(0)
    })

    test('should generate PDF with condensed fonts', async ({ request }) => {
      const customTheme = {
        primaryColor: '#1a1a1a',
        accentColor: '#f59e0b',
        backgroundColor: '#ffffff',
        fontPairing: {
          heading: 'RobotoCondensed',
          body: 'BarlowCondensed',
        },
        backgroundStyle: 'solid' as const,
      }

      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: customTheme,
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')

      const buffer = await response.body()
      expect(buffer.length).toBeGreaterThan(0)
    })

    test('should generate PDF with built-in Helvetica fonts', async ({ request }) => {
      const customTheme = {
        primaryColor: '#333333',
        accentColor: '#666666',
        backgroundColor: '#fafafa',
        fontPairing: {
          heading: 'Helvetica-Bold',
          body: 'Helvetica',
        },
        backgroundStyle: 'solid' as const,
      }

      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: customTheme,
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')

      const buffer = await response.body()
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  test.describe('Error Handling', () => {
    test('should return error details on font failure', async ({ request }) => {
      // Use an invalid/unregistered font to test error handling
      const invalidTheme = {
        primaryColor: '#1a1a1a',
        accentColor: '#ff0000',
        backgroundColor: '#ffffff',
        fontPairing: {
          heading: 'NonExistentFont',
          body: 'AnotherFakeFont',
        },
        backgroundStyle: 'solid' as const,
      }

      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: invalidTheme,
        },
      })

      // Should return 500 with error details
      // Note: react-pdf may fall back to default font, so this might still succeed
      // The important thing is that we get a response
      const status = response.status()
      if (status === 500) {
        const body = await response.json()
        expect(body.error).toBeDefined()
        expect(body.details).toBeDefined()
        console.log(`[PDF Test] Expected error for invalid fonts: ${body.details}`)
      } else {
        // If it succeeds (font fallback), just verify it's a valid PDF
        expect(status).toBe(200)
        const buffer = await response.body()
        expect(buffer.slice(0, 4).toString()).toBe('%PDF')
      }
    })
  })

  test.describe('Format Variations', () => {
    test('should generate PDF in 8x8 format', async ({ request }) => {
      const response = await request.post('/api/test/generate-book', {
        data: {
          format: {
            size: '8x8',
            dimensions: { width: 576, height: 576 },
            bleed: 9,
            safeMargin: 36,
            scaleFactor: 0.8,
          },
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')
    })

    test('should generate PDF in 12x12 format', async ({ request }) => {
      const response = await request.post('/api/test/generate-book', {
        data: {
          format: {
            size: '12x12',
            dimensions: { width: 864, height: 864 },
            bleed: 9,
            safeMargin: 54,
            scaleFactor: 1.2,
          },
        },
      })

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toBe('application/pdf')
    })
  })
})

/**
 * Smoke test for all registered fonts
 *
 * This test iterates through font combinations to ensure
 * all fonts are properly registered and can be used.
 */
test.describe('Font Registration Smoke Tests', () => {
  // Test common heading + body combinations
  const FONT_COMBINATIONS = [
    { heading: 'BebasNeue', body: 'BarlowCondensed' },
    { heading: 'Anton', body: 'CrimsonText' },
    { heading: 'Oswald', body: 'Roboto' },
    { heading: 'ArchivoBlack', body: 'OpenSans' },
    { heading: 'Montserrat', body: 'Merriweather' },
    { heading: 'PlayfairDisplay', body: 'Lora' },
    { heading: 'Inter', body: 'Inter' },
  ]

  for (const combo of FONT_COMBINATIONS) {
    test(`should render PDF with ${combo.heading} + ${combo.body}`, async ({ request }) => {
      const response = await request.post('/api/test/generate-book', {
        data: {
          theme: {
            primaryColor: '#1a1a1a',
            accentColor: '#ff6b35',
            backgroundColor: '#ffffff',
            fontPairing: combo,
            backgroundStyle: 'solid',
          },
        },
      })

      expect(response.status()).toBe(200)
      const buffer = await response.body()
      expect(buffer.slice(0, 4).toString()).toBe('%PDF')
    })
  }
})
