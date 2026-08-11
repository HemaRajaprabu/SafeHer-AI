import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

interface Contact {
  id: string;
  name: string;
  phone: string;
}

export default function EmergencyContactsScreen() {
  const theme = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Load contacts on mount
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const saved = await AsyncStorage.getItem('emergencyContacts');
        if (saved !== null) {
          setContacts(JSON.parse(saved));
        }
      } catch (error) {
        console.log('Error loading emergency contacts:', error);
      }
    };
    loadContacts();
  }, []);

  // Save contacts helper
  const saveContacts = async (updatedContacts: Contact[]) => {
    try {
      setContacts(updatedContacts);
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
    } catch (error) {
      console.log('Error saving emergency contacts:', error);
      Alert.alert('Error', 'Failed to save contact.');
    }
  };

  const addContact = () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone) {
      Alert.alert('Validation Error', 'Please enter both a contact name and a phone number.');
      return;
    }

    // Basic phone validation
    const cleanPhone = trimmedPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 5) {
      Alert.alert('Validation Error', 'Please enter a valid phone number.');
      return;
    }

    const newContact: Contact = {
      id: Date.now().toString(),
      name: trimmedName,
      phone: trimmedPhone,
    };

    const updated = [...contacts, newContact];
    saveContacts(updated);
    setName('');
    setPhone('');
    Alert.alert('Success', 'Emergency contact added successfully.');
  };

  const deleteContact = (id: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this trusted emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = contacts.filter((c) => c.id !== id);
            saveContacts(updated);
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
            >
              <SymbolView
                name={{
                  ios: 'chevron.left',
                  android: 'arrow-back',
                  web: 'arrow-left',
                } as any}
                size={24}
                tintColor={theme.text}
              />
            </Pressable>

            <ThemedText style={styles.headerTitle}>
              Emergency Contacts
            </ThemedText>

            <View style={styles.headerSpace} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Intro Header */}
            <View style={styles.introSection}>
              <ThemedText style={styles.sectionTitle}>
                👥 Trusted Circle
              </ThemedText>
              <ThemedText style={styles.sectionDescription} themeColor="textSecondary">
                Add family members, close friends, or safety services. They will be alerted immediately if you activate the SOS mode.
              </ThemedText>
            </View>

            {/* List Section */}
            <View style={styles.listSection}>
              <ThemedText type="smallBold" style={styles.subsectionTitle}>
                Your Contacts ({contacts.length})
              </ThemedText>

              {contacts.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <SymbolView
                    name={{
                      ios: 'person.crop.circle.badge.plus',
                      android: 'person-add',
                      web: 'user-plus',
                    } as any}
                    size={36}
                    tintColor={theme.textSecondary}
                  />
                  <ThemedText style={styles.emptyText} themeColor="textSecondary">
                    No emergency contacts added yet. Add trusted contacts below to ensure you can reach them instantly.
                  </ThemedText>
                </ThemedView>
              ) : (
                contacts.map((contact) => (
                  <ThemedView
                    key={contact.id}
                    type="backgroundElement"
                    style={styles.contactCard}
                  >
                    <View style={styles.contactIcon}>
                      <SymbolView
                        name={{
                          ios: 'person.fill',
                          android: 'person',
                          web: 'user',
                        } as any}
                        size={22}
                        tintColor={theme.text}
                      />
                    </View>
                    <View style={styles.contactDetails}>
                      <ThemedText type="smallBold" style={styles.contactName}>
                        {contact.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.contactPhone}>
                        {contact.phone}
                      </ThemedText>
                    </View>
                    <Pressable
                      onPress={() => deleteContact(contact.id)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <SymbolView
                        name={{
                          ios: 'trash.fill',
                          android: 'delete',
                          web: 'trash',
                        } as any}
                        size={20}
                        tintColor="#EF4444"
                      />
                    </Pressable>
                  </ThemedView>
                ))
              )}
            </View>

            {/* Add Contact Card */}
            <ThemedView type="backgroundElement" style={styles.addCard}>
              <ThemedText type="smallBold" style={styles.subsectionTitle}>
                ➕ Add New Contact
              </ThemedText>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.inputLabel} themeColor="textSecondary">
                  Full Name
                </ThemedText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    {
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.inputLabel} themeColor="textSecondary">
                  Phone Number
                </ThemedText>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. +1 234 567 890"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    {
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <Pressable
                onPress={addContact}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.submitButtonText}>
                  Save Contact
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpace: {
    width: 44,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
  },
  introSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  listSection: {
    gap: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
  },
  contactPhone: {
    fontSize: 13,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCard: {
    padding: 20,
    borderRadius: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  submitButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
