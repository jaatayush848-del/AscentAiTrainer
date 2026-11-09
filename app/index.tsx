/**
 * Entry gate: decide where the user belongs.
 *   no key        -> /setup
 *   no profile    -> /onboarding
 *   no program    -> /generate
 *   otherwise     -> tabs (home)
 */
import { Redirect } from 'expo-router';
import { useApp } from '@/context/AppContext';

export default function Index() {
  const { settings, profile, program } = useApp();
  if (!settings.apiKey) return <Redirect href="/setup" />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (!program) return <Redirect href="/generate" />;
  return <Redirect href="/(tabs)/home" />;
}