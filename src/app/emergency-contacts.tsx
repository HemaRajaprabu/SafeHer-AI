import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/utils/supabase';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export default function EmergencyContactsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

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
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      Alert.alert('Validation Error', 'Please enter a contact name, phone number, and email address.');
      return;
    }

    // Basic phone validation
    const cleanPhone = trimmedPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 5) {
      Alert.alert('Validation Error', 'Please enter a valid phone number.');
      return;
    }

    // Email validation
    if (!trimmedEmail.includes('@') || trimmedEmail.length < 3) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    const newContact: Contact = {
      id: Date.now().toString(),
      name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
    };

    const updated = [...contacts, newContact];
    saveContacts(updated);

    // Sync to Supabase
    if (user) {
      const syncAddContact = async () => {
        try {
          const { error } = await supabase
            .from('emergency_contacts')
            .upsert({
              user_id: user.id,
              contact_name: trimmedName,
              contact_phone: cleanPhone,
              contact_email: trimmedEmail,
            });
          if (error) {
            console.log('Error syncing contact addition to Supabase:', error.message);
          }
        } catch (err) {
          console.log('Supabase sync error:', err);
        }
      };
      syncAddContact();
    }

    setName('');
    setPhone('');
    setEmail('');
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
            const contactToDelete = contacts.find((c) => c.id === id);
            const updated = contacts.filter((c) => c.id !== id);
            saveContacts(updated);

            // Sync deletion to Supabase
            if (user && contactToDelete) {
              const syncDeleteContact = async () => {
                try {
                  const { error } = await supabase
                    .from('emergency_contacts')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('contact_email', contactToDelete.email);
                  if (error) {
                    console.log('Error deleting contact from Supabase:', error.message);
                  }
                } catch (err) {
                  console.log('Supabase delete sync error:', err);
                }
              };
              syncDeleteContact();
            }
          },
        },
      ]
    );
  };

  const callContact = async (contact: Contact) => {
    const rawPhone = contact.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9+*#]/g, '').trim();

    if (!cleanPhone) {
      Alert.alert('Invalid Phone Number', 'This contact does not have a valid phone number to call.');
      return;
    }

    const telUrl = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(telUrl);
      if (supported) {
        await Linking.openURL(telUrl);
      } else {
        Alert.alert(
          'Unable to make call',
          'Phone calling is not available on this device.'
        );
      }
    } catch (err) {
      console.log('Error opening phone dialer:', err);
      Alert.alert(
        'Unable to make call',
        'Phone calling is not available on this device.'
      );
    }
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
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'person.2.fill',
                  android: 'group',
                  web: 'group',
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
                      android: 'person_add',
                      web: 'person_add',
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
                  <View
                    key={contact.id}
                    style={styles.contactCard}
                  >
                    <View style={styles.contactIcon}>
                      <SymbolView
                        name={{
                          ios: 'person.fill',
                          android: 'person',
                          web: 'person',
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
                        Phone: {contact.phone}
                      </ThemedText>
                      {contact.email && (
                        <ThemedText type="small" themeColor="textSecondary" style={styles.contactPhone}>
                          Email: {contact.email}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.contactActions}>
                      <Pressable
                        onPress={() => callContact(contact)}
                        style={({ pressed }) => [
                          styles.callButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <SymbolView
                          name={{
                            ios: 'phone.fill',
                            android: 'phone',
                            web: 'phone',
                          } as any}
                          size={14}
                          tintColor="#15803D"
                        />
                        <ThemedText style={styles.callButtonText}>
                          Call
                        </ThemedText>
                      </Pressable>

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
                            web: 'delete',
                          } as any}
                          size={20}
                          tintColor="#EF4444"
                        />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Add Contact */}
            <View style={styles.addCard}>
              <View style={styles.addHeaderRow}>
                <SymbolView
                  name={{
                    ios: 'person.crop.circle.badge.plus',
                    android: 'person_add',
                    web: 'person_add',
                  } as any}
                  size={20}
                  tintColor={theme.text}
                />
                <ThemedText type="smallBold" style={styles.subsectionTitle}>
                  Add New Contact
                </ThemedText>
              </View>

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

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.inputLabel} themeColor="textSecondary">
                  Account Email (For location verification)
                </ThemedText>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. contact@safeher.ai"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
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
            </View>
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
    backgroundColor: 'transparent',
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
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    gap: 12,
  },
  contactIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'transparent',
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
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  deleteButton: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCard: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    gap: 16,
  },
  addHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
