/**
 * Database of major races with official colors and branding
 */

export interface KnownRace {
  name: string
  aliases: string[]
  colors: { primary: string; accent: string }
  logoUrl?: string
  location: { city: string; state?: string; country: string }
  defaultBackgroundQuery?: string  // For stock photo search
}

export const KNOWN_RACES: KnownRace[] = [
  // === World Marathon Majors ===
  {
    name: "Boston Marathon",
    aliases: ["boston marathon", "boston", "baa marathon", "baa"],
    colors: { primary: "#0D2240", accent: "#FFD200" },
    logoUrl: "/assets/race-logos/boston.png",
    location: { city: "Boston", state: "MA", country: "USA" },
    defaultBackgroundQuery: "boston marathon finish line boylston street"
  },
  {
    name: "New York City Marathon",
    aliases: ["new york city marathon", "nyc marathon", "nycm", "new york", "tcs new york"],
    colors: { primary: "#FF6B35", accent: "#004E89" },
    logoUrl: "/assets/race-logos/nyc.png",
    location: { city: "New York", state: "NY", country: "USA" },
    defaultBackgroundQuery: "nyc marathon central park finish"
  },
  {
    name: "Chicago Marathon",
    aliases: ["chicago marathon", "chicago", "bank of america chicago"],
    colors: { primary: "#C41E3A", accent: "#0051BA" },
    logoUrl: "/assets/race-logos/chicago.png",
    location: { city: "Chicago", state: "IL", country: "USA" },
    defaultBackgroundQuery: "chicago marathon grant park"
  },
  {
    name: "London Marathon",
    aliases: ["london marathon", "london", "tcs london"],
    colors: { primary: "#E32119", accent: "#000000" },
    logoUrl: "/assets/race-logos/london.png",
    location: { city: "London", country: "UK" },
    defaultBackgroundQuery: "london marathon big ben tower bridge"
  },
  {
    name: "Berlin Marathon",
    aliases: ["berlin marathon", "berlin", "bmw berlin"],
    colors: { primary: "#000000", accent: "#DD0000" },
    logoUrl: "/assets/race-logos/berlin.png",
    location: { city: "Berlin", country: "Germany" },
    defaultBackgroundQuery: "berlin marathon brandenburg gate"
  },
  {
    name: "Tokyo Marathon",
    aliases: ["tokyo marathon", "tokyo"],
    colors: { primary: "#E60012", accent: "#FFFFFF" },
    logoUrl: "/assets/race-logos/tokyo.png",
    location: { city: "Tokyo", country: "Japan" },
    defaultBackgroundQuery: "tokyo marathon imperial palace"
  },

  // === Major US Marathons ===
  {
    name: "Los Angeles Marathon",
    aliases: ["los angeles marathon", "la marathon", "los angeles"],
    colors: { primary: "#FDB913", accent: "#005587" },
    location: { city: "Los Angeles", state: "CA", country: "USA" },
    defaultBackgroundQuery: "los angeles marathon downtown"
  },
  {
    name: "Philadelphia Marathon",
    aliases: ["philadelphia marathon", "philly marathon", "philadelphia"],
    colors: { primary: "#004B87", accent: "#F99D1C" },
    location: { city: "Philadelphia", state: "PA", country: "USA" },
    defaultBackgroundQuery: "philadelphia marathon art museum rocky steps"
  },
  {
    name: "Marine Corps Marathon",
    aliases: ["marine corps marathon", "mcm", "marines marathon"],
    colors: { primary: "#CC0000", accent: "#FFD700" },
    location: { city: "Washington", state: "DC", country: "USA" },
    defaultBackgroundQuery: "marine corps marathon iwo jima memorial"
  },
  {
    name: "Twin Cities Marathon",
    aliases: ["twin cities marathon", "twin cities", "medtronic twin cities"],
    colors: { primary: "#0055A4", accent: "#FFC72C" },
    location: { city: "Minneapolis", state: "MN", country: "USA" },
    defaultBackgroundQuery: "twin cities marathon minneapolis lakes"
  },

  // === Trail & Ultra Races ===
  {
    name: "Western States 100",
    aliases: ["western states", "western states 100", "ws100"],
    colors: { primary: "#8B4513", accent: "#FFD700" },
    location: { city: "Squaw Valley", state: "CA", country: "USA" },
    defaultBackgroundQuery: "western states 100 sierra nevada mountains"
  },
  {
    name: "Ultra-Trail du Mont-Blanc",
    aliases: ["utmb", "ultra trail mont blanc", "mont blanc"],
    colors: { primary: "#002B5C", accent: "#FFFFFF" },
    location: { city: "Chamonix", country: "France" },
    defaultBackgroundQuery: "utmb chamonix mont blanc alpine"
  },
  {
    name: "JFK 50 Mile",
    aliases: ["jfk 50", "jfk 50 mile", "jfk ultra"],
    colors: { primary: "#003366", accent: "#CC0000" },
    location: { city: "Boonsboro", state: "MD", country: "USA" },
    defaultBackgroundQuery: "jfk 50 mile appalachian trail"
  },
  {
    name: "Leadville Trail 100",
    aliases: ["leadville 100", "leadville trail 100", "leadville"],
    colors: { primary: "#4A5F2C", accent: "#C0C0C0" },
    location: { city: "Leadville", state: "CO", country: "USA" },
    defaultBackgroundQuery: "leadville 100 colorado rocky mountains"
  },

  // === Half Marathons ===
  {
    name: "NYC Half Marathon",
    aliases: ["nyc half", "new york half", "nyc half marathon"],
    colors: { primary: "#FF6B35", accent: "#004E89" },
    location: { city: "New York", state: "NY", country: "USA" },
    defaultBackgroundQuery: "nyc half marathon times square"
  },
  {
    name: "Philadelphia Half Marathon",
    aliases: ["philly half", "philadelphia half", "philadelphia half marathon"],
    colors: { primary: "#004B87", accent: "#F99D1C" },
    location: { city: "Philadelphia", state: "PA", country: "USA" },
    defaultBackgroundQuery: "philadelphia half marathon benjamin franklin parkway"
  },
  {
    name: "Rock 'n' Roll Half Marathon",
    aliases: ["rock n roll", "rock and roll half", "rnr half"],
    colors: { primary: "#E31C23", accent: "#000000" },
    location: { city: "Various", country: "USA" },
    defaultBackgroundQuery: "rock n roll marathon running music"
  },

  // === 10K & 5K Races ===
  {
    name: "Peachtree Road Race",
    aliases: ["peachtree road race", "peachtree 10k", "peachtree"],
    colors: { primary: "#C8102E", accent: "#FFFFFF" },
    location: { city: "Atlanta", state: "GA", country: "USA" },
    defaultBackgroundQuery: "peachtree road race atlanta july 4th"
  },
  {
    name: "Bolder Boulder",
    aliases: ["bolder boulder", "boulder 10k"],
    colors: { primary: "#FFD700", accent: "#003087" },
    location: { city: "Boulder", state: "CO", country: "USA" },
    defaultBackgroundQuery: "bolder boulder memorial day colorado"
  },
  {
    name: "Bay to Breakers",
    aliases: ["bay to breakers", "b2b"],
    colors: { primary: "#FF6B35", accent: "#00A9E0" },
    location: { city: "San Francisco", state: "CA", country: "USA" },
    defaultBackgroundQuery: "bay to breakers san francisco costumes"
  },

  // === Triathlon Events ===
  {
    name: "Ironman World Championship",
    aliases: ["ironman kona", "ironman world championship", "kona ironman", "ironman hawaii"],
    colors: { primary: "#E31C23", accent: "#000000" },
    location: { city: "Kailua-Kona", state: "HI", country: "USA" },
    defaultBackgroundQuery: "ironman kona hawaii lava fields"
  },
  {
    name: "Ironman 70.3 World Championship",
    aliases: ["ironman 70.3 worlds", "70.3 world championship"],
    colors: { primary: "#E31C23", accent: "#0055A4" },
    location: { city: "Various", country: "Various" },
    defaultBackgroundQuery: "ironman 70.3 triathlon championship"
  },

  // === International Marathons ===
  {
    name: "Paris Marathon",
    aliases: ["paris marathon", "marathon de paris", "paris"],
    colors: { primary: "#0055A4", accent: "#EF4135" },
    location: { city: "Paris", country: "France" },
    defaultBackgroundQuery: "paris marathon eiffel tower champs elysees"
  },
  {
    name: "Amsterdam Marathon",
    aliases: ["amsterdam marathon", "tcs amsterdam marathon", "amsterdam"],
    colors: { primary: "#C8102E", accent: "#000000" },
    location: { city: "Amsterdam", country: "Netherlands" },
    defaultBackgroundQuery: "amsterdam marathon canal houses finish"
  },
  {
    name: "Barcelona Marathon",
    aliases: ["barcelona marathon", "zurich barcelona marathon", "barcelona"],
    colors: { primary: "#004B87", accent: "#FFD700" },
    location: { city: "Barcelona", country: "Spain" },
    defaultBackgroundQuery: "barcelona marathon sagrada familia beach"
  },
  {
    name: "Dubai Marathon",
    aliases: ["dubai marathon", "standard chartered dubai", "dubai"],
    colors: { primary: "#00A651", accent: "#FFFFFF" },
    location: { city: "Dubai", country: "UAE" },
    defaultBackgroundQuery: "dubai marathon burj khalifa skyline"
  },

  // === Regional Favorites ===
  {
    name: "Big Sur Marathon",
    aliases: ["big sur", "big sur marathon"],
    colors: { primary: "#006747", accent: "#87CEEB" },
    location: { city: "Big Sur", state: "CA", country: "USA" },
    defaultBackgroundQuery: "big sur marathon pacific coast highway bixby bridge"
  },
  {
    name: "Grandma's Marathon",
    aliases: ["grandmas marathon", "grandma marathon", "duluth marathon"],
    colors: { primary: "#C41E3A", accent: "#FFD700" },
    location: { city: "Duluth", state: "MN", country: "USA" },
    defaultBackgroundQuery: "grandmas marathon duluth lake superior"
  },
  {
    name: "St. George Marathon",
    aliases: ["st george marathon", "st. george", "saint george"],
    colors: { primary: "#DC143C", accent: "#F4A460" },
    location: { city: "St. George", state: "UT", country: "USA" },
    defaultBackgroundQuery: "st george marathon utah red rocks"
  },
  {
    name: "Outer Banks Marathon",
    aliases: ["outer banks marathon", "obx marathon", "outer banks"],
    colors: { primary: "#0077BE", accent: "#FFD700" },
    location: { city: "Kitty Hawk", state: "NC", country: "USA" },
    defaultBackgroundQuery: "outer banks marathon beach atlantic ocean"
  },
]

/**
 * Find a known race by name or location
 */
export function findKnownRace(nameOrAlias: string, location?: string): KnownRace | null {
  const searchTerm = nameOrAlias.toLowerCase()
  const searchLocation = location?.toLowerCase()

  for (const race of KNOWN_RACES) {
    // Check name and aliases
    if (race.aliases.some(alias => searchTerm.includes(alias.toLowerCase()))) {
      return race
    }

    // Check location if provided
    if (searchLocation && race.location.city.toLowerCase().includes(searchLocation)) {
      return race
    }
  }

  return null
}

/**
 * Get races by country
 */
export function getRacesByCountry(country: string): KnownRace[] {
  return KNOWN_RACES.filter(race =>
    race.location.country.toLowerCase() === country.toLowerCase()
  )
}

/**
 * Get races by type (based on name patterns)
 */
export function getRacesByType(type: 'marathon' | 'half' | 'ultra' | '10k' | '5k'): KnownRace[] {
  const patterns: Record<string, string[]> = {
    'marathon': ['marathon'],
    'half': ['half'],
    'ultra': ['100', 'ultra', 'trail'],
    '10k': ['10k'],
    '5k': ['5k'],
  }

  const searchPatterns = patterns[type] || []

  return KNOWN_RACES.filter(race =>
    searchPatterns.some(pattern =>
      race.name.toLowerCase().includes(pattern) ||
      race.aliases.some(alias => alias.toLowerCase().includes(pattern))
    )
  )
}
