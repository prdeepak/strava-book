import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import { StravaActivity } from '@/lib/strava';
import { resolveActivityLocation } from '@/lib/activity-utils';
import { SplitsChartSVG } from '@/lib/generateSplitsChart';

// Register handwritten fonts for scrapbook aesthetic
Font.register({
  family: 'IndieFlower',
  src: '/fonts/IndieFlower-Regular.ttf',
});
Font.register({
  family: 'PatrickHand',
  src: '/fonts/PatrickHand-Regular.ttf',
});

// Define the data structure passed to the component
export interface ScrapbookPageProps {
  title: string;
  titleFontSize: number; // Dynamic font size based on title length
  date: string;
  location: string;
  description: string;
  trainingLoad: string;
  mainPhotoUrl: string;
  mapPhotoUrl: string;
  stats: {
    distance: string;
    time: string;
    avgPace: string;
    elevation: string;
  };
  displaySplits: Array<{ split: number; label: string; moving_time: number; distance: number; elevation_difference: number }>;
  totalTime: number;
  bestEfforts: Array<{ label: string; value: string }>;
  kudosCount: number;
  morePhotosUrls?: string[]; // Array of up to 4 extra photo URLs
  moreComments?: string;
}

// Standard Letter size points: 612 x 792
const styles = StyleSheet.create({
  page: {
    position: 'relative',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 0, // Full bleed background
  },
  // The main crumpled paper texture covering the whole page with bleed
  backgroundImage: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: '110%',
    height: '110%',
    zIndex: -100,
  },
  container: {
    flex: 1,
    padding: 20, // Internal padding away from edge
    position: 'relative',
    fontFamily: 'PatrickHand',
    color: '#333',
  },
  // --- Header Section ---
  headerWrapper: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    position: 'relative',
    height: 60,
    justifyContent: 'center',
  },
  bannerBg: {
    position: 'absolute',
    width: 500,
    height: 70,
    top: -5,
    zIndex: 0, // Background behind text
  },
  bannerText: {
    fontSize: 28,
    fontFamily: 'IndieFlower',
    textAlign: 'center',
    position: 'relative',
    top: -5, // Move up slightly to center within banner
    maxWidth: '50%', // Constrain to 50% of banner width
    alignSelf: 'center', // Center horizontally
  },

  // --- Main Photos Section ---
  mainPhotosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    height: 220,
  },
  photoContainer: {
    width: '48%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainPhotoImage: {
    width: '90%',
    height: '90%',
    objectFit: 'cover',
    borderRadius: 4,
    zIndex: 0
  },
  washiCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  cornerTopLeft: {
    top: 10,
    left: 10,
  },
  cornerTopRight: {
    top: 10,
    right: 10,
    transform: 'rotate(90deg)',
  },
  cornerBottomLeft: {
    bottom: 10,
    left: 10,
    transform: 'rotate(-90deg)',
  },
  cornerBottomRight: {
    bottom: 10,
    right: 10,
    transform: 'rotate(180deg)',
  },

  // --- Top Note Section ---
  noteSection: {
    position: 'relative',
    alignSelf: 'center',
    alignItems: 'flex-start',
    width: 540,
    minHeight: 180,
    marginBottom: 10,
    // padding: 10,
    paddingLeft: 20,
    paddingBottom: 20,
  },
  noteBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
    objectFit: 'fill',
  },
  noteTitle: {
    fontFamily: 'PatrickHand', fontSize: 12,
    marginBottom: 4, paddingTop: 20, paddingLeft: 20
  },
  noteSubtitle: { fontFamily: 'PatrickHand', fontSize: 10, marginBottom: 10, paddingLeft: 20 },
  noteBody: { fontFamily: 'PatrickHand', fontSize: 10, marginBottom: 10, lineHeight: 1.4, paddingLeft: 20 },
  noteFooter: { fontFamily: 'PatrickHand', fontSize: 9, color: '#666', paddingLeft: 20 },

  // --- Stats Washi Tape Section ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    height: 70,
    paddingHorizontal: 10,
  },
  washiContainer: {
    width: '22%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  washiBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
    objectFit: 'fill',
  },
  washiValue: { fontFamily: 'PatrickHand', fontSize: 18, fontWeight: 'bold', color: '#333' },
  washiLabel: { fontFamily: 'PatrickHand', fontSize: 9, textTransform: 'uppercase', color: '#555', marginTop: 2 },

  // --- Data / Splits / Kudos Row ---
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 150,
    marginBottom: 20,
  },
  // Reusable style for torn paper containers in this row
  paperContainer: {
    position: 'relative',
    padding: 15,
    backgroundColor: '#f9f7f1', // Fallback if image fails
    border: '1px solid #ccc', // Fallback border
  },
  tornPaperBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  sectionTitle: {
    fontFamily: 'PatrickHand',
    fontSize: 10,
    marginBottom: 5,
    textTransform: 'uppercase',
  },

  // Specific Data Containers
  splitsContainer: { width: '30%' },
  splitsChart: { width: '100%', height: 100 },

  bestEffortsContainer: { width: '40%' },
  effortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '1px dashed #ccc',
    paddingVertical: 4,
  },
  effortText: { fontFamily: 'PatrickHand', fontSize: 9 },

  kudosContainer: {
    width: '25%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  kudosBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  thumbsUpIcon: { width: 30, height: 30, marginRight: 10 },
  kudosValue: { fontFamily: 'PatrickHand', fontSize: 30 },

  // --- Polaroid Section ---
  polaroidRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  polaroidContainer: {
    width: 110,
    height: 130,
    position: 'relative',
    padding: 8,
    paddingBottom: 25,
    marginHorizontal: 8,
  },
  polaroidBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  polaroidImage: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 'calc(90% - 16px)',
    height: 'calc(90% - 40px)',
    objectFit: 'cover',
    backgroundColor: '#ddd',
  },
  polaroidCaption: {
    position: 'absolute',
    bottom: 5,
    left: 10,
    fontSize: 8,
    color: '#555',
  },
});

// Internal component that uses the ScrapbookPageProps interface
const ScrapbookPDFInternal: React.FC<ScrapbookPageProps> = (props) => {
  const {
    title, titleFontSize, date, location, description, trainingLoad,
    mainPhotoUrl, mapPhotoUrl, stats,
    displaySplits, totalTime, bestEfforts, kudosCount,
    morePhotosUrls = [], moreComments
  } = props;

  // Helper for Best Efforts table rows
  const renderEffortRow = (label: string, value: string, index: number) => (
    <View style={styles.effortRow} key={index}>
      <Text style={styles.effortText}>{label}</Text>
      <Text style={styles.effortText}>{value}</Text>
    </View>
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* 1. The Main Background Texture */}
        {/* IMPORTANT: You need this asset in your project */}
        <Image src="/assets/scrapbook-bg.png" style={styles.backgroundImage} fixed />

        <View style={styles.container}>

          {/* 2. Header Banner */}
          <View style={styles.headerWrapper}>
            <Image src="/assets/banner.png" style={styles.bannerBg} />
            <Text style={[styles.bannerText, { fontSize: titleFontSize }]}>{title}</Text>
          </View>

          {/* 3. Main Photos with Washi Corner Tape */}
          <View style={styles.mainPhotosRow}>
            {/* Photo 1 */}
            <View style={styles.photoContainer}>
              <Image src={mainPhotoUrl} style={styles.mainPhotoImage} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerTopLeft]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerTopRight]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerBottomLeft]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerBottomRight]} />
            </View>
            {/* Photo 2 (Map) */}
            <View style={[styles.photoContainer, { transform: 'rotate(2deg)' }]}>
              <Image src={mapPhotoUrl} style={styles.mainPhotoImage} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerTopLeft]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerTopRight]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerBottomLeft]} />
              <Image src="/assets/washi-corner.png" style={[styles.washiCorner, styles.cornerBottomRight]} />
            </View>
          </View>

          {/* 4. Overview Note Details */}
          <View style={styles.noteSection}>
            <Image src="/assets/torn-paper-wide.png" style={styles.noteBg} />
            <Text style={styles.noteTitle}>{date}</Text>
            <Text style={styles.noteSubtitle}>{location}</Text>
            <Text style={styles.noteBody}>{description}</Text>
            <Text style={styles.noteFooter}>{trainingLoad}</Text>
          </View>

          {/* 5. Stats Washi Tape */}
          <View style={styles.statsRow}>
            <WashiItem value={stats.distance} label="KILOMETERS" color="coral" />
            <WashiItem value={stats.time} label="TIME" color="mint" />
            <WashiItem value={stats.avgPace} label="AVG PACE" color="yellow" />
            <WashiItem value={stats.elevation} label="ELEVATION" color="blue" />
          </View>

          {/* 6. Polaroid Photos Row */}
          {morePhotosUrls.filter(url => url).length > 0 && (() => {
            // Available width ~550px, leave gaps between polaroids
            const polaroidWidth = 165;
            const polaroidHeight = polaroidWidth * 1.2;

            return (
              <View style={styles.polaroidRow}>
                {morePhotosUrls.filter(url => url).map((photoUrl, index) => {
                  // Slightly vary rotation for visual interest
                  const rotation = index % 2 === 0 ? -3 : 2;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.polaroidContainer,
                        {
                          transform: `rotate(${rotation}deg)`,
                          width: polaroidWidth,
                          height: polaroidHeight
                        }
                      ]}
                    >
                      <Image src={photoUrl} style={styles.polaroidImage} />
                      <Image src="/assets/polaroid-frame.png" style={styles.polaroidBg} />
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* 7. Data Row (Splits, Efforts, Kudos) */}
          <View style={styles.dataRow}>
            {/* Splits Graph */}
            <View style={[styles.paperContainer, styles.splitsContainer]}>
              <Image src="/assets/torn-paper-wide.png" style={styles.tornPaperBg} />
              <Text style={styles.sectionTitle}>SPLITS</Text>
              {/* Render actual splits chart */}
              <SplitsChartSVG
                splits={displaySplits}
                totalTime={totalTime}
                width={180}
                height={100}
              />
            </View>

            {/* Best Efforts Table */}
            <View style={[styles.paperContainer, styles.bestEffortsContainer]}>
              <Image src="/assets/torn-paper-wide.png" style={styles.tornPaperBg} />
              <Text style={styles.sectionTitle}>BEST EFFORTS</Text>
              <View>
                {bestEfforts.map((effort, i) => renderEffortRow(effort.label, effort.value, i))}
              </View>
            </View>

            {/* Kudos Tag */}
            <View style={styles.kudosContainer}>
              <Image src="/assets/tag-brown.png" style={styles.kudosBg} />
              <Image src="/assets/thumbs-up.png" style={styles.thumbsUpIcon} />
              <Text style={styles.kudosValue}>{kudosCount}</Text>
            </View>
          </View>

        </View>
      </Page>
    </Document>
  );
};

// Helper component for the Washi Tape Stats
const WashiItem = ({ value, label, color }: { value: string, label: string, color: 'coral' | 'mint' | 'yellow' | 'blue' }) => {
  const washiSrc = `/assets/washi-${color}.png`;
  return (
    <View style={styles.washiContainer}>
      <Image src={washiSrc} style={styles.washiBg} />
      <Text style={styles.washiValue}>{value}</Text>
      <Text style={styles.washiLabel}>{label}</Text>
    </View>
  );
};

// Main export component that accepts StravaActivity
interface ScrapbookPDFProps {
  activity: StravaActivity;
  mapboxToken?: string;
}

const ScrapbookPDF: React.FC<ScrapbookPDFProps> = ({ activity, mapboxToken }) => {
  // Transform StravaActivity to ScrapbookPageProps
  const location = resolveActivityLocation(activity);

  // Get Strava photo if available
  const stravaPhoto = activity.photos?.primary?.urls?.['600']
    ? `/api/proxy-image?url=${encodeURIComponent(activity.photos.primary.urls['600'])}`
    : '/assets/placeholder-photo.jpg';

  // Get satellite map if token available
  let satelliteMap = '/assets/placeholder-map.jpg';
  if (mapboxToken && activity.map.summary_polyline) {
    const pathParam = `path-5+fc4c02-0.8(${encodeURIComponent(activity.map.summary_polyline)})`;
    const rawUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pathParam}/auto/800x400?access_token=${mapboxToken}&logo=false&attrib=false`;
    satelliteMap = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
  }

  // Calculate stats
  const distanceKm = (activity.distance / 1000).toFixed(2);
  const movingTime = new Date(activity.moving_time * 1000).toISOString().substr(11, 8);
  const paceSeconds = activity.moving_time / (activity.distance / 1000);
  const paceMin = Math.floor(paceSeconds / 60);
  const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0');
  const avgPace = `${paceMin}:${paceSec}/km`;
  const elevation = `${activity.total_elevation_gain}m`;

  // Format date
  const date = new Date(activity.start_date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Prepare best efforts
  const bestEfforts = (activity.best_efforts || []).slice(0, 6).map(effort => {
    const effortPaceSeconds = effort.elapsed_time / (effort.distance / 1000);
    const effortPaceMin = Math.floor(effortPaceSeconds / 60);
    const effortPaceSec = Math.round(effortPaceSeconds % 60).toString().padStart(2, '0');
    return {
      label: effort.name,
      value: `${effortPaceMin}:${effortPaceSec}/km`
    };
  });

  // Prepare splits data - prefer laps over splits
  const rawLaps = activity.laps || [];
  const rawSplits = activity.splits_metric || [];

  let displaySplits = [];
  if (rawLaps.length > 0) {
    // Use laps if available
    displaySplits = rawLaps.map(lap => ({
      split: lap.lap_index,
      label: lap.name || `Lap ${lap.lap_index}`,
      moving_time: lap.moving_time,
      distance: lap.distance,
      elevation_difference: lap.total_elevation_gain
    }));
  } else {
    // Fall back to splits
    displaySplits = rawSplits.map(s => ({ ...s, label: s.split.toString() }));
  }

  // Get additional photos from activity.allPhotos (up to 4 for polaroid row)
  // Skip the first photo since Strava returns the primary photo first
  const morePhotosUrls: string[] = (activity.allPhotos || [])
    .slice(1, 5) // Skip first (primary), take next 4
    .map(photo => {
      // Use 600px size if available, otherwise fall back to 5000px
      const photoUrl = photo.urls['600'] || photo.urls['5000'] || Object.values(photo.urls)[0]
      return photoUrl ? `/api/proxy-image?url=${encodeURIComponent(photoUrl)}` : ''
    })
    .filter(url => url) // Remove any empty URLs

  // Get comments
  const comments = (activity.comments || []).slice(0, 3);
  const moreComments = comments.map(c => `${c.athlete.firstname}: ${c.text}`).join('\n\n');

  // Calculate dynamic font size based on title length
  // Max 28 for short titles, scale down for longer ones
  // Rough estimate: 50% of banner width = ~250px, each char ~10-15px at size 28
  const titleLength = activity.name.length;
  let titleFontSize = 28;
  if (titleLength > 20) {
    // Scale down: for every 5 chars over 20, reduce by 2px
    const excess = titleLength - 20;
    titleFontSize = Math.max(14, 28 - Math.floor(excess / 5) * 2);
  }

  const scrapbookProps: ScrapbookPageProps = {
    title: activity.name,
    titleFontSize,
    date,
    location,
    description: activity.description || 'A memorable run',
    trainingLoad: `${activity.type} • Training`,
    mainPhotoUrl: stravaPhoto,
    mapPhotoUrl: satelliteMap,
    stats: {
      distance: distanceKm,
      time: movingTime,
      avgPace,
      elevation
    },
    displaySplits,
    totalTime: activity.moving_time,
    bestEfforts,
    kudosCount: activity.kudos_count || 0,
    morePhotosUrls,
    moreComments
  };

  return <ScrapbookPDFInternal {...scrapbookProps} />;
};

export default ScrapbookPDF;