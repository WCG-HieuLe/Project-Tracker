import { PublicClientApplication, type Configuration, type AccountInfo, type SilentRequest } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

const DATAVERSE_SCOPE = `${import.meta.env.VITE_DATAVERSE_URL.replace('/api/data/v9.2/', '')}/.default`;

const loginRequest = {
  scopes: [DATAVERSE_SCOPE],
};

// Singleton MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL — must be called before any other MSAL operations
let msalInitialized = false;
export async function initializeMsal(): Promise<void> {
  if (msalInitialized) return;
  await msalInstance.initialize();

  // Handle redirect response (if returning from a redirect login)
  const response = await msalInstance.handleRedirectPromise();
  if (response) {
    msalInstance.setActiveAccount(response.account);
  }

  // Set active account if one exists in cache
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  msalInitialized = true;
}

/**
 * Login via popup. Returns the logged-in account.
 */
export async function login(): Promise<AccountInfo> {
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(response.account);
    return response.account;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

/**
 * Logout and clear session.
 */
export async function logout(): Promise<void> {
  const account = msalInstance.getActiveAccount();
  if (account) {
    await msalInstance.logoutPopup({
      account,
      postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
    });
  }
}

/**
 * Get Dataverse access token silently. Falls back to popup if needed.
 */
export async function getDataverseToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  if (!account) {
    throw new Error('No active account. Please login first.');
  }

  const tokenRequest: SilentRequest = {
    scopes: [DATAVERSE_SCOPE],
    account,
  };

  try {
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    return response.accessToken;
  } catch (error) {
    // Silent token acquisition failed, try popup
    console.warn('Silent token acquisition failed, trying popup:', error);
    const response = await msalInstance.acquireTokenPopup(tokenRequest);
    return response.accessToken;
  }
}

/**
 * Get the currently logged-in user's info.
 */
export function getLoggedInUser(): { id: string; name: string; email: string } | null {
  const account = msalInstance.getActiveAccount();
  if (!account) return null;

  return {
    id: (account.idTokenClaims as any)?.oid || account.localAccountId || '',
    name: account.name || '',
    email: account.username || '',
  };
}

/**
 * Check if user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  return msalInstance.getActiveAccount() !== null;
}
