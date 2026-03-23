import {
  PublicClientApplication,
  type Configuration,
  type AccountInfo,
  type SilentRequest,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';


const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: window.location.origin + import.meta.env.BASE_URL.replace(/\/+$/, ''),
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

const dataverseUrl = import.meta.env.VITE_DATAVERSE_URL || '';
const DATAVERSE_SCOPE = `${dataverseUrl.replace('/api/data/v9.2/', '')}/.default`;

const loginRequest = {
  scopes: [DATAVERSE_SCOPE],
};

// Singleton MSAL instance — created lazily
let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Clear stale MSAL interaction state from browser storage.
 * This fixes "interaction_in_progress" errors caused by
 * popups that were closed before completing or crashed.
 */
function clearStaleInteractionState(): void {
  // MSAL v5 stores interaction state in sessionStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes('interaction')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Initialize MSAL — safe to call multiple times (idempotent).
 * MUST be called before React renders to handle popup responses.
 */
export async function initializeMsal(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    // Handle redirect/popup response if present
    try {
      const response = await msalInstance.handleRedirectPromise();
      if (response) {
        msalInstance.setActiveAccount(response.account);
      }
    } catch (err: any) {
      if (err?.errorCode !== 'no_token_request_cache_error') {
        console.warn('handleRedirectPromise error:', err);
      }
      // Clear stale state so next login attempt can proceed
      clearStaleInteractionState();
    }

    // Set active account if one exists in cache
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  })();

  return initPromise;
}

/**
 * Get the initialized MSAL instance.
 */
function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    throw new Error('MSAL not initialized. Call initializeMsal() first.');
  }
  return msalInstance;
}

/**
 * Login via redirect. Navigates the entire page to Azure AD login.
 * After authentication, Azure AD redirects back to the app where
 * handleRedirectPromise() (in initializeMsal) processes the response.
 */
export async function login(): Promise<void> {
  await initializeMsal();
  const instance = getMsalInstance();
  clearStaleInteractionState();
  await instance.loginRedirect(loginRequest);
}

/**
 * Logout and redirect to Azure AD sign-out page.
 */
export async function logout(): Promise<void> {
  const instance = getMsalInstance();
  const account = instance.getActiveAccount();
  if (account) {
    await instance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''),
    });
  }
}

/**
 * Get Dataverse access token silently. Falls back to popup if needed.
 */
export async function getDataverseToken(): Promise<string> {
  const instance = getMsalInstance();
  const account = instance.getActiveAccount();
  if (!account) {
    throw new Error('No active account. Please login first.');
  }

  const tokenRequest: SilentRequest = {
    scopes: [DATAVERSE_SCOPE],
    account,
  };

  try {
    const response = await instance.acquireTokenSilent(tokenRequest);
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      console.warn('Silent token acquisition failed, trying popup:', error);
      const response = await instance.acquireTokenPopup(tokenRequest);
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * Get the currently logged-in user's info.
 */
export function getLoggedInUser(): { id: string; name: string; email: string } | null {
  if (!msalInstance) return null;
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
  if (!msalInstance) return false;
  return msalInstance.getActiveAccount() !== null;
}

// Whitelist editors — match by email (MSAL account.username)
const EDITOR_EMAILS = [
  'hieu.le@wecare-i.com',
  'hoang.tran@wecare-i.com',
  'phat.tran@wecare-i.com',
  'thuan.nguyendaominh@wecare-i.com',
];

/**
 * Check if current user has Edit permission.
 * Only whitelisted team members (Sys, Core, R&D) can edit.
 */
export function canEdit(): boolean {
  if (!msalInstance) return false;
  const account = msalInstance.getActiveAccount();
  if (!account) return false;
  return EDITOR_EMAILS.includes(account.username.toLowerCase());
}
