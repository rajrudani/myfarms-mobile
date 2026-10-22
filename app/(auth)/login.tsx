import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { extractErrorMessage } from '../../src/api/client';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      // Hardcode 'farm_staff' as only farm staff are allowed to sign in
      await login(username.trim(), password, 'farm_staff');
    } catch (error: any) {
      console.error(error);
      const errorMsg = extractErrorMessage(error, 'The provided credentials are incorrect.');
      Alert.alert('Login Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppSupport = () => {
    const message = 'Hello, I would like to request a new account.';
    // Standard WhatsApp helper link (users can replace phone numbers in setup)
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device.');
    });
  };

  const handlePhoneSupport = () => {
    Linking.openURL('tel:+1234567890').catch(() => {
      Alert.alert('Error', 'Phone call failed.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/full-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form Card Body */}
          <View style={styles.body}>
            {/* Hero Icon */}
            <View style={styles.heroContainer}>
              <View style={styles.heroIconCircle}>
                <Ionicons name="lock-closed" size={30} color="#166534" />
              </View>
              <Text style={styles.title}>Login</Text>
            </View>

            {/* Fields */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#91a3b4" />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#a1acc0"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={18} color="#91a3b4" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#a1acc0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  {isPasswordVisible ? (
                    <Ionicons name="eye-off-outline" size={18} color="#91a3b4" />
                  ) : (
                    <Ionicons name="eye-outline" size={18} color="#91a3b4" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Log In Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Log In  →</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Support Buttons */}
            <View style={styles.supportContainer}>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={handleWhatsAppSupport}
                activeOpacity={0.8}
              >
                <View style={styles.supportCardIcon}>
                  <Ionicons name="chatbubble-outline" size={18} color="#15803d" />
                </View>
                <Text style={styles.supportCardText}>Get New Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportCard}
                onPress={handlePhoneSupport}
                activeOpacity={0.8}
              >
                <View style={styles.supportCardIcon}>
                  <Ionicons name="call-outline" size={18} color="#15803d" />
                </View>
                <Text style={styles.supportCardText}>Support / Help Desk</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Copyright © {new Date().getFullYear()} by horizoncode.in.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.18)',
    backgroundColor: '#f7fbf8',
  },
  logo: {
    height: 36,
    width: 180,
  },
  body: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 22,
  },
  heroIconCircle: {
    height: 70,
    width: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#064e3b',
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbe5df',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    height: 48,
  },
  input: {
    flex: 1,
    height: '100%',
    marginLeft: 12,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 26,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  supportContainer: {
    gap: 14,
  },
  supportCard: {
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportCardIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e3b',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
});
