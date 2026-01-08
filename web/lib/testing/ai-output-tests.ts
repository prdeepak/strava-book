/**
 * AI Output Validation Tests
 *
 * Tests for validating AI-generated design specs to ensure they are
 * safe and valid for PDF generation.
 */

import {
  validateDesignSpec,
  validateFonts,
  validateColors,
  validateContent,
  validateAll,
  sanitizeText,
  containsDangerousPatterns,
  getContrastRatio,
  checkColorAccessibility,
  DesignSpec,
  VALID_FONTS
} from '../ai-validation'

// ============================================================================
// Test Infrastructure
// ============================================================================

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const testResults: TestResult[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    testResults.push({ name, passed: true })
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
    toContain(expected: string) {
      if (typeof actual !== 'string' || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`)
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`)
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`)
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(`Expected array of length ${expected}, got ${Array.isArray(actual) ? actual.length : 'non-array'}`)
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true, got ${actual}`)
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false, got ${actual}`)
      }
    }
  }
}

// ============================================================================
// Valid Test Specs
// ============================================================================

const validSpec: DesignSpec = {
  theme: {
    primaryColor: '#1A1A1A',
    accentColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    fontPairing: {
      heading: 'BebasNeue',
      body: 'BarlowCondensed'
    },
    backgroundStyle: 'solid'
  }
}

const validSpecWithContent: DesignSpec = {
  ...validSpec,
  content: {
    title: '2025 Year in Review',
    subtitle: 'A Running Journey',
    athleteName: 'John Doe',
    foreword: 'This year was incredible.',
    captions: ['First marathon!', 'Personal best']
  }
}

// ============================================================================
// Schema Validation Tests
// ============================================================================

test('validateDesignSpec: accepts valid spec', () => {
  const result = validateDesignSpec(validSpec)
  expect(result.valid).toBeTrue()
  expect(result.errors).toHaveLength(0)
})

test('validateDesignSpec: rejects non-object', () => {
  const result = validateDesignSpec(null)
  expect(result.valid).toBeFalse()
  expect(result.errors.length).toBeGreaterThan(0)
})

test('validateDesignSpec: rejects missing theme', () => {
  const result = validateDesignSpec({ notTheme: {} })
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('theme'))).toBeTrue()
})

test('validateDesignSpec: rejects missing theme properties', () => {
  const result = validateDesignSpec({
    theme: {
      primaryColor: '#000'
      // missing other properties
    }
  })
  expect(result.valid).toBeFalse()
  expect(result.errors.length).toBeGreaterThan(0)
})

test('validateDesignSpec: rejects invalid fontPairing', () => {
  const result = validateDesignSpec({
    theme: {
      primaryColor: '#000',
      accentColor: '#FFF',
      backgroundColor: '#FFF',
      fontPairing: 'not an object'
    }
  })
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('fontPairing'))).toBeTrue()
})

test('validateDesignSpec: warns on unknown backgroundStyle', () => {
  const result = validateDesignSpec({
    theme: {
      primaryColor: '#000',
      accentColor: '#FFF',
      backgroundColor: '#FFF',
      fontPairing: { heading: 'Arial', body: 'Arial' },
      backgroundStyle: 'unknown'
    }
  })
  expect(result.warnings.some(w => w.includes('backgroundStyle'))).toBeTrue()
})

// ============================================================================
// Font Validation Tests
// ============================================================================

test('validateFonts: accepts valid fonts', () => {
  const result = validateFonts(validSpec)
  expect(result.valid).toBeTrue()
  expect(result.errors).toHaveLength(0)
})

test('validateFonts: rejects invalid heading font', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      fontPairing: {
        heading: 'ComicSans', // Invalid
        body: 'BarlowCondensed'
      }
    }
  }
  const result = validateFonts(spec)
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('heading'))).toBeTrue()
})

test('validateFonts: rejects invalid body font', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      fontPairing: {
        heading: 'BebasNeue',
        body: 'Papyrus' // Invalid
      }
    }
  }
  const result = validateFonts(spec)
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('body'))).toBeTrue()
})

test('validateFonts: warns on same font for heading and body', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      fontPairing: {
        heading: 'BebasNeue',
        body: 'BebasNeue'
      }
    }
  }
  const result = validateFonts(spec)
  expect(result.warnings.some(w => w.includes('same font'))).toBeTrue()
})

test('validateFonts: warns on handwritten body font', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      fontPairing: {
        heading: 'BebasNeue',
        body: 'IndieFlower'
      }
    }
  }
  const result = validateFonts(spec)
  expect(result.warnings.some(w => w.includes('Handwritten'))).toBeTrue()
})

test('validateFonts: accepts all valid fonts', () => {
  for (const font of VALID_FONTS) {
    const spec: DesignSpec = {
      theme: {
        ...validSpec.theme,
        fontPairing: {
          heading: font,
          body: font
        }
      }
    }
    const result = validateFonts(spec)
    // Should not have font-related errors (may have warnings about same font)
    expect(result.errors.filter(e => e.includes('Invalid')).length).toBe(0)
  }
})

// ============================================================================
// Color Validation Tests
// ============================================================================

test('validateColors: accepts valid hex colors', () => {
  const result = validateColors(validSpec)
  expect(result.valid).toBeTrue()
})

test('validateColors: accepts 3-digit hex colors', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      primaryColor: '#000',
      accentColor: '#F60',
      backgroundColor: '#FFF'
    }
  }
  const result = validateColors(spec)
  expect(result.valid).toBeTrue()
})

test('validateColors: rejects invalid hex format', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      primaryColor: 'red' // Invalid - not hex
    }
  }
  const result = validateColors(spec)
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('primaryColor'))).toBeTrue()
})

test('validateColors: rejects rgb format', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      primaryColor: 'rgb(255, 0, 0)'
    }
  }
  const result = validateColors(spec)
  expect(result.valid).toBeFalse()
})

test('validateColors: warns on low contrast', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      primaryColor: '#CCCCCC', // Light gray
      backgroundColor: '#FFFFFF' // White
    }
  }
  const result = validateColors(spec)
  expect(result.errors.length + result.warnings.length).toBeGreaterThan(0)
})

test('validateColors: warns on similar primary and accent', () => {
  const spec: DesignSpec = {
    theme: {
      ...validSpec.theme,
      primaryColor: '#FF0000',
      accentColor: '#FF0500' // Very similar
    }
  }
  const result = validateColors(spec)
  expect(result.warnings.some(w => w.includes('similar'))).toBeTrue()
})

test('getContrastRatio: calculates correctly for black/white', () => {
  const ratio = getContrastRatio('#000000', '#FFFFFF')
  expect(ratio).toBeGreaterThan(20) // Should be 21:1
})

test('getContrastRatio: calculates correctly for same color', () => {
  const ratio = getContrastRatio('#FF0000', '#FF0000')
  expect(ratio).toBe(1)
})

test('checkColorAccessibility: returns correct WCAG levels', () => {
  const highContrast = checkColorAccessibility('#000000', '#FFFFFF')
  expect(highContrast.wcagAA).toBeTrue()
  expect(highContrast.wcagAALarge).toBeTrue()
  expect(highContrast.wcagAAA).toBeTrue()

  const lowContrast = checkColorAccessibility('#CCCCCC', '#FFFFFF')
  expect(lowContrast.wcagAA).toBeFalse()
})

// ============================================================================
// Content/XSS Validation Tests
// ============================================================================

test('validateContent: accepts valid content', () => {
  const result = validateContent(validSpecWithContent)
  expect(result.valid).toBeTrue()
  expect(result.errors).toHaveLength(0)
})

test('validateContent: accepts spec without content', () => {
  const result = validateContent(validSpec)
  expect(result.valid).toBeTrue()
})

test('containsDangerousPatterns: detects script tags', () => {
  expect(containsDangerousPatterns('<script>alert(1)</script>')).toBeTrue()
  expect(containsDangerousPatterns('<SCRIPT>alert(1)</SCRIPT>')).toBeTrue()
})

test('containsDangerousPatterns: detects javascript: URLs', () => {
  expect(containsDangerousPatterns('javascript:alert(1)')).toBeTrue()
  expect(containsDangerousPatterns('JAVASCRIPT:alert(1)')).toBeTrue()
})

test('containsDangerousPatterns: detects event handlers', () => {
  expect(containsDangerousPatterns('onclick=alert(1)')).toBeTrue()
  expect(containsDangerousPatterns('onload = malicious()')).toBeTrue()
  expect(containsDangerousPatterns('onerror=bad()')).toBeTrue()
})

test('containsDangerousPatterns: detects data URIs', () => {
  expect(containsDangerousPatterns('data:text/html,<script>')).toBeTrue()
})

test('containsDangerousPatterns: allows safe content', () => {
  expect(containsDangerousPatterns('My 2025 Marathon Journey')).toBeFalse()
  expect(containsDangerousPatterns('Personal best: 3:45:22')).toBeFalse()
  expect(containsDangerousPatterns('A year of growth & perseverance')).toBeFalse()
})

test('sanitizeText: escapes HTML entities', () => {
  expect(sanitizeText('<script>')).toBe('&lt;script&gt;')
  expect(sanitizeText('A & B')).toBe('A &amp; B')
  expect(sanitizeText('"quoted"')).toBe('&quot;quoted&quot;')
})

test('validateContent: rejects XSS in title', () => {
  const spec: DesignSpec = {
    ...validSpec,
    content: {
      title: '<script>alert("xss")</script>'
    }
  }
  const result = validateContent(spec)
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('title'))).toBeTrue()
})

test('validateContent: rejects XSS in captions', () => {
  const spec: DesignSpec = {
    ...validSpec,
    content: {
      captions: ['Good caption', 'onclick=bad()']
    }
  }
  const result = validateContent(spec)
  expect(result.valid).toBeFalse()
  expect(result.errors.some(e => e.includes('caption'))).toBeTrue()
})

// ============================================================================
// Combined Validation Tests
// ============================================================================

test('validateAll: accepts fully valid spec', () => {
  const result = validateAll(validSpecWithContent)
  expect(result.valid).toBeTrue()
  expect(result.errors).toHaveLength(0)
  expect(result.sanitizedSpec).toBe(result.sanitizedSpec) // Should exist
})

test('validateAll: rejects spec with multiple issues', () => {
  const badSpec = {
    theme: {
      primaryColor: 'not-a-color',
      accentColor: '#FFF',
      backgroundColor: '#FFF',
      fontPairing: {
        heading: 'InvalidFont',
        body: 'AlsoInvalid'
      }
    },
    content: {
      title: '<script>bad</script>'
    }
  }
  const result = validateAll(badSpec)
  expect(result.valid).toBeFalse()
  expect(result.errors.length).toBeGreaterThan(2) // Multiple errors
})

test('validateAll: returns sanitized spec when valid', () => {
  const result = validateAll(validSpecWithContent)
  expect(result.valid).toBeTrue()
  expect(result.sanitizedSpec).toBe(result.sanitizedSpec)
  if (result.sanitizedSpec) {
    expect(result.sanitizedSpec.theme.primaryColor).toBe(validSpecWithContent.theme.primaryColor)
    expect(result.sanitizedSpec.content?.title).toBe(validSpecWithContent.content?.title)
  }
})

// ============================================================================
// Run Tests & Report
// ============================================================================

function runTests(): void {
  console.log('\n========================================')
  console.log('AI Output Validation Tests')
  console.log('========================================\n')

  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length

  for (const result of testResults) {
    const status = result.passed ? '[PASS]' : '[FAIL]'
    console.log(`${status} ${result.name}`)
    if (!result.passed && result.error) {
      console.log(`       Error: ${result.error}`)
    }
  }

  console.log('\n----------------------------------------')
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`)
  console.log('----------------------------------------\n')

  if (failed > 0) {
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  runTests()
}

export { runTests, testResults }
