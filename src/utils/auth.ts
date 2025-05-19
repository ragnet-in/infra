// For development, we'll use an in-memory store
// In production, you should use Redis or another persistent store
const authStateStore = new Map<string, { userId: string; orgId: string }>();

export const storeDiscordAuthState = async (
  state: string,
  data: { userId: string; orgId: string }
): Promise<void> => {
  // Store with 10 minute expiration
  authStateStore.set(state, data);
  setTimeout(() => {
    authStateStore.delete(state);
  }, 10 * 60 * 1000);
};

export const getDiscordAuthState = async (
  state: string
): Promise<{ userId: string; orgId: string } | null> => {
  const data = authStateStore.get(state);
  if (data) {
    // Remove the state after it's been used
    authStateStore.delete(state);
    return data;
  }
  return null;
};
