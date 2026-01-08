#!/usr/bin/env python3
"""
Curate Fixtures Script

Usage:
    python3 scripts/curate-fixtures.py <path-to-downloaded-json>

This script processes the raw Strava data downloaded from /fetch-fixtures
and creates a curated set of fixture files for testing.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path


def categorize_activities(activities):
    """Categorize activities by type and characteristics."""
    categories = {
        'races': {
            'ultra_marathon': [],
            'marathon': [],
            'half_marathon': [],
            'ten_k': [],
            'five_k': [],
            'other': []
        },
        'training': {
            'long_run': [],
            'tempo_run': [],
            'interval_run': [],
            'easy_run': []
        },
        'other': {
            'workout': [],
            'swim': [],
            'ride': [],
            'walk': [],
            'hike': [],
            'other': []
        },
        'special': {
            'with_photos': [],
            'with_many_photos': [],
            'with_comments': [],
            'with_description': [],
            'with_best_efforts': [],
            'with_prs': [],
            'high_elevation': [],
            'no_gps': [],
            'very_long': [],
            'very_short': []
        }
    }

    for activity in activities:
        distance_km = activity.get('distance', 0) / 1000
        duration_min = activity.get('moving_time', 0) / 60
        is_race = activity.get('workout_type') == 1
        is_run = activity.get('type') == 'Run'

        comprehensive = activity.get('comprehensiveData', {})
        photos = comprehensive.get('photos', [])
        comments = comprehensive.get('comments', [])

        # Categorize races
        if is_race and is_run:
            if distance_km >= 50:
                categories['races']['ultra_marathon'].append(activity)
            elif distance_km >= 40:
                categories['races']['marathon'].append(activity)
            elif distance_km >= 20:
                categories['races']['half_marathon'].append(activity)
            elif 9 <= distance_km <= 11:
                categories['races']['ten_k'].append(activity)
            elif 4 <= distance_km <= 6:
                categories['races']['five_k'].append(activity)
            else:
                categories['races']['other'].append(activity)

        # Categorize training runs
        elif is_run and not is_race:
            if distance_km >= 20:
                categories['training']['long_run'].append(activity)
            elif activity.get('workout_type') == 3:
                categories['training']['tempo_run'].append(activity)
            elif activity.get('workout_type') == 5:
                categories['training']['interval_run'].append(activity)
            else:
                categories['training']['easy_run'].append(activity)

        # Other activity types
        else:
            activity_type = activity.get('type', '').lower()
            if 'workout' in activity_type or 'weight' in activity_type:
                categories['other']['workout'].append(activity)
            elif 'swim' in activity_type:
                categories['other']['swim'].append(activity)
            elif 'ride' in activity_type or 'cycling' in activity_type:
                categories['other']['ride'].append(activity)
            elif 'walk' in activity_type:
                categories['other']['walk'].append(activity)
            elif 'hike' in activity_type:
                categories['other']['hike'].append(activity)
            else:
                categories['other']['other'].append(activity)

        # Special characteristics (can overlap)
        if len(photos) > 0:
            categories['special']['with_photos'].append(activity)
            if len(photos) >= 3:
                categories['special']['with_many_photos'].append(activity)

        if len(comments) > 0:
            categories['special']['with_comments'].append(activity)

        description = activity.get('description', '') or ''
        if len(description.strip()) > 20:
            categories['special']['with_description'].append(activity)

        best_efforts = activity.get('best_efforts', [])
        if best_efforts:
            categories['special']['with_best_efforts'].append(activity)
            if any(e.get('pr_rank') == 1 for e in best_efforts):
                categories['special']['with_prs'].append(activity)

        if activity.get('total_elevation_gain', 0) >= 500:
            categories['special']['high_elevation'].append(activity)

        polyline = activity.get('map', {}).get('summary_polyline', '')
        if not polyline:
            categories['special']['no_gps'].append(activity)

        if duration_min >= 240:
            categories['special']['very_long'].append(activity)

        if duration_min < 20:
            categories['special']['very_short'].append(activity)

    return categories


def score_activity(activity):
    """Score an activity by richness of data."""
    comprehensive = activity.get('comprehensiveData', {})
    score = 0
    score += len(comprehensive.get('photos', [])) * 3
    score += len(comprehensive.get('comments', [])) * 2
    score += 1 if activity.get('description') else 0
    score += len(activity.get('best_efforts', []))
    score += 1 if comprehensive.get('streams') else 0
    return score


def pick_best(arr):
    """Pick the best example from an array based on data richness."""
    if not arr:
        return None
    return max(arr, key=score_activity)


def select_diverse_fixtures(categories):
    """Select a diverse set of fixtures."""
    fixtures = {}

    # Races
    if categories['races']['ultra_marathon']:
        fixtures['race_ultramarathon'] = pick_best(categories['races']['ultra_marathon'])
    if categories['races']['marathon']:
        fixtures['race_marathon'] = pick_best(categories['races']['marathon'])
    if categories['races']['half_marathon']:
        fixtures['race_half_marathon'] = pick_best(categories['races']['half_marathon'])
    if categories['races']['ten_k']:
        fixtures['race_10k'] = pick_best(categories['races']['ten_k'])
    if categories['races']['five_k']:
        fixtures['race_5k'] = pick_best(categories['races']['five_k'])
    if categories['races']['other']:
        fixtures['race_other'] = pick_best(categories['races']['other'])

    # Training
    if categories['training']['long_run']:
        fixtures['training_long_run'] = pick_best(categories['training']['long_run'])
    if categories['training']['tempo_run']:
        fixtures['training_tempo'] = pick_best(categories['training']['tempo_run'])
    if categories['training']['interval_run']:
        fixtures['training_intervals'] = pick_best(categories['training']['interval_run'])
    if categories['training']['easy_run']:
        fixtures['training_easy'] = pick_best(categories['training']['easy_run'])

    # Other activities
    if categories['other']['workout']:
        fixtures['other_workout'] = pick_best(categories['other']['workout'])
    if categories['other']['swim']:
        fixtures['other_swim'] = pick_best(categories['other']['swim'])
    if categories['other']['ride']:
        fixtures['other_ride'] = pick_best(categories['other']['ride'])
    if categories['other']['walk']:
        fixtures['other_walk'] = pick_best(categories['other']['walk'])
    if categories['other']['hike']:
        fixtures['other_hike'] = pick_best(categories['other']['hike'])

    # Edge cases
    no_gps_run = next((a for a in categories['special']['no_gps'] if a.get('type') == 'Run'), None)
    if no_gps_run:
        fixtures['edge_no_gps'] = no_gps_run
    if categories['special']['very_long']:
        fixtures['edge_very_long'] = pick_best(categories['special']['very_long'])
    if categories['special']['very_short']:
        fixtures['edge_very_short'] = categories['special']['very_short'][0]
    if categories['special']['high_elevation']:
        fixtures['edge_high_elevation'] = pick_best(categories['special']['high_elevation'])

    # Rich content examples
    with_photos = set(id(a) for a in categories['special']['with_many_photos'])
    with_comments = set(id(a) for a in categories['special']['with_comments'])
    with_desc = set(id(a) for a in categories['special']['with_description'])

    rich_activity = next(
        (a for a in categories['special']['with_many_photos']
         if id(a) in with_comments and id(a) in with_desc),
        None
    )
    if rich_activity:
        fixtures['rich_full_content'] = rich_activity

    if categories['special']['with_prs']:
        fixtures['rich_with_prs'] = pick_best(categories['special']['with_prs'])

    return fixtures


def generate_summary(categories, fixtures):
    """Generate a markdown summary."""
    lines = [
        '# Fixture Curation Summary',
        '',
        f'Generated: {datetime.now().isoformat()}',
        '',
        '## Category Counts',
        '',
        '### Races',
        f'- Ultra Marathon (50km+): {len(categories["races"]["ultra_marathon"])}',
        f'- Marathon: {len(categories["races"]["marathon"])}',
        f'- Half Marathon: {len(categories["races"]["half_marathon"])}',
        f'- 10K: {len(categories["races"]["ten_k"])}',
        f'- 5K: {len(categories["races"]["five_k"])}',
        f'- Other races: {len(categories["races"]["other"])}',
        '',
        '### Training Runs',
        f'- Long runs (20km+): {len(categories["training"]["long_run"])}',
        f'- Tempo runs: {len(categories["training"]["tempo_run"])}',
        f'- Interval runs: {len(categories["training"]["interval_run"])}',
        f'- Easy runs: {len(categories["training"]["easy_run"])}',
        '',
        '### Other Activities',
        f'- Workouts: {len(categories["other"]["workout"])}',
        f'- Swims: {len(categories["other"]["swim"])}',
        f'- Rides: {len(categories["other"]["ride"])}',
        f'- Walks: {len(categories["other"]["walk"])}',
        f'- Hikes: {len(categories["other"]["hike"])}',
        f'- Other: {len(categories["other"]["other"])}',
        '',
        '### Special Characteristics',
        f'- With photos: {len(categories["special"]["with_photos"])}',
        f'- With 3+ photos: {len(categories["special"]["with_many_photos"])}',
        f'- With comments: {len(categories["special"]["with_comments"])}',
        f'- With description: {len(categories["special"]["with_description"])}',
        f'- With best efforts: {len(categories["special"]["with_best_efforts"])}',
        f'- With PRs: {len(categories["special"]["with_prs"])}',
        f'- High elevation (500m+): {len(categories["special"]["high_elevation"])}',
        f'- No GPS: {len(categories["special"]["no_gps"])}',
        f'- Very long (4h+): {len(categories["special"]["very_long"])}',
        f'- Very short (<20m): {len(categories["special"]["very_short"])}',
        '',
        '## Selected Fixtures',
        ''
    ]

    for key, activity in fixtures.items():
        dist_km = activity.get('distance', 0) / 1000
        comprehensive = activity.get('comprehensiveData', {})
        photos = len(comprehensive.get('photos', []))
        comments = len(comprehensive.get('comments', []))

        lines.extend([
            f'### {key}',
            f'- **Name:** {activity.get("name")}',
            f'- **Date:** {activity.get("start_date_local", "")[:10]}',
            f'- **Type:** {activity.get("type")} (workout_type: {activity.get("workout_type")})',
            f'- **Distance:** {dist_km:.1f} km',
            f'- **Duration:** {activity.get("moving_time", 0) // 60} min',
            f'- **Elevation:** {activity.get("total_elevation_gain", 0)} m',
            f'- **Photos:** {photos}, Comments: {comments}, Kudos: {activity.get("kudos_count", 0)}',
            f'- **Description:** {"Yes" if activity.get("description") else "No"}',
            f'- **Best efforts:** {len(activity.get("best_efforts", []))}',
            ''
        ])

    return '\n'.join(lines)


def generate_typescript_loader(fixtures, output_dir):
    """Generate TypeScript loader file."""
    fixture_keys = list(fixtures.keys())

    lines = [
        '// Auto-generated fixture loader',
        f'// Generated: {datetime.now().isoformat()}',
        '',
        "import { StravaActivity } from '@/lib/strava'",
        '',
        '// Individual fixtures',
    ]

    for key in fixture_keys:
        safe_key = key.replace('-', '_')
        lines.append(f"import {safe_key}Json from './{key}.json'")

    lines.extend([
        '',
        '// All fixtures combined',
        "import allFixturesJson from './all-fixtures.json'",
        '',
        '// Raw activities (full year data)',
        "import rawActivitiesJson from './raw-activities.json'",
        '',
        '// Type the imports',
        'type ComprehensiveActivity = StravaActivity & {',
        '  comprehensiveData: {',
        '    photos: Array<{ unique_id: string; urls: Record<string, string> }>',
        '    comments: Array<{ id: number; text: string; athlete: { firstname: string; lastname: string } }>',
        '    streams: Record<string, { data: number[] | [number, number][] }>',
        '    fetchedAt: string',
        '  }',
        '}',
        '',
        'export const fixtures = {',
    ])

    for key in fixture_keys:
        safe_key = key.replace('-', '_')
        lines.append(f'  {safe_key}: {safe_key}Json as unknown as ComprehensiveActivity,')

    lines.extend([
        '}',
        '',
        'export const allFixtures = allFixturesJson as unknown as Record<string, ComprehensiveActivity>',
        '',
        'export const rawActivities = rawActivitiesJson as unknown as {',
        '  activities: ComprehensiveActivity[]',
        '  metadata: {',
        '    totalCount: number',
        '    dateRange: { after: string; before: string }',
        '    fetchedAt: string',
        '  }',
        '}',
        '',
        '// Convenience groupings',
        'export const raceFixtures = {',
        '  ultramarathon: fixtures.race_ultramarathon,',
        '  marathon: fixtures.race_marathon,',
        '  halfMarathon: fixtures.race_half_marathon,',
        '  thirtyK: fixtures.race_other,',
        '}',
        '',
        'export const trainingFixtures = {',
        '  longRun: fixtures.training_long_run,',
        '  easy: fixtures.training_easy,',
        '}',
        '',
        'export const edgeCaseFixtures = {',
        '  noGps: fixtures.edge_no_gps,',
        '  veryLong: fixtures.edge_very_long,',
        '  veryShort: fixtures.edge_very_short,',
        '  highElevation: fixtures.edge_high_elevation,',
        '}',
        ''
    ])

    return '\n'.join(lines)


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/curate-fixtures.py <path-to-json>')
        print('')
        print('Example:')
        print('  python3 scripts/curate-fixtures.py ~/Downloads/strava-fixtures.json')
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    print(f'Reading: {input_path}')

    if not input_path.exists():
        print(f'File not found: {input_path}')
        sys.exit(1)

    with open(input_path) as f:
        data = json.load(f)

    activities = data.get('activities', [])
    print(f'Loaded {len(activities)} activities')

    # Categorize
    categories = categorize_activities(activities)

    # Select fixtures
    fixtures = select_diverse_fixtures(categories)

    print(f'Selected {len(fixtures)} diverse fixtures')

    # Output directory
    script_dir = Path(__file__).parent
    output_dir = script_dir.parent / 'web' / 'lib' / 'testing' / 'fixtures'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write individual fixture files
    for key, activity in fixtures.items():
        file_path = output_dir / f'{key}.json'
        with open(file_path, 'w') as f:
            json.dump(activity, f, indent=2)
        print(f'  Written: {key}.json')

    # Write combined fixtures file
    all_fixtures_path = output_dir / 'all-fixtures.json'
    with open(all_fixtures_path, 'w') as f:
        json.dump(fixtures, f, indent=2)
    print(f'  Written: all-fixtures.json')

    # Write full raw data (for year-level tests)
    raw_data_path = output_dir / 'raw-activities.json'
    with open(raw_data_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f'  Written: raw-activities.json')

    # Write summary
    summary = generate_summary(categories, fixtures)
    summary_path = output_dir / 'SUMMARY.md'
    with open(summary_path, 'w') as f:
        f.write(summary)
    print(f'  Written: SUMMARY.md')

    # Write TypeScript loader
    loader_content = generate_typescript_loader(fixtures, output_dir)
    loader_path = output_dir / 'index.ts'
    with open(loader_path, 'w') as f:
        f.write(loader_content)
    print(f'  Written: index.ts')

    print('')
    print('Done! Fixtures written to:')
    print(f'  {output_dir}')
    print('')
    print('Summary:')
    print('\n'.join(summary.split('\n')[:40]))
    print('...')


if __name__ == '__main__':
    main()
