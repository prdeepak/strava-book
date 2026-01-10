import { Document } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { Race_2pLeft } from './Race_2pLeft'
import { Race_2pRight } from './Race_2pRight'

export interface Race_2pSpreadProps {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken?: string
    highlightLabel?: string
}

export const Race_2pSpread = ({
    activity,
    format,
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel
}: Race_2pSpreadProps) => (
    <Document>
        <Race_2pLeft
            activity={activity}
            format={format}
            theme={theme}
            highlightLabel={highlightLabel}
        />
        <Race_2pRight
            activity={activity}
            format={format}
            theme={theme}
            mapboxToken={mapboxToken}
        />
    </Document>
)

export interface Race_2pProps {
    activity: StravaActivity
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
}

export const Race_2p = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken
}: Race_2pProps) => (
    <Race_2pSpread
        activity={activity}
        format={format}
        theme={theme}
        mapboxToken={mapboxToken}
    />
)
