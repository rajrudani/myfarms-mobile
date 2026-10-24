import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { extractErrorMessage } from '../../src/api/client';
import { router } from 'expo-router';
import { BentoCard, StatusBadge } from '../../src/components/ui';
import { colors, spacing, radius, typography, shadows } from '../../src/theme/tokens';

export default function MoreScreen() {
  const { user, logout, updateUser } = useAuth();

  // Profile Edit Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const openProfileModal = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setUsername(user?.username || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setActiveTab('profile');
    setProfileModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        username: username.trim() || undefined,
      });
      await updateUser(updated);
      Alert.alert('Success', 'Profile updated successfully.');
      setProfileModalVisible(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to update profile.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Current password is required.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      Alert.alert('Success', 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileModalVisible(false);
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to change password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerKicker}>REGISTRY & SYSTEM</Text>
          <Text style={styles.headerTitle}>More Options</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <BentoCard variant="elevated" style={styles.profileCard} onPress={openProfileModal}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{user?.name || 'Staff Profile'}</Text>
              <StatusBadge label="VERIFIED" variant="success" />
            </View>
            <Text style={styles.profileEmail}>{user?.email || user?.username || 'Farm Staff'}</Text>
            {user?.farm_group_name ? (
              <View style={styles.farmGroupPill}>
                <Ionicons name="business-outline" size={12} color={colors.primaryDark} />
                <Text style={styles.farmGroupText}>{user.farm_group_name}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.editProfileBtn}>
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </View>
        </BentoCard>

        {/* Masters Section (matching PWA) */}
        <Text style={styles.sectionHeader}>MASTERS</Text>
        <BentoCard variant="elevated" style={styles.stackCard}>
          <TouchableOpacity
            style={styles.stackItem}
            onPress={() => router.push('/crops')}
            activeOpacity={0.7}
          >
            <View style={[styles.stackIcon, { backgroundColor: colors.primarySurface }]}>
              <Ionicons name="grid-outline" size={17} color={colors.primary} />
            </View>
            <Text style={styles.stackText}>Crops</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stackItem}
            onPress={() => router.push('/agro-input-products')}
            activeOpacity={0.7}
          >
            <View style={[styles.stackIcon, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="beaker-outline" size={17} color={colors.infoText} />
            </View>
            <Text style={styles.stackText}>Agro Input Products</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stackItem}
            onPress={() => router.push('/activities')}
            activeOpacity={0.7}
          >
            <View style={[styles.stackIcon, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="clipboard-outline" size={17} color={colors.accentDark} />
            </View>
            <Text style={styles.stackText}>Activities</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stackItem, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/buyers')}
            activeOpacity={0.7}
          >
            <View style={[styles.stackIcon, { backgroundColor: colors.purpleSurface }]}>
              <Ionicons name="business-outline" size={17} color={colors.purpleText} />
            </View>
            <Text style={styles.stackText}>Buyers</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
          </TouchableOpacity>
        </BentoCard>

        {/* Operations Section */}
        <Text style={styles.sectionHeader}>OPERATIONS & TOOLS</Text>
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/agro-shop')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="cart-outline" size={20} color={colors.accentDark} />
            </View>
            <Text style={styles.gridText}>Shop</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/sales')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: colors.successSurface }]}>
              <Ionicons name="pricetag-outline" size={20} color={colors.successText} />
            </View>
            <Text style={styles.gridText}>Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/consultant-visits')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: colors.infoSurface }]}>
              <Ionicons name="briefcase-outline" size={20} color={colors.infoText} />
            </View>
            <Text style={styles.gridText}>Consultant</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/reports')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: colors.purpleSurface }]}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.purpleText} />
            </View>
            <Text style={styles.gridText}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/mandi-prices')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIcon, { backgroundColor: '#fdf2f8' }]}>
              <Ionicons name="trending-up-outline" size={20} color="#db2777" />
            </View>
            <Text style={styles.gridText}>Mandi Ticker</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ]);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Profile & Security Modal */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>ACCOUNT SECURITY</Text>
                <Text style={styles.modalTitle}>Profile & Credentials</Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            {/* Segmented Tab */}
            <View style={styles.tabContainer}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'profile' && styles.tabItemActive]}
                  onPress={() => setActiveTab('profile')}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      activeTab === 'profile' && styles.tabItemTextActive,
                    ]}
                  >
                    Personal Info
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'password' && styles.tabItemActive]}
                  onPress={() => setActiveTab('password')}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      activeTab === 'password' && styles.tabItemTextActive,
                    ]}
                  >
                    Change Password
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {activeTab === 'profile' ? (
                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your Full Name"
                    placeholderTextColor={colors.slate400}
                  />

                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    placeholderTextColor={colors.slate400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={styles.textInput}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="username"
                    placeholderTextColor={colors.slate400}
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.saveBtn, savingProfile && styles.btnDisabled]}
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Profile Details</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>Current Password *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.slate400}
                    secureTextEntry
                  />

                  <Text style={styles.inputLabel}>New Password * (min 8 chars)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.slate400}
                    secureTextEntry
                  />

                  <Text style={styles.inputLabel}>Confirm New Password *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.slate400}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[styles.saveBtn, savingPassword && styles.btnDisabled]}
                    onPress={handleChangePassword}
                    disabled={savingPassword}
                  >
                    {savingPassword ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.saveBtnText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  headerTitle: {
    ...typography.title2,
    color: colors.slate900,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 90,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    ...typography.title2,
    color: colors.slate900,
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.slate500,
  },
  farmGroupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  farmGroupText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.slate600,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.6,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.subtle,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
    textAlign: 'center',
  },
  stackCard: {
    padding: 0,
    overflow: 'hidden',
  },
  stackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  stackIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stackText: {
    flex: 1,
    ...typography.title3,
    color: colors.slate800,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: spacing.xl,
  },
  logoutButtonText: {
    ...typography.title3,
    color: colors.dangerText,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalKicker: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  modalTitle: {
    ...typography.title1,
    color: colors.slate900,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    marginBottom: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.slate200,
    borderRadius: radius.pill,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
    ...shadows.subtle,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  tabItemTextActive: {
    color: colors.white,
  },
  modalScroll: {
    paddingBottom: 24,
  },
  formContainer: {
    gap: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.slate700,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.slate900,
    backgroundColor: colors.slate50,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.subtle,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.title3,
    color: colors.white,
  },
});
