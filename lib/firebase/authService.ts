// Mock Authentication Service for CLUTCH
export const AuthService = {
  async signInWithGoogle(): Promise<{ success: boolean; email?: string }> {
    console.log('Initiating Google OAuth connection...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Google OAuth connection successful.');
    return { success: true, email: 'aamirgamer7@gmail.com' };
  },

  async signOut(): Promise<void> {
    console.log('Signing out user...');
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('clutch_user');
      window.location.reload();
    }
  }
};

export async function signInWithGoogle() {
  return AuthService.signInWithGoogle();
}

export async function signOut() {
  return AuthService.signOut();
}
