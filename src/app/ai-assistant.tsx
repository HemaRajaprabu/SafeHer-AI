import { useState, useRef, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useLocation } from '@/hooks/use-location';
import { getAIResponse, ChatMessage, AIResponse } from '@/utils/ai';

interface UIHistoryMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  meta?: Omit<AIResponse, 'guidance'>;
}

export default function AIAssistantScreen() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';
  const inputBg = isDark ? '#1E293B' : '#F1F5F9';

  const [messages, setMessages] = useState<UIHistoryMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I am SafeHer AI, your safety companion. Let me know what is happening or if you feel unsafe, and I will analyze the situation and guide you.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  const { location } = useLocation();
  const scrollViewRef = useRef<ScrollView>(null);

  // Verify if API Key is configured on mount
  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    setHasApiKey(!!key);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userText = inputText.trim();
    setInputText('');
    setLoading(true);

    const userMsgId = Date.now().toString();
    const newUserMsg: UIHistoryMessage = {
      id: userMsgId,
      role: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Map message history to utils schema
      const history: ChatMessage[] = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      // Call AI endpoint
      const response = await getAIResponse(userText, history, location || undefined);

      const aiMsgId = (Date.now() + 1).toString();
      const newAiMsg: UIHistoryMessage = {
        id: aiMsgId,
        role: 'model',
        text: response.guidance,
        timestamp: new Date(),
        meta: {
          riskLevel: response.riskLevel,
          riskScore: response.riskScore,
          threatDetected: response.threatDetected,
          recommendedAction: response.recommendedAction,
          isLocal: response.isLocal,
        },
      };

      setMessages((prev) => [...prev, newAiMsg]);

      // Sync risk status to AsyncStorage for Explore screen
      await AsyncStorage.setItem('currentRiskLevel', response.riskLevel);
      await AsyncStorage.setItem('currentRiskScore', response.riskScore.toString());

      // Trigger auto SOS warning alert if settings allow (high risk check)
      if (response.riskLevel === 'high') {
        const autoSOS = await AsyncStorage.getItem('automaticSOS');
        if (autoSOS === 'true') {
          Alert.alert(
            '🚨 Automatic SOS',
            'SafeHer AI detected a high-risk scenario. Automatic SOS countdown is active. Tap below to cancel or verify.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open SOS Screen', onPress: () => router.push('/sos') },
            ]
          );
        }
      }
    } catch (err) {
      console.log('Error in AI communication flow:', err);
      const errId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: 'model',
          text: "I couldn't process that safety report. Please verify your network connection and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleClearChat = async () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: "Hello! I am SafeHer AI, your safety companion. Let me know what is happening or if you feel unsafe, and I will analyze the situation and guide you.",
        timestamp: new Date(),
      },
    ]);
    try {
      await AsyncStorage.removeItem('currentRiskLevel');
      await AsyncStorage.removeItem('currentRiskScore');
    } catch (e) {
      console.log('Error resetting safety status:', e);
    }
  };

  const lastMeta = messages[messages.length - 1]?.meta;
  const isHighRisk = lastMeta?.riskLevel === 'high';

  return (
    <ThemedView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              name={{
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow-left',
              } as any}
              size={24}
              tintColor={isDark ? '#FFFFFF' : '#111827'}
            />
          </Pressable>

          <View style={styles.headerInfo}>
            <ThemedText style={styles.headerTitle}>SafeHer AI Assistant</ThemedText>
            <View style={styles.headerStatus}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
                Live Companion
              </ThemedText>
            </View>
          </View>

          <Pressable onPress={handleClearChat} style={styles.clearButton}>
            <SymbolView
              name={{
                ios: 'trash.fill',
                android: 'delete',
                web: 'trash',
              } as any}
              size={18}
              tintColor={isDark ? '#94A3B8' : '#64748B'}
            />
          </Pressable>
        </View>

        {/* API Key Missing Alert Header */}
        {!hasApiKey && (
          <View style={styles.keyAlertBanner}>
            <SymbolView
              name={{
                ios: 'exclamationmark.triangle.fill',
                android: 'warning',
                web: 'warning',
              } as any}
              size={16}
              tintColor="#D97706"
            />
            <ThemedText style={styles.keyAlertText}>
              Using Local Rule Engine. Set <ThemedText style={styles.codeText}>EXPO_PUBLIC_GEMINI_API_KEY</ThemedText> in <ThemedText style={styles.codeText}>.env</ThemedText> to unlock Gemini AI.
            </ThemedText>
          </View>
        )}

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const riskLvl = message.meta?.riskLevel;
            const engineType = message.meta?.isLocal ? 'Local Rule Engine' : 'Gemini AI';

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowModel,
                ]}
              >
                {/* Bubble */}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? [styles.bubbleUser, { backgroundColor: '#7C3AED' }]
                      : [styles.bubbleModel, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }],
                    !isUser &&
                      !isUser && {
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                        borderWidth: 1,
                      },
                  ]}
                >
                  <ThemedText style={[styles.messageText, isUser && styles.messageTextUser]}>
                    {message.text}
                  </ThemedText>

                  {/* Metadata line for models */}
                  {!isUser && message.meta && (
                    <View style={styles.messageMeta}>
                      <ThemedText style={styles.metaEngineText}>
                        Processed via: {engineType}
                      </ThemedText>
                      {riskLvl && (
                        <View
                          style={[
                            styles.riskBadge,
                            {
                              backgroundColor:
                                riskLvl === 'high'
                                  ? 'rgba(220, 38, 38, 0.1)'
                                  : riskLvl === 'medium'
                                  ? 'rgba(217, 119, 6, 0.1)'
                                  : 'rgba(5, 150, 105, 0.1)',
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.riskBadgeText,
                              {
                                color:
                                  riskLvl === 'high'
                                    ? '#EF4444'
                                    : riskLvl === 'medium'
                                    ? '#F59E0B'
                                    : '#10B981',
                              },
                            ]}
                          >
                            Risk: {riskLvl.toUpperCase()} ({message.meta.riskScore}%)
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={[styles.messageRow, styles.messageRowModel]}>
              <View style={[styles.bubble, styles.bubbleModel, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}>
                <ThemedText style={styles.typingText}>SafeHer AI is analyzing situation...</ThemedText>
              </View>
            </View>
          )}
        </ScrollView>

        {/* High Risk Threat Actions */}
        {isHighRisk && (
          <View style={styles.actionPanel}>
            <ThemedText style={styles.actionPrompt}>⚠️ High Risk Detected. Take Action:</ThemedText>
            <View style={styles.actionButtonsRow}>
              <Pressable
                onPress={() => router.push('/sos')}
                style={[styles.actionBtn, styles.actionBtnSOS]}
              >
                <SymbolView
                  name={{
                    ios: 'exclamationmark.triangle.fill',
                    android: 'warning',
                    web: 'warning',
                  } as any}
                  size={16}
                  tintColor="#FFFFFF"
                />
                <ThemedText style={styles.actionBtnTextSOS}>Trigger SOS</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push('/emergency-contacts')}
                style={[styles.actionBtn, styles.actionBtnContacts]}
              >
                <SymbolView
                  name={{
                    ios: 'person.2.fill',
                    android: 'group',
                    web: 'users',
                  } as any}
                  size={16}
                  tintColor="#7C3AED"
                />
                <ThemedText style={styles.actionBtnTextContacts}>Trusted Contacts</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Keyboard Input Wrap */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.inputRow, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: inputBg,
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
              placeholder="Tell SafeHer AI what is happening..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              maxLength={400}
            />

            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: inputText.trim() ? '#7C3AED' : isDark ? '#1E293B' : '#E2E8F0' },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'paperplane.fill',
                  android: 'send',
                  web: 'paper-plane',
                } as any}
                size={18}
                tintColor={inputText.trim() ? '#FFFFFF' : isDark ? '#64748B' : '#94A3B8'}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  keyAlertText: {
    fontSize: 11,
    color: '#D97706',
    flex: 1,
    lineHeight: 15,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', web: 'monospace' }),
    fontWeight: '700',
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowModel: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 2,
  },
  bubbleModel: {
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0F172A',
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageMeta: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  metaEngineText: {
    fontSize: 10,
    color: '#64748B',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  typingText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  actionPanel: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220, 38, 38, 0.1)',
    gap: 8,
  },
  actionPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnSOS: {
    backgroundColor: '#DC2626',
  },
  actionBtnContacts: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  actionBtnTextSOS: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnTextContacts: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
