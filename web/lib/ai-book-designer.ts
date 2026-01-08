/**
 * AI Book Designer - Three-Agent Hierarchy for Book Generation
 *
 * Architecture:
 * 1. Art Director Agent (Global) - Analyzes A Race + top photos, generates BookTheme
 * 2. Narrator Agent (Chapter Level) - Groups activities into chapters, generates section summaries
 * 3. Designer Agent (Page Level) - Selects template variants, customizes within constraints
 *
 * Uses visual-judge for self-correction feedback loop.
 */

import { BookTheme, BookPageType } from './book-types'
import { StravaActivity, StravaPhoto } from './strava'
import { generateStyleGuide, StyleGuideRequest } from './style-guide-generator'
import { validateAll, DesignSpec } from './ai-validation'
import { findARace, generateSmartDraft, BookEntry } from './curator'

// ============================================================================
// Types
// ============================================================================

export interface BookDesignSession {
  id: string
  status: 'pending' | 'art_director' | 'narrator' | 'designer' | 'completed' | 'error'
  createdAt: string
  updatedAt: string
  progress: {
    currentStage: string
    percentComplete: number
    message: string
  }
  input: {
    activities: StravaActivity[]
    photos: StravaPhoto[]
    options: DesignSessionOptions
  }
  output?: {
    artDirector?: ArtDirectorOutput
    narrator?: NarratorOutput
    designer?: DesignerOutput
    finalBook?: FinalBookSpec
  }
  errors: string[]
}

export interface DesignSessionOptions {
  useMock?: boolean
  verbose?: boolean
  maxDesignIterations?: number
  targetScore?: number
  userPreference?: 'minimal' | 'bold' | 'classic'
  year?: number
}

export interface ArtDirectorOutput {
  theme: BookTheme
  reasoning: string
  alternateThemes: BookTheme[]
  narrativeArc: NarrativeArc
  visualGuidelines: VisualGuidelines
}

export interface NarrativeArc {
  opening: string           // e.g., "A year of growth and determination"
  climax: string            // e.g., "Conquering the Boston Marathon"
  resolution: string        // e.g., "Personal records and lasting memories"
  overallTone: 'triumphant' | 'reflective' | 'energetic' | 'peaceful'
}

export interface VisualGuidelines {
  photoTreatment: 'full-bleed' | 'bordered' | 'polaroid' | 'mixed'
  emphasisLevel: 'minimal' | 'balanced' | 'dramatic'
  statisticsStyle: 'integrated' | 'dedicated-pages' | 'sidebar'
  mapStyle: 'subtle' | 'prominent' | 'hero'
}

export interface NarratorOutput {
  chapters: Chapter[]
  highlights: ActivityHighlight[]
  yearSummary: YearNarrative
}

export interface Chapter {
  id: string
  title: string
  subtitle?: string
  month?: number
  year: number
  activities: StravaActivity[]
  summary: string
  featuredActivityId?: number
  pageCount: number
}

export interface ActivityHighlight {
  activityId: number
  label: string
  reason: string
  suggestedEmphasis: 'hero' | 'featured' | 'standard'
}

export interface YearNarrative {
  title: string
  openingParagraph: string
  keyMilestones: string[]
  closingStatement: string
}

export interface DesignerOutput {
  pages: PageDesign[]
  iterations: DesignIteration[]
  finalScore: number
}

export interface PageDesign {
  pageNumber: number
  pageType: BookPageType
  template: string
  activityId?: number
  layout: PageLayout
  elements: PageElement[]
  score?: number
}

export interface PageLayout {
  photoPlacement: 'hero' | 'grid' | 'sidebar' | 'background' | 'none'
  textPlacement: 'overlay' | 'below' | 'side' | 'integrated'
  statsPlacement: 'footer' | 'sidebar' | 'grid' | 'inline' | 'none'
  margins: { top: number; right: number; bottom: number; left: number }
}

export interface PageElement {
  type: 'photo' | 'text' | 'stat' | 'map' | 'decoration'
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation?: number
  zIndex: number
  content: Record<string, unknown>
}

export interface DesignIteration {
  iterationNumber: number
  score: number
  feedback: string[]
  improvements: string[]
}

export interface FinalBookSpec {
  theme: BookTheme
  pages: PageDesign[]
  metadata: {
    totalPages: number
    generatedAt: string
    designIterations: number
    finalScore: number
  }
}

// ============================================================================
// Session Storage (In-Memory for now)
// ============================================================================

const sessions: Map<string, BookDesignSession> = new Map()

export function getSession(sessionId: string): BookDesignSession | undefined {
  return sessions.get(sessionId)
}

export function createSession(
  activities: StravaActivity[],
  photos: StravaPhoto[],
  options: DesignSessionOptions = {}
): BookDesignSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const session: BookDesignSession = {
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: {
      currentStage: 'Initializing',
      percentComplete: 0,
      message: 'Preparing design session...'
    },
    input: {
      activities,
      photos,
      options
    },
    output: {},
    errors: []
  }

  sessions.set(id, session)
  return session
}

function updateSession(
  sessionId: string,
  updates: Partial<BookDesignSession>
): BookDesignSession | undefined {
  const session = sessions.get(sessionId)
  if (!session) return undefined

  const updated = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  sessions.set(sessionId, updated)
  return updated
}

// ============================================================================
// Art Director Agent
// ============================================================================

// Prompt template for future real AI integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _NARRATIVE_ARC_PROMPT = `You are a creative director analyzing an athlete's year of activities to create a compelling narrative arc for their yearbook.

ACTIVITIES SUMMARY:
{activitySummary}

A-RACE (Primary Goal Race):
{aRaceInfo}

TOP PHOTOS:
{photoInfo}

Based on this data, create a narrative arc for the yearbook that:
1. Identifies the emotional journey of the year
2. Highlights the A-Race as the climax if present
3. Creates a cohesive story from training to achievement

Return ONLY valid JSON:
{
  "narrativeArc": {
    "opening": "Brief opening theme (1 sentence)",
    "climax": "The peak moment/achievement (1 sentence)",
    "resolution": "How the year concludes (1 sentence)",
    "overallTone": "triumphant | reflective | energetic | peaceful"
  },
  "visualGuidelines": {
    "photoTreatment": "full-bleed | bordered | polaroid | mixed",
    "emphasisLevel": "minimal | balanced | dramatic",
    "statisticsStyle": "integrated | dedicated-pages | sidebar",
    "mapStyle": "subtle | prominent | hero"
  }
}`

/**
 * Art Director Agent - Analyzes activities and generates global theme
 */
export async function artDirectorAgent(
  activities: StravaActivity[],
  photos: StravaPhoto[],
  options: DesignSessionOptions = {}
): Promise<ArtDirectorOutput> {
  const { useMock = false, verbose = false, userPreference = 'classic' } = options

  if (verbose) {
    console.log('[Art Director] Starting analysis...')
    console.log('[Art Director] Activities:', activities.length)
    console.log('[Art Director] Photos:', photos.length)
  }

  // Find A-Race
  const aRace = findARace(activities)

  // Collect activity types for style guide
  const activityTypes = activities.map(a => a.type)

  // Generate theme using existing style-guide-generator
  const styleGuideRequest: StyleGuideRequest = {
    aRace,
    topPhotos: photos.slice(0, 5),
    activityTypes,
    userPreference,
    yearRange: activities.length > 0 ? {
      start: Math.min(...activities.map(a => new Date(a.start_date).getFullYear())),
      end: Math.max(...activities.map(a => new Date(a.start_date).getFullYear()))
    } : undefined
  }

  const styleGuideResult = await generateStyleGuide(styleGuideRequest, { useMock, verbose })

  // Generate narrative arc
  const narrativeArc = await generateNarrativeArc(activities, aRace, photos, options)

  const output: ArtDirectorOutput = {
    theme: styleGuideResult.theme,
    reasoning: styleGuideResult.reasoning,
    alternateThemes: styleGuideResult.alternates,
    narrativeArc,
    visualGuidelines: generateVisualGuidelines(activities, aRace)
  }

  if (verbose) {
    console.log('[Art Director] Theme generated:', output.theme.primaryColor)
    console.log('[Art Director] Narrative tone:', output.narrativeArc.overallTone)
  }

  return output
}

async function generateNarrativeArc(
  activities: StravaActivity[],
  aRace: StravaActivity | undefined,
  photos: StravaPhoto[],
  options: DesignSessionOptions
): Promise<NarrativeArc> {
  const { useMock = false } = options

  if (useMock) {
    return generateMockNarrativeArc(activities, aRace)
  }

  // For real AI, we would call Gemini here
  // For now, use the mock implementation
  return generateMockNarrativeArc(activities, aRace)
}

function generateMockNarrativeArc(
  activities: StravaActivity[],
  aRace: StravaActivity | undefined
): NarrativeArc {
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const races = activities.filter(a => a.workout_type === 1)

  if (aRace) {
    const raceName = aRace.name
    return {
      opening: `A year of dedicated training and focused preparation`,
      climax: `The moment of truth: conquering ${raceName}`,
      resolution: `${Math.round(totalDistance)}km of growth, determination, and personal achievement`,
      overallTone: 'triumphant'
    }
  }

  if (races.length > 0) {
    return {
      opening: `Embracing every challenge with determination`,
      climax: `${races.length} races completed, each a story of perseverance`,
      resolution: `A year of consistent effort and measurable progress`,
      overallTone: 'energetic'
    }
  }

  return {
    opening: `Every journey begins with a single step`,
    climax: `${Math.round(totalDistance)}km of dedication and discipline`,
    resolution: `Building the foundation for greater achievements ahead`,
    overallTone: 'reflective'
  }
}

function generateVisualGuidelines(
  activities: StravaActivity[],
  aRace: StravaActivity | undefined
): VisualGuidelines {
  const hasPhotos = activities.some(a => a.photos && a.photos.count > 0)
  const hasRaces = activities.some(a => a.workout_type === 1)

  return {
    photoTreatment: hasPhotos ? 'mixed' : 'bordered',
    emphasisLevel: aRace ? 'dramatic' : hasRaces ? 'balanced' : 'minimal',
    statisticsStyle: activities.length > 50 ? 'dedicated-pages' : 'integrated',
    mapStyle: aRace ? 'hero' : 'subtle'
  }
}

// ============================================================================
// Narrator Agent
// ============================================================================

/**
 * Narrator Agent - Groups activities into chapters and generates summaries
 */
export async function narratorAgent(
  activities: StravaActivity[],
  theme: BookTheme,
  options: DesignSessionOptions = {}
): Promise<NarratorOutput> {
  const { verbose = false, year } = options

  if (verbose) {
    console.log('[Narrator] Grouping activities into chapters...')
  }

  // Group activities by month
  const activityYear = year || (activities.length > 0
    ? new Date(activities[0].start_date).getFullYear()
    : new Date().getFullYear())

  const chapters = groupActivitiesIntoChapters(activities, activityYear)

  // Identify highlights
  const highlights = identifyHighlights(activities)

  // Generate year summary
  const yearSummary = generateYearNarrative(activities, activityYear)

  const output: NarratorOutput = {
    chapters,
    highlights,
    yearSummary
  }

  if (verbose) {
    console.log('[Narrator] Created', chapters.length, 'chapters')
    console.log('[Narrator] Identified', highlights.length, 'highlights')
  }

  return output
}

function groupActivitiesIntoChapters(
  activities: StravaActivity[],
  year: number
): Chapter[] {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const chapters: Chapter[] = []
  const activitiesByMonth = new Map<number, StravaActivity[]>()

  // Group by month
  for (let m = 0; m < 12; m++) {
    activitiesByMonth.set(m, [])
  }

  activities.forEach(activity => {
    const date = new Date(activity.start_date)
    const month = date.getMonth()
    const monthActivities = activitiesByMonth.get(month) || []
    monthActivities.push(activity)
    activitiesByMonth.set(month, monthActivities)
  })

  // Create chapters for months with activities
  for (let month = 0; month < 12; month++) {
    const monthActivities = activitiesByMonth.get(month) || []
    if (monthActivities.length === 0) continue

    const races = monthActivities.filter(a => a.workout_type === 1)
    const featuredActivity = races.length > 0
      ? races.sort((a, b) => b.distance - a.distance)[0]
      : monthActivities.sort((a, b) => b.distance - a.distance)[0]

    chapters.push({
      id: `chapter_${year}_${month}`,
      title: monthNames[month],
      subtitle: `${monthActivities.length} activities`,
      month,
      year,
      activities: monthActivities,
      summary: generateChapterSummary(monthActivities, monthNames[month]),
      featuredActivityId: featuredActivity?.id,
      pageCount: calculateChapterPageCount(monthActivities)
    })
  }

  return chapters
}

function generateChapterSummary(activities: StravaActivity[], monthName: string): string {
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const races = activities.filter(a => a.workout_type === 1)

  if (races.length > 0) {
    const raceNames = races.map(r => r.name).slice(0, 2).join(' and ')
    return `${monthName} was marked by ${races.length} race${races.length > 1 ? 's' : ''}: ${raceNames}. Total distance: ${Math.round(totalDistance)}km.`
  }

  return `A month of consistent training with ${activities.length} activities covering ${Math.round(totalDistance)}km.`
}

function calculateChapterPageCount(activities: StravaActivity[]): number {
  const races = activities.filter(a => a.workout_type === 1)
  // 1 page per race, 1 page for monthly divider, 1 page per 10 regular activities
  const regularActivities = activities.length - races.length
  return 1 + races.length + Math.ceil(regularActivities / 10)
}

function identifyHighlights(activities: StravaActivity[]): ActivityHighlight[] {
  const highlights: ActivityHighlight[] = []

  // Find races
  const races = activities.filter(a => a.workout_type === 1)
  races.forEach(race => {
    highlights.push({
      activityId: race.id,
      label: 'Race',
      reason: `Completed ${race.name}`,
      suggestedEmphasis: race.distance > 21097 ? 'hero' : 'featured'
    })
  })

  // Find longest activity
  const longestActivity = [...activities].sort((a, b) => b.distance - a.distance)[0]
  if (longestActivity && !races.includes(longestActivity)) {
    highlights.push({
      activityId: longestActivity.id,
      label: 'Longest Distance',
      reason: `${(longestActivity.distance / 1000).toFixed(1)}km - your longest effort`,
      suggestedEmphasis: 'featured'
    })
  }

  // Find activities with PRs
  const activitiesWithPRs = activities.filter(a =>
    a.best_efforts?.some(e => e.pr_rank === 1)
  )
  activitiesWithPRs.slice(0, 3).forEach(activity => {
    if (!highlights.find(h => h.activityId === activity.id)) {
      highlights.push({
        activityId: activity.id,
        label: 'Personal Record',
        reason: 'Set a new personal best',
        suggestedEmphasis: 'featured'
      })
    }
  })

  // Find most kudos
  const mostKudos = [...activities].sort((a, b) => b.kudos_count - a.kudos_count)[0]
  if (mostKudos && mostKudos.kudos_count > 10 && !highlights.find(h => h.activityId === mostKudos.id)) {
    highlights.push({
      activityId: mostKudos.id,
      label: 'Community Favorite',
      reason: `${mostKudos.kudos_count} kudos`,
      suggestedEmphasis: 'standard'
    })
  }

  return highlights
}

function generateYearNarrative(activities: StravaActivity[], year: number): YearNarrative {
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0)
  const totalElevation = activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0)
  const races = activities.filter(a => a.workout_type === 1)
  const aRace = findARace(activities)

  const hours = Math.floor(totalTime / 3600)

  const milestones: string[] = []
  milestones.push(`${Math.round(totalDistance)}km total distance`)
  milestones.push(`${hours} hours of activity`)
  milestones.push(`${Math.round(totalElevation)}m elevation gain`)
  if (races.length > 0) {
    milestones.push(`${races.length} races completed`)
  }

  return {
    title: `${year}: A Year in Motion`,
    openingParagraph: aRace
      ? `${year} was the year of ${aRace.name}. Through dedicated training and unwavering determination, this goal race became the centerpiece of an incredible athletic journey.`
      : `${year} was a year of consistent dedication. With ${activities.length} activities across the calendar, every run, ride, and workout contributed to a remarkable year of growth.`,
    keyMilestones: milestones,
    closingStatement: `Looking back at ${year}, these ${activities.length} activities represent more than just numbers - they tell the story of commitment, growth, and the joy of movement.`
  }
}

// ============================================================================
// Designer Agent
// ============================================================================

/**
 * Designer Agent - Creates page layouts within theme constraints
 */
export async function designerAgent(
  chapters: Chapter[],
  theme: BookTheme,
  highlights: ActivityHighlight[],
  options: DesignSessionOptions = {}
): Promise<DesignerOutput> {
  const { verbose = false } = options

  if (verbose) {
    console.log('[Designer] Creating page layouts...')
  }

  // Generate book structure using existing curator
  const allActivities = chapters.flatMap(c => c.activities)
  const bookEntries = generateSmartDraft(allActivities)

  // Convert book entries to page designs
  const pages = bookEntriesToPageDesigns(bookEntries, theme, highlights)

  if (verbose) {
    console.log('[Designer] Created', pages.length, 'pages')
  }

  return {
    pages,
    iterations: [], // Will be populated by self-correction loop
    finalScore: 0   // Will be set by visual judge
  }
}

function bookEntriesToPageDesigns(
  entries: BookEntry[],
  theme: BookTheme,
  highlights: ActivityHighlight[]
): PageDesign[] {
  const pages: PageDesign[] = []

  entries.forEach((entry, index) => {
    const highlight = entry.activityId
      ? highlights.find(h => h.activityId === entry.activityId)
      : undefined

    const layout = getLayoutForPageType(entry.type, highlight?.suggestedEmphasis)

    pages.push({
      pageNumber: index + 1,
      pageType: entry.type,
      template: getTemplateForPageType(entry.type),
      activityId: entry.activityId,
      layout,
      elements: generatePageElements(entry, layout, theme),
      score: undefined
    })
  })

  return pages
}

function getLayoutForPageType(
  pageType: BookPageType,
  emphasis?: 'hero' | 'featured' | 'standard'
): PageLayout {
  const baseLayout: PageLayout = {
    photoPlacement: 'none',
    textPlacement: 'integrated',
    statsPlacement: 'none',
    margins: { top: 45, right: 45, bottom: 45, left: 45 }
  }

  switch (pageType) {
    case 'COVER':
      return {
        ...baseLayout,
        photoPlacement: 'background',
        textPlacement: 'overlay',
        margins: { top: 0, right: 0, bottom: 0, left: 0 }
      }

    case 'RACE_PAGE':
      if (emphasis === 'hero') {
        return {
          ...baseLayout,
          photoPlacement: 'hero',
          textPlacement: 'below',
          statsPlacement: 'grid'
        }
      }
      return {
        ...baseLayout,
        photoPlacement: 'sidebar',
        textPlacement: 'side',
        statsPlacement: 'inline'
      }

    case 'MONTHLY_DIVIDER':
      return {
        ...baseLayout,
        photoPlacement: 'grid',
        textPlacement: 'overlay'
      }

    case 'YEAR_STATS':
    case 'YEAR_AT_A_GLANCE':
      return {
        ...baseLayout,
        statsPlacement: 'grid',
        textPlacement: 'integrated'
      }

    case 'ACTIVITY_LOG':
      return {
        ...baseLayout,
        statsPlacement: 'inline',
        textPlacement: 'integrated'
      }

    case 'BACK_COVER':
      return {
        ...baseLayout,
        photoPlacement: 'background',
        textPlacement: 'overlay',
        margins: { top: 0, right: 0, bottom: 0, left: 0 }
      }

    default:
      return baseLayout
  }
}

function getTemplateForPageType(pageType: BookPageType): string {
  const templateMap: Record<BookPageType, string> = {
    'COVER': 'Cover',
    'TABLE_OF_CONTENTS': 'TableOfContents',
    'FOREWORD': 'Foreword',
    'YEAR_AT_A_GLANCE': 'YearAtAGlance',
    'YEAR_STATS': 'YearStats',
    'MONTHLY_DIVIDER': 'MonthlyDivider',
    'RACE_PAGE': 'Race_2p',
    'ACTIVITY_LOG': 'ActivityLog',
    'BEST_EFFORTS': 'BestEfforts',
    'ROUTE_HEATMAP': 'RouteHeatmap',
    'STATS_SUMMARY': 'StatsSummary',
    'BACK_COVER': 'BackCover'
  }

  return templateMap[pageType] || 'Default'
}

function generatePageElements(
  entry: BookEntry,
  layout: PageLayout,
  theme: BookTheme
): PageElement[] {
  const elements: PageElement[] = []

  // Add title text element
  if (entry.title) {
    elements.push({
      type: 'text',
      position: { x: layout.margins.left, y: layout.margins.top },
      size: { width: 300, height: 50 },
      zIndex: 10,
      content: {
        text: entry.title,
        style: 'heading',
        color: theme.primaryColor
      }
    })
  }

  // Add photo placeholder based on layout
  if (layout.photoPlacement !== 'none') {
    elements.push({
      type: 'photo',
      position: getPhotoPosition(layout),
      size: getPhotoSize(layout),
      zIndex: 1,
      content: {
        placeholder: true,
        treatment: layout.photoPlacement
      }
    })
  }

  return elements
}

function getPhotoPosition(layout: PageLayout): { x: number; y: number } {
  switch (layout.photoPlacement) {
    case 'hero':
    case 'background':
      return { x: 0, y: 0 }
    case 'sidebar':
      return { x: 360, y: layout.margins.top }
    case 'grid':
      return { x: layout.margins.left, y: 150 }
    default:
      return { x: layout.margins.left, y: layout.margins.top }
  }
}

function getPhotoSize(layout: PageLayout): { width: number; height: number } {
  switch (layout.photoPlacement) {
    case 'hero':
      return { width: 720, height: 400 }
    case 'background':
      return { width: 720, height: 720 }
    case 'sidebar':
      return { width: 300, height: 400 }
    case 'grid':
      return { width: 200, height: 150 }
    default:
      return { width: 300, height: 200 }
  }
}

// ============================================================================
// Self-Correction Loop with Visual Judge
// ============================================================================

export interface DesignWithFeedbackResult {
  design: PageDesign
  iterations: number
  finalScore: number
  feedback: string[]
}

/**
 * Design with self-correction feedback loop
 * Iterates until score >= targetScore or maxIterations reached
 */
export async function designWithFeedback(
  page: PageDesign,
  theme: BookTheme,
  options: {
    maxIterations?: number
    targetScore?: number
    verbose?: boolean
  } = {}
): Promise<DesignWithFeedbackResult> {
  const { maxIterations = 3, targetScore = 70, verbose = false } = options

  let currentDesign = { ...page }
  let currentScore = 0
  let iterations = 0
  const allFeedback: string[] = []

  // Note: In a full implementation, we would:
  // 1. Render the page to an image
  // 2. Call judgePageVisual from visual-judge.ts
  // 3. Use the feedback to improve the design
  // 4. Repeat until score >= targetScore or maxIterations

  // For now, we simulate the scoring
  while (iterations < maxIterations) {
    iterations++

    if (verbose) {
      console.log(`[Design Feedback] Iteration ${iterations}/${maxIterations}`)
    }

    // Simulate visual judge scoring
    const { score, feedback } = await simulateVisualJudge(currentDesign, theme)
    currentScore = score
    allFeedback.push(...feedback)

    if (verbose) {
      console.log(`[Design Feedback] Score: ${score}`)
      console.log(`[Design Feedback] Feedback: ${feedback.join(', ')}`)
    }

    if (score >= targetScore) {
      if (verbose) {
        console.log(`[Design Feedback] Target score reached!`)
      }
      break
    }

    // Apply improvements based on feedback
    currentDesign = applyDesignImprovements(currentDesign, feedback, theme)
  }

  return {
    design: { ...currentDesign, score: currentScore },
    iterations,
    finalScore: currentScore,
    feedback: allFeedback
  }
}

async function simulateVisualJudge(
  design: PageDesign,
  theme: BookTheme
): Promise<{ score: number; feedback: string[] }> {
  // Simulate scoring based on design properties
  let score = 50 // Base score
  const feedback: string[] = []

  // Check margins
  if (design.layout.margins.top >= 36) {
    score += 10
  } else {
    feedback.push('Increase top margin for better print safety')
  }

  // Check for content
  if (design.elements.length > 0) {
    score += 10
  } else {
    feedback.push('Add content elements to the page')
  }

  // Check layout appropriateness
  if (design.pageType === 'RACE_PAGE' && design.layout.photoPlacement !== 'none') {
    score += 15
  } else if (design.pageType === 'RACE_PAGE') {
    feedback.push('Race pages should include photos')
  }

  // Theme consistency bonus
  const hasThemedElements = design.elements.some(e =>
    e.content && (e.content as Record<string, unknown>).color === theme.primaryColor
  )
  if (hasThemedElements) {
    score += 10
  } else {
    feedback.push('Use theme colors for better brand cohesion')
  }

  // Random variation for simulation
  score += Math.floor(Math.random() * 10)

  return { score: Math.min(100, score), feedback }
}

function applyDesignImprovements(
  design: PageDesign,
  feedback: string[],
  theme: BookTheme
): PageDesign {
  const improved = { ...design, elements: [...design.elements] }

  // Apply improvements based on feedback
  feedback.forEach(fb => {
    if (fb.includes('margin')) {
      improved.layout = {
        ...improved.layout,
        margins: { top: 45, right: 45, bottom: 45, left: 45 }
      }
    }

    if (fb.includes('content elements')) {
      improved.elements.push({
        type: 'text',
        position: { x: 45, y: 100 },
        size: { width: 300, height: 40 },
        zIndex: 5,
        content: { text: 'Content placeholder', style: 'body' }
      })
    }

    if (fb.includes('photos')) {
      improved.layout.photoPlacement = 'hero'
      improved.elements.push({
        type: 'photo',
        position: { x: 45, y: 150 },
        size: { width: 630, height: 350 },
        zIndex: 1,
        content: { placeholder: true }
      })
    }

    if (fb.includes('theme colors')) {
      const textElements = improved.elements.filter(e => e.type === 'text')
      textElements.forEach(e => {
        (e.content as Record<string, unknown>).color = theme.primaryColor
      })
    }
  })

  return improved
}

// ============================================================================
// Main Orchestration
// ============================================================================

/**
 * Run complete design session with all three agents
 */
export async function runDesignSession(
  activities: StravaActivity[],
  photos: StravaPhoto[],
  options: DesignSessionOptions = {}
): Promise<BookDesignSession> {
  const { verbose = false } = options

  // Create session
  const session = createSession(activities, photos, options)

  try {
    // Stage 1: Art Director
    updateSession(session.id, {
      status: 'art_director',
      progress: {
        currentStage: 'Art Director',
        percentComplete: 10,
        message: 'Analyzing activities and generating theme...'
      }
    })

    if (verbose) {
      console.log('[Design Session] Running Art Director...')
    }

    const artDirectorOutput = await artDirectorAgent(activities, photos, options)

    updateSession(session.id, {
      output: { ...session.output, artDirector: artDirectorOutput },
      progress: {
        currentStage: 'Art Director',
        percentComplete: 30,
        message: 'Theme and narrative arc generated'
      }
    })

    // Stage 2: Narrator
    updateSession(session.id, {
      status: 'narrator',
      progress: {
        currentStage: 'Narrator',
        percentComplete: 40,
        message: 'Organizing activities into chapters...'
      }
    })

    if (verbose) {
      console.log('[Design Session] Running Narrator...')
    }

    const narratorOutput = await narratorAgent(activities, artDirectorOutput.theme, options)

    updateSession(session.id, {
      output: { ...session.output, narrator: narratorOutput },
      progress: {
        currentStage: 'Narrator',
        percentComplete: 60,
        message: `Created ${narratorOutput.chapters.length} chapters`
      }
    })

    // Stage 3: Designer
    updateSession(session.id, {
      status: 'designer',
      progress: {
        currentStage: 'Designer',
        percentComplete: 70,
        message: 'Creating page layouts...'
      }
    })

    if (verbose) {
      console.log('[Design Session] Running Designer...')
    }

    const designerOutput = await designerAgent(
      narratorOutput.chapters,
      artDirectorOutput.theme,
      narratorOutput.highlights,
      options
    )

    // Run self-correction on key pages
    if (verbose) {
      console.log('[Design Session] Running self-correction loop...')
    }

    const iterationResults: DesignIteration[] = []
    const improvedPages: PageDesign[] = []
    let totalScore = 0

    for (const page of designerOutput.pages) {
      // Only run intensive feedback loop on important pages
      const shouldIterate = ['COVER', 'RACE_PAGE', 'YEAR_STATS'].includes(page.pageType)

      if (shouldIterate) {
        const result = await designWithFeedback(page, artDirectorOutput.theme, {
          maxIterations: options.maxDesignIterations || 3,
          targetScore: options.targetScore || 70,
          verbose
        })

        improvedPages.push(result.design)
        totalScore += result.finalScore

        iterationResults.push({
          iterationNumber: result.iterations,
          score: result.finalScore,
          feedback: result.feedback,
          improvements: []
        })
      } else {
        improvedPages.push(page)
        totalScore += 70 // Default score for non-iterated pages
      }
    }

    const avgScore = improvedPages.length > 0 ? Math.round(totalScore / improvedPages.length) : 0

    const finalDesignerOutput: DesignerOutput = {
      pages: improvedPages,
      iterations: iterationResults,
      finalScore: avgScore
    }

    // Create final book spec
    const finalBook: FinalBookSpec = {
      theme: artDirectorOutput.theme,
      pages: improvedPages,
      metadata: {
        totalPages: improvedPages.length,
        generatedAt: new Date().toISOString(),
        designIterations: iterationResults.length,
        finalScore: avgScore
      }
    }

    // Validate final output
    const designSpec: DesignSpec = {
      theme: {
        primaryColor: artDirectorOutput.theme.primaryColor,
        accentColor: artDirectorOutput.theme.accentColor,
        backgroundColor: artDirectorOutput.theme.backgroundColor,
        fontPairing: artDirectorOutput.theme.fontPairing,
        motif: artDirectorOutput.theme.motif,
        backgroundStyle: artDirectorOutput.theme.backgroundStyle
      }
    }

    const validationResult = validateAll(designSpec)
    if (!validationResult.valid) {
      console.warn('[Design Session] Validation warnings:', validationResult.warnings)
      session.errors.push(...validationResult.errors)
    }

    // Complete session
    const completedSession = updateSession(session.id, {
      status: 'completed',
      output: {
        artDirector: artDirectorOutput,
        narrator: narratorOutput,
        designer: finalDesignerOutput,
        finalBook
      },
      progress: {
        currentStage: 'Complete',
        percentComplete: 100,
        message: `Book design complete with ${improvedPages.length} pages (score: ${avgScore})`
      },
      errors: session.errors
    })

    if (verbose) {
      console.log('[Design Session] Complete!')
      console.log('[Design Session] Pages:', improvedPages.length)
      console.log('[Design Session] Final Score:', avgScore)
    }

    return completedSession!
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    updateSession(session.id, {
      status: 'error',
      errors: [...session.errors, errorMessage],
      progress: {
        currentStage: 'Error',
        percentComplete: 0,
        message: `Design session failed: ${errorMessage}`
      }
    })

    throw error
  }
}

// Session management functions are exported inline above:
// - createSession
// - getSession
// - updateSession (private, not exported)
