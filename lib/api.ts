// API utility functions for better error handling and consistency

import { setAuthTokenCookie } from './utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const forceLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  document.cookie = "token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
  window.location.href = "/login";
};

// Dedupe concurrent refresh attempts so a burst of 401s only refreshes once
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new ApiError(401, "No refresh token");
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new ApiError(401, "Refresh token invalid or expired");
      }

      const data = await response.json();
      const newAccessToken = data.data?.accessToken;
      if (!newAccessToken) {
        throw new ApiError(401, "Refresh response missing accessToken");
      }

      localStorage.setItem("token", newAccessToken);
      setAuthTokenCookie(newAccessToken, 86400);
      return newAccessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// `body` accepts a plain object in addition to RequestInit's usual BodyInit types —
// apiCall JSON.stringifies it automatically below. Typing it as `RequestInit`
// alone made every call site passing a plain object body a type error, even
// though it's the documented/supported way to call this function.
type ApiCallOptions = Omit<RequestInit, 'body'> & { body?: RequestInit['body'] | Record<string, any> };

// GET requests are safe to silently retry (no side effects); a mutating
// request (POST/PUT/DELETE/PATCH) is NOT retried automatically here, since
// re-sending it after an ambiguous timeout risks duplicating whatever it did
// server-side (e.g. a double registration) if the original actually landed.
const isSafeToRetry = (options: ApiCallOptions) => !options.method || options.method.toUpperCase() === 'GET';

// Transient connectivity blips (a stalled fetch that hits our own 30s abort,
// or the browser failing to even establish the connection) are common
// against the current DB setup and previously surfaced as a silent "0
// results" state with no visible error — e.g. a course's module list
// rendering empty because the request timed out, not because the course
// actually has no modules. Retrying a couple of times with a short backoff
// before giving up turns a one-off blip into something the user never sees.
const isTransientNetworkError = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.message === 'Failed to fetch');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiCall = async (endpoint: string, options: ApiCallOptions = {}, _isRetry = false, _attempt = 0): Promise<any> => {
  if (!API_URL) {
    throw new ApiError(500, 'API URL not configured');
  }

  console.log(`🔄 API Call: ${endpoint}`);
  const token = localStorage.getItem("token");

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
    console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
  } else {
    console.log("⚠️ No token found in localStorage");
  }

  const config: ApiCallOptions = {
    ...options,
    cache: 'no-store', // never serve stale API data from browser/proxy cache
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Stringify body if it's a plain object (not already a string or a BodyInit like FormData)
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30 seconds

  try {
    console.log(`📡 Fetching: ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...(config as RequestInit),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`✅ Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // Access token expired: try a silent refresh once, then retry the original request
      if (response.status === 401 && !_isRetry) {
        try {
          console.log("🔄 401 Unauthorized - attempting silent token refresh...");
          await refreshAccessToken();
          return apiCall(endpoint, options, true);
        } catch {
          console.log("🔄 Refresh failed - clearing auth and redirecting to login...");
          forceLogout();
          throw new ApiError(401, "Unauthorized");
        }
      }
      if (response.status === 401) {
        console.log("🔄 401 Unauthorized after retry - clearing auth and redirecting...");
        forceLogout();
        throw new ApiError(401, "Unauthorized");
      }
      let errMsg = `${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody?.message) errMsg = errBody.message;
      } catch {}
      console.error(`❌ API Error ${response.status} for ${endpoint}:`, errMsg);
      throw new ApiError(response.status, errMsg);
    }

    const data = await response.json();
    console.log(`📦 Data received for ${endpoint}:`, data.success ? 'Success' : 'Failed');
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`❌ API Error for ${endpoint}:`, error);

    if (isTransientNetworkError(error) && isSafeToRetry(options) && _attempt < 2) {
      const delayMs = 1000 * (_attempt + 1); // 1s, then 2s
      console.log(`🔁 Transient network error on ${endpoint} — retrying in ${delayMs}ms (attempt ${_attempt + 1}/2)...`);
      await sleep(delayMs);
      return apiCall(endpoint, options, _isRetry, _attempt + 1);
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw error;
  }
};

// Reusable user fetch function (DRY approach)
export const getCurrentUser = async () => {
  const token = localStorage.getItem("token");
  
  if (!token) {
    throw new ApiError(401, "No token found");
  }

  const response = await apiCall("/auth/me");
  return response.data; // Consistent return format
};

// Transform backend user data to frontend format
export const transformUserData = (userData: any) => {
  return {
    id: userData?.id || 'unknown',
    email: userData?.email || '',
    name: userData?.name || 'User',
    role: userData?.role?.toLowerCase().replace(/_/g, '-') || 'student',
    department: userData?.studentProfile?.department || 
               userData?.instructorProfile?.department || 
               userData?.adminProfile?.department || 
               'IIT Bombay',
    rollNo: userData?.studentProfile?.rollNumber,
    empId: userData?.adminProfile?.employeeId || userData?.employeeId,
    year: userData?.studentProfile?.yearOfStudy,
    batch: userData?.studentProfile?.cohort,
    programme: userData?.studentProfile?.programme || 'Staff',
    iat: Date.now(),
  };
};

// Profile API functions
export const getUserProfile = async () => {
  const response = await apiCall("/profile");
  return response.data;
};

export const updateUserProfile = async (profileData: any) => {
  const response = await apiCall("/profile", {
    method: 'PUT',
    body: profileData
  });
  return response.data;
};

// Dashboard API functions
export const getStudentDashboard = async () => {
  const response = await apiCall("/student/dashboard");
  return response.data;
};

export const getInstructorDashboard = async () => {
  const response = await apiCall("/instructor/dashboard");
  return response.data;
};

export const getVolunteerDashboard = async () => {
  const response = await apiCall("/volunteer/dashboard");
  return response.data;
};

export const getAssociateDashboard = async () => {
  const response = await apiCall("/associate/dashboard");
  return response.data;
};

export const getAdminDashboard = async () => {
  const response = await apiCall("/admin/dashboard");
  return response.data;
};