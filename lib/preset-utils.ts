/**
 * Utility functions for Filter Presets
 * Handles dynamic calculation of top regions and segments
 */

import type { ComparisonData, DataRecord, FilterState } from './types'

/**
 * Calculate top regions based on market value for a specific year
 * @param data - The comparison data
 * @param year - The year to evaluate (default 2024)
 * @param topN - Number of top regions to return (default 3)
 * @returns Array of top region names
 */
export function getTopRegionsByMarketValue(
  data: ComparisonData | null,
  year: number = 2023,
  topN: number = 3
): string[] {
  if (!data) return []

  // Only consider region-level geographies (not country-level sub-components).
  // Country-level geographies (U.S., Canada, U.K., etc.) are sub-sets of their
  // parent regions. Including both a region AND one of its countries in the same
  // preset would cause the country records to be merged into the parent bar,
  // making it appear as though fewer geographies are shown in the chart.
  const regionGeographies = new Set<string>(data.dimensions.geographies.regions)
  const countryGeographies = new Set<string>(
    Object.values(data.dimensions.geographies.countries).flat()
  )

  // Eligible geographies: regions (not countries, not Global)
  // Fall back to all non-Global geographies when no region metadata is available.
  const hasRegions = regionGeographies.size > 0
  const isEligible = (geo: string): boolean => {
    if (geo === 'Global') return false
    if (hasRegions) {
      // Accept regions; skip pure-country geographies
      return regionGeographies.has(geo) || (!countryGeographies.has(geo))
    }
    return true
  }

  // Get all value data records
  const records = data.data.value.geography_segment_matrix

  // Calculate total market value by geography for the specified year
  const geographyTotals = new Map<string, number>()

  records.forEach((record: DataRecord) => {
    const geography = record.geography
    if (!isEligible(geography)) return

    const value = record.time_series[year] || 0
    const currentTotal = geographyTotals.get(geography) || 0
    geographyTotals.set(geography, currentTotal + value)
  })

  // Sort geographies by total value and get top N
  const sortedGeographies = Array.from(geographyTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([geography]) => geography)

  return sortedGeographies
}

/**
 * Get all first-level segments for a given segment type
 * @param data - The comparison data
 * @param segmentType - The segment type to get segments for
 * @returns Array of first-level segment names
 */
export function getFirstLevelSegments(
  data: ComparisonData | null,
  segmentType: string
): string[] {
  if (!data) return []

  const segmentDimension = data.dimensions.segments[segmentType]
  if (!segmentDimension) return []

  const hierarchy = segmentDimension.hierarchy || {}
  const allSegments = segmentDimension.items || []

  // Find root segments (those that are parents but not children of any other segment)
  const allChildren = new Set(Object.values(hierarchy).flat())
  const firstLevelSegments: string[] = []

  // Add all segments that have children but are not children themselves
  Object.keys(hierarchy).forEach(parent => {
    if (!allChildren.has(parent) && hierarchy[parent].length > 0) {
      firstLevelSegments.push(parent)
    }
  })

  // Also add standalone segments that are neither parents nor children
  allSegments.forEach(segment => {
    if (!allChildren.has(segment) && !hierarchy[segment]) {
      firstLevelSegments.push(segment)
    }
  })

  return firstLevelSegments.sort()
}

/**
 * Get the first available segment type from the data
 * @param data - The comparison data
 * @returns The first segment type name or null
 */
export function getFirstSegmentType(data: ComparisonData | null): string | null {
  if (!data || !data.dimensions.segments) return null
  
  const segmentTypes = Object.keys(data.dimensions.segments)
  return segmentTypes.length > 0 ? segmentTypes[0] : null
}

/**
 * Calculate top regions based on CAGR (Compound Annual Growth Rate)
 * @param data - The comparison data
 * @param topN - Number of top regions to return (default 2)
 * @returns Array of top region names sorted by CAGR
 */
export function getTopRegionsByCAGR(
  data: ComparisonData | null,
  topN: number = 2
): string[] {
  if (!data) return []

  // Only consider region-level geographies to avoid selecting both a region and
  // one of its constituent countries (which would cause bars to merge in the chart).
  const regionGeographies = new Set<string>(data.dimensions.geographies.regions)
  const countryGeographies = new Set<string>(
    Object.values(data.dimensions.geographies.countries).flat()
  )
  const hasRegions = regionGeographies.size > 0
  const isEligible = (geo: string): boolean => {
    if (geo === 'Global') return false
    if (hasRegions) return regionGeographies.has(geo) || !countryGeographies.has(geo)
    return true
  }

  // Get all value data records
  const records = data.data.value.geography_segment_matrix

  const geographyCAGRs = new Map<string, number[]>()

  records.forEach((record: DataRecord) => {
    const geography = record.geography
    if (!isEligible(geography)) return

    if (record.cagr !== undefined && record.cagr !== null) {
      const cagrs = geographyCAGRs.get(geography) || []
      cagrs.push(record.cagr)
      geographyCAGRs.set(geography, cagrs)
    }
  })

  const avgCAGRs = Array.from(geographyCAGRs.entries()).map(([geography, cagrs]) => ({
    geography,
    avgCAGR: cagrs.reduce((a, b) => a + b, 0) / cagrs.length
  }))

  const sortedGeographies = avgCAGRs
    .sort((a, b) => b.avgCAGR - a.avgCAGR)
    .slice(0, topN)
    .map(item => item.geography)

  return sortedGeographies
}

/**
 * Calculate top countries based on CAGR (Compound Annual Growth Rate)
 * @param data - The comparison data
 * @param topN - Number of top countries to return (default 5)
 * @returns Array of top country names sorted by CAGR
 */
export function getTopCountriesByCAGR(
  data: ComparisonData | null,
  topN: number = 5
): string[] {
  if (!data) return []

  // Get all value data records
  const records = data.data.value.geography_segment_matrix

  // Calculate average CAGR for each geography
  // Treat all geographies as single entities - aggregate by name
  const geographyCAGRs = new Map<string, number[]>()

  records.forEach((record: DataRecord) => {
    const geography = record.geography

    // Skip global level
    if (geography === 'Global') return

    // Treat all geographies as single entities - aggregate by name
    if (record.cagr !== undefined && record.cagr !== null) {
      const cagrs = geographyCAGRs.get(geography) || []
      cagrs.push(record.cagr)
      geographyCAGRs.set(geography, cagrs)
    }
  })

  // Calculate average CAGR for each geography
  const avgCAGRs = Array.from(geographyCAGRs.entries()).map(([geography, cagrs]) => ({
    geography,
    avgCAGR: cagrs.reduce((a, b) => a + b, 0) / cagrs.length
  }))

  // Sort geographies by average CAGR and get top N
  const sortedGeographies = avgCAGRs
    .sort((a, b) => b.avgCAGR - a.avgCAGR) // Sort by CAGR descending
    .slice(0, topN)
    .map(item => item.geography)

  return sortedGeographies
}

/**
 * Create dynamic filter configuration for Top Market preset
 * @param data - The comparison data
 * @returns Partial FilterState with dynamic values
 */
export function createTopMarketFilters(data: ComparisonData | null): Partial<FilterState> {
  const topRegions = getTopRegionsByMarketValue(data, 2023, 3)
  const firstSegmentType = getFirstSegmentType(data)
  const firstLevelSegments = firstSegmentType
    ? getFirstLevelSegments(data, firstSegmentType)
    : []

  return {
    viewMode: 'geography-mode', // Geography on X-axis, segments as series
    geographies: topRegions,
    segments: firstLevelSegments,
    segmentType: firstSegmentType || 'By Technology',
    yearRange: [2023, 2027],
    dataType: 'value'
  }
}

/**
 * Create dynamic filter configuration for Growth Leaders preset
 * Identifies top 2 regions with highest CAGR and uses first segment type with all first-level segments
 */
export function createGrowthLeadersFilters(data: ComparisonData | null): Partial<FilterState> {
  if (!data) return {
    viewMode: 'geography-mode',
    yearRange: [2025, 2031],
    dataType: 'value'
  }

  // Get top 2 regions with highest CAGR
  const topRegions = getTopRegionsByCAGR(data, 2)
  const firstSegmentType = getFirstSegmentType(data)
  const firstLevelSegments = firstSegmentType
    ? getFirstLevelSegments(data, firstSegmentType)
    : []

  return {
    viewMode: 'geography-mode', // Geography on X-axis, segments as series
    geographies: topRegions,
    segments: firstLevelSegments,
    segmentType: firstSegmentType || 'By Technology',
    yearRange: [2025, 2031],
    dataType: 'value'
  }
}

/**
 * Create dynamic filter configuration for Emerging Markets preset
 * Identifies top 5 countries with highest CAGR and uses first segment type with all first-level segments
 */
export function createEmergingMarketsFilters(data: ComparisonData | null): Partial<FilterState> {
  if (!data) return {
    viewMode: 'geography-mode',
    yearRange: [2025, 2031],
    dataType: 'value'
  }

  // Get top 5 countries with highest CAGR
  const topCountries = getTopCountriesByCAGR(data, 5)
  const firstSegmentType = getFirstSegmentType(data)
  const firstLevelSegments = firstSegmentType
    ? getFirstLevelSegments(data, firstSegmentType)
    : []

  return {
    viewMode: 'geography-mode', // Geography on X-axis, segments as series
    geographies: topCountries,
    segments: firstLevelSegments,
    segmentType: firstSegmentType || 'By Technology',
    yearRange: [2025, 2031],
    dataType: 'value'
  }
}
