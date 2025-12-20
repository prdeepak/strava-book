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

// OPTIONAL: Register a hand-drawn font for realism
// Font.register({
//   family: 'Handwritten',
//   src: 'path/to/your/handwritten-font.ttf',
// });

// Define the data structure passed to the component
export interface ScrapbookPageProps {
  title: string;
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
  // The main crumpled paper texture covering the whole page
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  container: {
    flex: 1,
    padding: 20, // Internal padding away from edge
    position: 'relative',
    // fontFamily: 'Handwritten', // Uncomment if using custom font
    fontFamily: 'Helvetica',
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
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 100, // Text on top
    position: 'relative',
  },
  // --- Top Note Section ---
  noteSection: {
    position: 'relative',
    alignSelf: 'center',
    width: 450,
    height: 130,
    marginBottom: 20,
    padding: 20,
    paddingTop: 30, // Make room for pin
  },
  noteBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  noteTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  noteSubtitle: { fontSize: 10, marginBottom: 10 },
  noteBody: { fontSize: 10, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.4 },
  noteFooter: { fontSize: 9, color: '#555' },

  // --- Main Photos Section ---
  mainPhotosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    height: 220,
  },
  washiFrameContainer: {
    width: '48%',
    height: '100%',
    position: 'relative',
    padding: 15, // Padding for the image inside the frame area
  },
  washiFrameBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 10, // Frame on top of photo
  },
  mainPhotoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: 4,
    zIndex: 0, // Photo behind frame
  },

  // --- Stats Tags Section ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    height: 60,
    paddingHorizontal: 10,
  },
  tagContainer: {
    width: '22%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 15, // Adjust based on tag asset hole position
  },
  tagBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  tagValue: { fontSize: 16, fontWeight: 'bold' },
  tagLabel: { fontSize: 9, textTransform: 'uppercase', color: '#555' },

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
    fontSize: 10, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase',
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
  effortText: { fontSize: 9 },

  kudosContainer: {
    width: '25%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  thumbsUpIcon: { width: 30, height: 30, marginRight: 10 },
  kudosValue: { fontSize: 30, fontWeight: 'bold' },

  // --- Footer Section ---
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
    marginTop: 'auto', // Push to bottom
  },
  polaroidContainer: {
    width: '18%',
    height: 120,
    position: 'relative',
    padding: 8, // Internal padding for photo
    paddingBottom: 25, // Space for caption area
    // Slight rotations for realism (requires trial and error in PDF)
    transform: 'rotate(-3deg)',
  },
  polaroidBg: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
  },
  polaroidImage: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#ddd' },
  polaroidCaption: { position: 'absolute', bottom: 5, left: 10, fontSize: 8, color: '#555' },

  commentsContainer: {
    width: '25%',
    position: 'relative',
    padding: 15,
    paddingTop: 30,
  },
  commentsText: { fontSize: 10, lineHeight: 1.5 },
});

// Internal component that uses the ScrapbookPageProps interface
const ScrapbookPDFInternal: React.FC<ScrapbookPageProps> = (props) => {
  const {
    title, date, location, description, trainingLoad,
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
            <Text style={styles.bannerText}>{title}</Text>
          </View>

          {/* 3. Pinned Note Details */}
          <View style={styles.noteSection}>
            <Image src="/assets/note-paper-pinned.png" style={styles.noteBg} />
            <Text style={styles.noteTitle}>{date}</Text>
            <Text style={styles.noteSubtitle}>{location}</Text>
            <Text style={styles.noteBody}>{description}</Text>
            <Text style={styles.noteFooter}>{trainingLoad}</Text>
          </View>

          {/* 4. Main Photos with Washi Frames */}
          <View style={styles.mainPhotosRow}>
            {/* Photo 1 */}
            <View style={styles.washiFrameContainer}>
              <Image src={mainPhotoUrl} style={styles.mainPhotoImage} />
              <Image src="/assets/wash-frame.png" style={styles.washiFrameBg} />
            </View>
            {/* Photo 2 (Map) */}
            <View style={[styles.washiFrameContainer, { transform: 'rotate(2deg)' }]}>
              <Image src={mapPhotoUrl} style={styles.mainPhotoImage} />
              <Image src="/assets/wash-frame.png" style={styles.washiFrameBg} />
            </View>
          </View>

          {/* 5. Stats Tags */}
          <View style={styles.statsRow}>
            <TagItem value={stats.distance} label="KILOMETERS" />
            <TagItem value={stats.time} label="TIME" />
            <TagItem value={stats.avgPace} label="AVG PACE" />
            <TagItem value={stats.elevation} label="ELEVATION" />
          </View>

          {/* 6. Data Row (Splits, Efforts, Kudos) */}
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
              <Image src="/assets/tag-brown.png" style={styles.tagBg} />
              <Image src="/assets/thumbs-up.png" style={styles.thumbsUpIcon} />
              <Text style={styles.kudosValue}>{kudosCount}</Text>
            </View>
          </View>

          {/* 7. Footer (Polaroids & Comments) */}
          <View style={styles.footerRow}>
            {/* Map up to 4 extra photos - only show if photos exist */}
            {morePhotosUrls.filter(url => url).length > 0 && morePhotosUrls.filter(url => url).map((photoUrl, index) => {
              // Slightly vary rotation for visual interest
              const rotation = index % 2 === 0 ? -3 : 2;
              return (
                <View key={index} style={[styles.polaroidContainer, { transform: `rotate(${rotation}deg)` }]}>
                  <Image src="/assets/polaroid-frame.png" style={styles.polaroidBg} />
                  <Image src={photoUrl} style={styles.polaroidImage} />
                  <Text style={styles.polaroidCaption}>more photos</Text>
                </View>
              )
            })}

            {/* Comments Note - only show if comments exist */}
            {moreComments && moreComments.trim() && (
              <View style={styles.commentsContainer}>
                <Image src="/assets/torn-paper-wide.png" style={styles.tornPaperBg} />
                <Text style={styles.sectionTitle}>more comments</Text>
                <Text style={styles.commentsText}>{moreComments}</Text>
              </View>
            )}
          </View>

        </View>
      </Page>
    </Document>
  );
};

// Helper component for the Stat Tags
const TagItem = ({ value, label }: { value: string, label: string }) => (
  <View style={styles.tagContainer}>
    <Image src="/assets/tag-brown.png" style={styles.tagBg} />
    <Text style={styles.tagValue}>{value}</Text>
    <Text style={styles.tagLabel}>{label}</Text>
  </View>
);

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

  // Get additional photos (if any)
  const morePhotosUrls: string[] = [];
  // Note: Strava API doesn't typically provide multiple photos in the standard response
  // This would need to be populated from activity.photos if available

  // Get comments
  const comments = (activity.comments || []).slice(0, 3);
  const moreComments = comments.map(c => `${c.athlete.firstname}: ${c.text}`).join('\n\n');

  const scrapbookProps: ScrapbookPageProps = {
    title: activity.name,
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