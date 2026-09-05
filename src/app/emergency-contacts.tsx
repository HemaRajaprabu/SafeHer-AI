import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [selectedContactForMenu, setSelectedContactForMenu] = useState<Contact | null>(null);
  const [menuPosition, setMenuPosition] = useState<number>(100);

  const scrollViewRef = useRef<ScrollView>(null);

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
    setIsAddModalOpen(false);
    Alert.alert('Success', 'Emergency contact added successfully.');
  };

  const deleteContact = (id: string) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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

  const handleOpenMenu = (contact: Contact, event: GestureResponderEvent) => {
    const { pageY } = event.nativeEvent;
    const screenHeight = Dimensions.get('window').height;
    const top = pageY > screenHeight - 200 ? Math.max(20, pageY - 170) : pageY + 8;
    setMenuPosition(top);
    setSelectedContactForMenu(contact);
  };

  const handleAddNewContactFromMenu = () => {
    setSelectedContactForMenu(null);
    setName('');
    setPhone('');
    setEmail('');
    setIsAddModalOpen(true);
  };

  const handleStartEdit = (contact: Contact) => {
    setSelectedContactForMenu(null);
    setEditingContact(contact);
    setEditName(contact.name);
    setEditPhone(contact.phone);
    setEditEmail(contact.email || '');
  };

  const handleSaveEdit = () => {
    if (!editingContact) return;
    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedPhone || !trimmedEmail) {
      Alert.alert('Validation Error', 'Please enter a contact name, phone number, and email address.');
      return;
    }

    const cleanPhone = trimmedPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 5) {
      Alert.alert('Validation Error', 'Please enter a valid phone number.');
      return;
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 3) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    const previousEmail = editingContact.email;
    const updatedContact: Contact = {
      ...editingContact,
      name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
    };

    const updatedList = contacts.map((c) => (c.id === editingContact.id ? updatedContact : c));
    saveContacts(updatedList);

    if (user) {
      const syncEditContact = async () => {
        try {
          if (previousEmail && previousEmail !== trimmedEmail) {
            await supabase
              .from('emergency_contacts')
              .delete()
              .eq('user_id', user.id)
              .eq('contact_email', previousEmail);
          }
          const { error } = await supabase
            .from('emergency_contacts')
            .upsert({
              user_id: user.id,
              contact_name: trimmedName,
              contact_phone: cleanPhone,
              contact_email: trimmedEmail,
            });
          if (error) {
            console.log('Error syncing contact edit to Supabase:', error.message);
          }
        } catch (err) {
          console.log('Supabase sync error on edit:', err);
        }
      };
      syncEditContact();
    }

    setEditingContact(null);
    Alert.alert('Success', 'Emergency contact updated successfully.');
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
            ref={scrollViewRef}
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
                    No emergency contacts added yet. Add trusted contacts to ensure you can reach them instantly.
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setName('');
                      setPhone('');
                      setEmail('');
                      setIsAddModalOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.emptyAddButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={styles.emptyAddButtonText}>
                      ➕ Add New Contact
                    </ThemedText>
                  </Pressable>
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
                        onPress={(e) => handleOpenMenu(contact, e)}
                        style={({ pressed }) => [
                          styles.menuButton,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <ThemedText style={[styles.menuDotsText, { color: theme.textSecondary }]}>
                          ⋮
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Three-Dot Popover Menu Modal */}
        <Modal
          visible={selectedContactForMenu !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedContactForMenu(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSelectedContactForMenu(null)}
          >
            <View
              style={[
                styles.popoverMenu,
                {
                  top: menuPosition,
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              {/* 1. Add New Contact */}
              <Pressable
                onPress={handleAddNewContactFromMenu}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.menuItemIcon}>➕</ThemedText>
                <ThemedText style={styles.menuItemText}>
                  Add New Contact
                </ThemedText>
              </Pressable>

              <View style={[styles.menuDivider, { backgroundColor: theme.backgroundSelected }]} />

              {/* 2. Edit */}
              <Pressable
                onPress={() => {
                  if (selectedContactForMenu) {
                    handleStartEdit(selectedContactForMenu);
                  }
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.menuItemIcon}>✏️</ThemedText>
                <ThemedText style={styles.menuItemText}>
                  Edit
                </ThemedText>
              </Pressable>

              <View style={[styles.menuDivider, { backgroundColor: theme.backgroundSelected }]} />

              {/* 3. Delete */}
              <Pressable
                onPress={() => {
                  const contact = selectedContactForMenu;
                  setSelectedContactForMenu(null);
                  if (contact) {
                    deleteContact(contact.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.menuItemIcon}>🗑️</ThemedText>
                <ThemedText style={[styles.menuItemText, { color: '#EF4444' }]}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Add Contact Modal */}
        <Modal
          visible={isAddModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsAddModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.editModalOverlay}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsAddModalOpen(false)}
            />
            <View
              style={[
                styles.editModalContainer,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.editModalHeader}>
                <ThemedText style={styles.editModalTitle}>
                  ➕ Add Emergency Contact
                </ThemedText>
                <Pressable
                  onPress={() => setIsAddModalOpen(false)}
                  style={styles.editModalCloseButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ThemedText style={{ fontSize: 16, color: theme.textSecondary, fontWeight: '700' }}>
                    ✕
                  </ThemedText>
                </Pressable>
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

              <View style={styles.editModalButtonRow}>
                <Pressable
                  onPress={() => setIsAddModalOpen(false)}
                  style={[
                    styles.editCancelButton,
                    { borderColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText style={[styles.editCancelButtonText, { color: theme.text }]}>
                    Cancel
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={addContact}
                  style={styles.editSaveButton}
                >
                  <ThemedText style={styles.editSaveButtonText}>
                    Save Contact
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Edit Contact Modal */}
        <Modal
          visible={editingContact !== null}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditingContact(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.editModalOverlay}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setEditingContact(null)}
            />
            <View
              style={[
                styles.editModalContainer,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.editModalHeader}>
                <ThemedText style={styles.editModalTitle}>
                  ✏️ Edit Emergency Contact
                </ThemedText>
                <Pressable
                  onPress={() => setEditingContact(null)}
                  style={styles.editModalCloseButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ThemedText style={{ fontSize: 16, color: theme.textSecondary, fontWeight: '700' }}>
                    ✕
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.inputLabel} themeColor="textSecondary">
                  Full Name
                </ThemedText>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
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
                  value={editPhone}
                  onChangeText={setEditPhone}
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
                  value={editEmail}
                  onChangeText={setEditEmail}
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

              <View style={styles.editModalButtonRow}>
                <Pressable
                  onPress={() => setEditingContact(null)}
                  style={[
                    styles.editCancelButton,
                    { borderColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText style={[styles.editCancelButtonText, { color: theme.text }]}>
                    Cancel
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleSaveEdit}
                  style={styles.editSaveButton}
                >
                  <ThemedText style={styles.editSaveButtonText}>
                    Save Changes
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDotsText: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  popoverMenu: {
    position: 'absolute',
    right: 20,
    width: 195,
    borderRadius: 16,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  editModalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  editModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  editSaveButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAddButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  pressed: {
    opacity: 0.8,
  },
});
