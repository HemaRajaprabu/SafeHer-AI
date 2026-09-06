import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocation } from '@/hooks/use-location';
import {
  analyzeSafetyZone,
  NearbyFacility,
  SafetyLevel,
  SafetyNewsItem,
  SafetyZoneAssessment,
} from '@/services/ai-safety-zone';

export default function AISafetyZoneScreen() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';

  const {
    location,
    loading: locationLoading,
    errorType: locationErrorType,
    refresh: refreshGPS,
  } = useLocation();

  const [analyzing, setAnalyzing] = useState(false);
  const [assessment, setAssessment] = useState<SafetyZoneAssessment | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleCheckArea = async () => {
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      // 1. Refresh or fetch real GPS coordinates
      const freshLocation = await refreshGPS();
      const coords = freshLocation || location;

      if (!coords) {
        if (locationErrorType === 'permission_denied') {
          setAnalysisError('Location permission is required to analyze your area.');
        } else if (locationErrorType === 'services_disabled') {
          setAnalysisError('Location services (GPS) are disabled on this device.');
        } else {
          setAnalysisError('Unable to acquire GPS coordinates. Please check your signal.');
        }
        setAnalyzing(false);
        return;
      }

      // 2. Query real OpenStreetMap infrastructure & run Gemini analysis
      const result = await analyzeSafetyZone(
        coords.latitude,
        coords.longitude,
        coords.accuracy
      );

      setAssessment(result);
    } catch (err: any) {
      console.error('Error analyzing safety zone:', err);
      setAnalysisError(err?.message || 'Failed to complete safety zone analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleShareLocation = async () => {
    if (!location) return;
    try {
      await Share.share({
        message: `My Current Location via SafeHer AI:\n${location.googleMapsLink}\n\nLatitude: ${location.latitude.toFixed(5)}\nLongitude: ${location.longitude.toFixed(5)}${assessment ? `\nAI Safety Assessment: ${assessment.safetyLevel.toUpperCase().replace('_', ' ')}` : ''}`,
      });
    } catch (err) {
      console.log('Error sharing location:', err);
    }
  };

  const openInMaps = () => {
    if (location?.googleMapsLink) {
      Linking.openURL(location.googleMapsLink).catch(() => {
        Alert.alert('Error', 'Unable to open maps application.');
      });
    }
  };

  const handleOpenArticle = async (url: string) => {
    if (!url) return;
    try {
      if (Platform.OS !== 'web') {
        await openBrowserAsync(url);
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open article link.');
      });
    }
  };

  const getSafetyLevelConfig = (level: SafetyLevel) => {
    switch (level) {
      case 'lower_concern':
        return {
          label: 'LOWER CONCERN',
          color: '#10B981',
          bgColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
          borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
          symbolName: { ios: 'checkmark.shield.fill', android: 'check_circle', web: 'check_circle' },
          badgeText: '🟢 LOWER CONCERN',
        };
      case 'caution':
        return {
          label: 'CAUTION',
          color: '#F59E0B',
          bgColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
          symbolName: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
          badgeText: '🟡 CAUTION',
        };
      case 'higher_concern':
        return {
          label: 'HIGHER CONCERN',
          color: '#EF4444',
          bgColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
          borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA',
          symbolName: { ios: 'light.beacon.max.fill', android: 'crisis_alert', web: 'crisis_alert' },
          badgeText: '🔴 HIGHER CONCERN',
        };
    }
  };

  const renderFacilityRow = (facility: NearbyFacility, iconName: string, iconColor: string) => (
    <View key={facility.id} style={styles.facilityItem}>
      <View style={styles.facilityMain}>
        <View style={styles.facilityTitleRow}>
          <ThemedText style={styles.facilityName} numberOfLines={1}>
            {facility.name}
          </ThemedText>
          {facility.isAllWomen && (
            <View style={styles.womenBadge}>
              <ThemedText style={styles.womenBadgeText}>All-Women PS</ThemedText>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.distancePill, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
        <ThemedText style={[styles.distanceText, { color: iconColor }]}>
          {facility.distanceText}
        </ThemedText>
      </View>
    </View>
  );

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const borderColor = isDark ? '#334155' : '#E2E8F0';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as any}
                size={20}
                tintColor={theme.text}
              />
            </Pressable>

            <View style={styles.headerTitleContainer}>
              <ThemedText style={styles.headerTitle}>AI Safety Zone</ThemedText>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Hero Card */}
          <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconBadge}>
                <SymbolView
                  name={{ ios: 'shield.checkerboard', android: 'security', web: 'security' } as any}
                  size={26}
                  tintColor="#7C3AED"
                />
              </View>
              <View style={styles.heroTextContainer}>
                <ThemedText style={styles.heroTitle}>AI Safety Zone</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.heroSubtitle}>
                  Check the safety context of your current area and get an AI-powered safety recommendation.
                </ThemedText>
              </View>
            </View>

            {/* Primary Action Button */}
            <Pressable
              onPress={handleCheckArea}
              disabled={analyzing || locationLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                (analyzing || locationLoading) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {analyzing || locationLoading ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <ThemedText style={styles.primaryButtonText}>
                    Analyzing your area...
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.buttonLoadingRow}>
                  <SymbolView
                    name={{ ios: 'location.circle.fill', android: 'my_location', web: 'my_location' } as any}
                    size={20}
                    tintColor="#FFFFFF"
                  />
                  <ThemedText style={styles.primaryButtonText}>
                    {assessment ? 'Re-check My Area' : 'Check My Area'}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          </View>

          {/* Loading State Banner */}
          {(analyzing || locationLoading) && (
            <View style={[styles.loadingBox, { backgroundColor: cardBg, borderColor }]}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <ThemedText style={styles.loadingTitle}>Analyzing your area...</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.loadingSubtitle}>
                Querying OpenStreetMap safety infrastructure, regional safety news, and processing AI assessment.
              </ThemedText>
            </View>
          )}

          {/* Permission / Location Error Card */}
          {analysisError && (
            <View style={styles.errorBox}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' } as any}
                size={24}
                tintColor="#EF4444"
              />
              <View style={styles.errorTextWrap}>
                <ThemedText style={styles.errorTitle}>Location Issue</ThemedText>
                <ThemedText style={styles.errorSubtitle}>{analysisError}</ThemedText>
              </View>
              <Pressable
                onPress={handleCheckArea}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </Pressable>
            </View>
          )}

          {/* Initial State */}
          {!assessment && !analyzing && !locationLoading && !analysisError && (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor }]}>
              <SymbolView
                name={{ ios: 'map.fill', android: 'explore', web: 'explore' } as any}
                size={44}
                tintColor={isDark ? '#475569' : '#94A3B8'}
              />
              <ThemedText style={styles.emptyTitle}>Ready to Check Your Surroundings</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                Tap &ldquo;Check My Area&rdquo; above to query live safety infrastructure, regional safety news (past 7 days), and generate your AI situational assessment.
              </ThemedText>
            </View>
          )}

          {/* ASSESSMENT RESULTS SECTION */}
          {assessment && !analyzing && (
            <View style={styles.resultsContainer}>
              {/* 1. Location & Area Card */}
              <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTitleRow}>
                    <SymbolView
                      name={{ ios: 'mappin.circle.fill', android: 'place', web: 'place' } as any}
                      size={20}
                      tintColor="#3B82F6"
                    />
                    <ThemedText style={styles.cardSectionLabel}>CURRENT LOCATION</ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.timestampText}>
                    {assessment.evaluatedAt}
                  </ThemedText>
                </View>

                <ThemedText style={styles.areaNameText}>
                  {assessment.areaName}
                </ThemedText>

                <View style={styles.coordsRow}>
                  <ThemedText themeColor="textSecondary" style={styles.coordText}>
                    GPS: {assessment.contextualFactors.coordinates.latitude.toFixed(4)},{' '}
                    {assessment.contextualFactors.coordinates.longitude.toFixed(4)}
                  </ThemedText>
                  {assessment.contextualFactors.accuracyMeters != null && (
                    <View style={styles.accuracyTag}>
                      <ThemedText style={styles.accuracyTagText}>
                        ±{Math.round(assessment.contextualFactors.accuracyMeters)}m
                      </ThemedText>
                    </View>
                  )}
                  <Pressable onPress={openInMaps} style={styles.mapsLink}>
                    <ThemedText style={styles.mapsLinkText}>View Map</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* 2. REAL SAFETY INFRASTRUCTURE SECTION */}
              <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTitleRow}>
                    <SymbolView
                      name={{ ios: 'building.2.fill', android: 'apartment', web: 'apartment' } as any}
                      size={20}
                      tintColor="#7C3AED"
                    />
                    <ThemedText style={styles.cardSectionLabel}>NEARBY SAFETY INFRASTRUCTURE</ThemedText>
                  </View>
                  <View style={styles.radiusPill}>
                    <ThemedText style={styles.radiusPillText}>2 km radius</ThemedText>
                  </View>
                </View>

                {/* Police Stations */}
                <View style={styles.facilitySection}>
                  <View style={styles.subHeaderRow}>
                    <SymbolView
                      name={{ ios: 'shield.fill', android: 'local_police', web: 'local_police' } as any}
                      size={17}
                      tintColor="#3B82F6"
                    />
                    <ThemedText style={styles.facilityCategoryTitle}>Police Stations</ThemedText>
                    {assessment.infrastructure.nearbyPoliceStations.length > 0 && (
                      <ThemedText themeColor="textSecondary" style={styles.categoryCount}>
                        ({assessment.infrastructure.nearbyPoliceStations.length} found)
                      </ThemedText>
                    )}
                  </View>
                  {assessment.infrastructure.nearbyPoliceStations.length > 0 ? (
                    <View style={styles.facilitiesList}>
                      {assessment.infrastructure.nearbyPoliceStations.map(p =>
                        renderFacilityRow(p, 'shield.fill', '#3B82F6')
                      )}
                    </View>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.emptyFacilityText}>
                      No nearby police stations found in the selected radius.
                    </ThemedText>
                  )}
                </View>

                {/* Hospitals & Medical */}
                <View style={styles.facilitySection}>
                  <View style={styles.subHeaderRow}>
                    <SymbolView
                      name={{ ios: 'cross.case.fill', android: 'local_hospital', web: 'local_hospital' } as any}
                      size={17}
                      tintColor="#EF4444"
                    />
                    <ThemedText style={styles.facilityCategoryTitle}>Hospitals & Medical</ThemedText>
                    {assessment.infrastructure.nearbyHospitals.length > 0 && (
                      <ThemedText themeColor="textSecondary" style={styles.categoryCount}>
                        ({assessment.infrastructure.nearbyHospitals.length} found)
                      </ThemedText>
                    )}
                  </View>
                  {assessment.infrastructure.nearbyHospitals.length > 0 ? (
                    <View style={styles.facilitiesList}>
                      {assessment.infrastructure.nearbyHospitals.map(h =>
                        renderFacilityRow(h, 'cross.case.fill', '#EF4444')
                      )}
                    </View>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.emptyFacilityText}>
                      No nearby hospitals found in the selected radius.
                    </ThemedText>
                  )}
                </View>

                {/* Transport Hubs */}
                <View style={styles.facilitySection}>
                  <View style={styles.subHeaderRow}>
                    <SymbolView
                      name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' } as any}
                      size={17}
                      tintColor="#10B981"
                    />
                    <ThemedText style={styles.facilityCategoryTitle}>Transport Hubs</ThemedText>
                    {assessment.infrastructure.nearbyTransportHubs.length > 0 && (
                      <ThemedText themeColor="textSecondary" style={styles.categoryCount}>
                        ({assessment.infrastructure.nearbyTransportHubs.length} found)
                      </ThemedText>
                    )}
                  </View>
                  {assessment.infrastructure.nearbyTransportHubs.length > 0 ? (
                    <View style={styles.facilitiesList}>
                      {assessment.infrastructure.nearbyTransportHubs.map(t =>
                        renderFacilityRow(t, 'bus.fill', '#10B981')
                      )}
                    </View>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.emptyFacilityText}>
                      No nearby transport hubs found in the selected radius.
                    </ThemedText>
                  )}
                </View>

                {/* Street Lighting Information */}
                <View style={styles.facilitySection}>
                  <View style={styles.subHeaderRow}>
                    <SymbolView
                      name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' } as any}
                      size={17}
                      tintColor="#F59E0B"
                    />
                    <ThemedText style={styles.facilityCategoryTitle}>Street Lighting (500m)</ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.lightingSummaryText}>
                    💡 {assessment.infrastructure.nearbyLighting.summary}
                  </ThemedText>
                </View>
              </View>

              {/* 3. RECENT SAFETY INFORMATION SECTION (LAYER 2) */}
              <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderTitleRow}>
                    <ThemedText style={styles.newsEmojiHeader}>📰</ThemedText>
                    <ThemedText style={styles.cardSectionLabel}>RECENT SAFETY INFORMATION</ThemedText>
                  </View>
                  <View style={styles.newsRadiusPill}>
                    <ThemedText style={styles.newsRadiusPillText}>Past 7 Days</ThemedText>
                  </View>
                </View>

                {assessment.safetyNews && !assessment.safetyNews.fetchedSuccessfully ? (
                  <View style={styles.newsStatusRow}>
                    <SymbolView
                      name={{ ios: 'wifi.slash', android: 'cloud_off', web: 'cloud_off' } as any}
                      size={18}
                      tintColor={isDark ? '#94A3B8' : '#64748B'}
                    />
                    <ThemedText themeColor="textSecondary" style={styles.newsStatusText}>
                      Recent safety news is temporarily unavailable.
                    </ThemedText>
                  </View>
                ) : assessment.safetyNews && assessment.safetyNews.articles.length > 0 ? (
                  <View style={styles.newsList}>
                    {assessment.safetyNews.articles.map((item: SafetyNewsItem) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleOpenArticle(item.link)}
                        style={({ pressed }) => [
                          styles.newsItemCard,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC',
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                          },
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="link"
                        accessibilityLabel={`Read news: ${item.title}`}
                      >
                        <View style={styles.newsItemHeader}>
                          <View style={styles.newsSourceBadge}>
                            <ThemedText style={styles.newsSourceText} numberOfLines={1}>
                              {item.source}
                            </ThemedText>
                          </View>
                          <ThemedText themeColor="textSecondary" style={styles.newsDateText}>
                            {item.pubDate}
                          </ThemedText>
                        </View>

                        <ThemedText style={styles.newsHeadlineText} numberOfLines={3}>
                          {item.title}
                        </ThemedText>

                        {item.snippet ? (
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.newsSnippetText}
                            numberOfLines={2}
                          >
                            {item.snippet}
                          </ThemedText>
                        ) : null}

                        <View style={styles.newsFooterRow}>
                          <ThemedText style={styles.newsReadMoreText}>Read full report</ThemedText>
                          <SymbolView
                            name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' } as any}
                            size={12}
                            tintColor="#3B82F6"
                          />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.newsStatusRow}>
                    <SymbolView
                      name={{ ios: 'checkmark.shield', android: 'check_circle', web: 'check_circle' } as any}
                      size={18}
                      tintColor="#10B981"
                    />
                    <ThemedText themeColor="textSecondary" style={styles.newsStatusText}>
                      No recent public safety advisories or incidents found for this area in the past 7 days.
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* 4. AI Safety Assessment Header Badge */}
              {(() => {
                const config = getSafetyLevelConfig(assessment.safetyLevel);
                return (
                  <View
                    style={[
                      styles.safetyLevelCard,
                      {
                        backgroundColor: config.bgColor,
                        borderColor: config.borderColor,
                      },
                    ]}
                  >
                    <View style={styles.safetyLevelHeader}>
                      <SymbolView
                        name={config.symbolName as any}
                        size={32}
                        tintColor={config.color}
                      />
                      <View style={styles.safetyLevelTextWrap}>
                        <ThemedText style={[styles.safetyLevelTitle, { color: config.color }]}>
                          {config.badgeText}
                        </ThemedText>
                        <ThemedText style={[styles.safetyLevelSub, { color: config.color }]}>
                          AI Safety Assessment
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* 4. Why? Section */}
              <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={styles.cardHeaderTitleRow}>
                  <SymbolView
                    name={{ ios: 'info.circle.fill', android: 'info', web: 'info' } as any}
                    size={20}
                    tintColor="#8B5CF6"
                  />
                  <ThemedText style={styles.cardSectionLabel}>WHY?</ThemedText>
                </View>
                <ThemedText style={styles.sectionBodyText}>
                  {assessment.shortReason}
                </ThemedText>
              </View>

              {/* 5. Safety Recommendation Section */}
              <View style={[styles.resultCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={styles.cardHeaderTitleRow}>
                  <SymbolView
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any}
                    size={20}
                    tintColor="#10B981"
                  />
                  <ThemedText style={styles.cardSectionLabel}>SAFETY RECOMMENDATION</ThemedText>
                </View>
                <ThemedText style={styles.sectionBodyText}>
                  {assessment.recommendation}
                </ThemedText>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.actionButtonsGrid}>
                <Pressable
                  onPress={handleShareLocation}
                  style={({ pressed }) => [
                    styles.secondaryActionButton,
                    { backgroundColor: cardBg, borderColor },
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' } as any}
                    size={18}
                    tintColor="#3B82F6"
                  />
                  <ThemedText style={styles.secondaryActionText}>Share Location</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/sos')}
                  style={({ pressed }) => [
                    styles.emergencyButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'light.beacon.max.fill', android: 'crisis_alert', web: 'crisis_alert' } as any}
                    size={18}
                    tintColor="#FFFFFF"
                  />
                  <ThemedText style={styles.emergencyButtonText}>Emergency SOS</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {/* Mandatory Safety Disclaimer Banner */}
          <View
            style={[
              styles.disclaimerContainer,
              {
                backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
                borderColor: isDark ? '#312E81' : '#C7D2FE',
              },
            ]}
          >
            <SymbolView
              name={{ ios: 'shield.lefthalf.filled', android: 'verified_user', web: 'verified_user' } as any}
              size={18}
              tintColor="#6366F1"
            />
            <ThemedText style={styles.disclaimerText}>
              Based on available location, infrastructure, and recent regional safety information. This is not a guarantee of personal safety. Always remain observant of your surroundings.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? 24 : Spacing.two,
    paddingBottom: Spacing.six,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextContainer: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 12,
  },
  errorTextWrap: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  errorSubtitle: {
    color: '#EF4444',
    fontSize: 12,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  resultsContainer: {
    gap: 14,
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  radiusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  radiusPillText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '700',
  },
  timestampText: {
    fontSize: 12,
  },
  areaNameText: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  coordText: {
    fontSize: 12,
  },
  accuracyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  accuracyTagText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
  mapsLink: {
    marginLeft: 'auto',
  },
  mapsLinkText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '700',
  },
  facilitySection: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
    gap: 8,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facilityCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryCount: {
    fontSize: 12,
  },
  facilitiesList: {
    gap: 6,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 10,
  },
  facilityMain: {
    flex: 1,
  },
  facilityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  facilityName: {
    fontSize: 13,
    fontWeight: '600',
  },
  womenBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  womenBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DB2777',
  },
  distancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyFacilityText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingLeft: 2,
  },
  lightingSummaryText: {
    fontSize: 12,
    lineHeight: 16,
  },
  safetyLevelCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
  },
  safetyLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  safetyLevelTextWrap: {
    flex: 1,
    gap: 2,
  },
  safetyLevelTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  safetyLevelSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionBodyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  emergencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#4338CA',
  },
  newsEmojiHeader: {
    fontSize: 16,
  },
  newsRadiusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  newsRadiusPillText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  newsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  newsStatusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  newsList: {
    gap: 10,
    marginTop: 4,
  },
  newsItemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  newsItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  newsSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    maxWidth: '65%',
  },
  newsSourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  newsDateText: {
    fontSize: 11,
  },
  newsHeadlineText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  newsSnippetText: {
    fontSize: 12,
    lineHeight: 17,
  },
  newsFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  newsReadMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
