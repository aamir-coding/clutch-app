import { useState } from 'react';

export function useAuth() {
  // Simple mock user matching default_user used in CLUTCH
  const [user] = useState({
    uid: 'default_user',
    email: 'aamirgamer7@gmail.com',
    createdAt: new Date().toISOString()
  });

  return { user, loading: false };
}
