// EmoSense AI — Independent API Client
// Supports HTTP-only cookie authentication + optional Bearer token fallback.

const TOKEN_STORAGE_KEY = "emosense_auth_token";

// Determine API base URL:
// In development, uses relative '/api' proxied by Vite directly to http://localhost:5000,
// ensuring seamless same-origin cookies and avoiding hostname/port cross-origin mismatch.
// Can also be explicitly set via VITE_API_BASE_URL (e.g. http://localhost:5000/api).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted iframe/incognito
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },
};

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} [status=500]
   * @param {string} [code="REQUEST_FAILED"]
   * @param {any} [data=null]
   */
  constructor(message, status = 500, code = "REQUEST_FAILED", data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * @typedef {ApiError} ApiClientError
 */

/**
 * Core HTTP Request Wrapper
 */
async function request(endpoint, options = {}) {
  let cleanEndpoint = endpoint;
  if (API_BASE_URL.endsWith("/api") && cleanEndpoint.startsWith("/api/")) {
    cleanEndpoint = cleanEndpoint.substring(4);
  }
  const url = cleanEndpoint.startsWith("http")
    ? cleanEndpoint
    : `${API_BASE_URL}${cleanEndpoint.startsWith("/") ? "" : "/"}${cleanEndpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // If token is present in storage, include Bearer authorization header as well
  const storedToken = tokenStorage.get();
  if (storedToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${storedToken}`;
  }

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: /** @type {RequestCredentials} */ ("include"), // Transmits and receives HTTP-only cookies
  };

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type");
    let data = null;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error?.message || data?.message || `HTTP ${response.status}`,
        response.status,
        data?.error?.code || "REQUEST_FAILED",
        data
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new ApiError(
        "Unable to reach EmoSense AI backend server. Please verify the server is running.",
        503,
        "NETWORK_UNAVAILABLE"
      );
    }
    throw err;
  }
}

export const apiClient = {
  get: (endpoint, options) => request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options) =>
    request(endpoint, { ...options, method: "DELETE" }),

  // Authentication API methods
  auth: {
    register: async ({ email, password, name }) => {
      const data = await apiClient.post("/auth/register", {
        email,
        password,
        name,
      });
      if (data.token) tokenStorage.set(data.token);
      return data;
    },

    login: async ({ email, password }) => {
      const data = await apiClient.post("/auth/login", { email, password });
      if (data.token) tokenStorage.set(data.token);
      return data;
    },

    demoLogin: async () => {
      const data = await apiClient.post("/auth/demo-login");
      if (data.token) tokenStorage.set(data.token);
      return data;
    },

    me: async () => {
      return await apiClient.get("/auth/me");
    },

    updateProfile: async ({ name, currentPassword, newPassword }) => {
      return await apiClient.put("/auth/profile", {
        name,
        currentPassword,
        newPassword,
      });
    },

    logout: async () => {
      try {
        await apiClient.post("/auth/logout");
      } finally {
        tokenStorage.clear();
      }
    },

    getToken: () => tokenStorage.get(),
    setToken: (t) => tokenStorage.set(t),
    clearToken: () => tokenStorage.clear(),
  },

  // Mood Check-in and History API methods
  moods: {
    create: (data) => apiClient.post("/moods", data),
    list: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/moods${qs}`);
    },
    getById: (id) => apiClient.get(`/moods/${id}`),
    delete: (id) => apiClient.delete(`/moods/${id}`),
    getAnalytics: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/moods/analytics${qs}`);
    },
  },

  // Analytics API methods
  analytics: {
    get: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/analytics${qs}`);
    },
  },

  // Doctors Directory API methods
  doctors: {
    list: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/doctors${qs}`);
    },
    getById: (id) => apiClient.get(`/doctors/${id}`),
  },

  // Appointments API methods
  appointments: {
    create: (data) => apiClient.post("/appointments", data),
    list: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/appointments${qs}`);
    },
    getById: (id) => apiClient.get(`/appointments/${id}`),
    update: (id, data) => apiClient.patch(`/appointments/${id}`, data),
    cancel: (id) => apiClient.delete(`/appointments/${id}`),
  },

  // Emotional Analysis API methods (Text, Voice, Face)
  analysis: {
    analyzeText: ({ text, saveMood = true, title }) =>
      apiClient.post("/analysis/text", { text, saveMood, title }),
    analyzeVoice: (formData) =>
      apiClient.post("/analysis/voice", formData),
    analyzeFace: (formData) =>
      apiClient.post("/analysis/face", formData),
    list: (params) => {
      const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)).toString()}` : "";
      return apiClient.get(`/analysis${qs}`);
    },
    getById: (id) => apiClient.get(`/analysis/${id}`),
    delete: (id) => apiClient.delete(`/analysis/${id}`),
  },

  // Chat Assistant API methods
  chat: {
    sendMessage: ({ message, history = [], sessionId = null }) =>
      apiClient.post("/chat/message", { message, history, sessionId }),
    createSession: (data = {}) => apiClient.post("/chat/sessions", data),
    listSessions: () => apiClient.get("/chat/sessions"),
    getSession: (id) => apiClient.get(`/chat/sessions/${id}`),
    completeSession: (id, { messages }) =>
      apiClient.post(`/chat/sessions/${id}/complete`, { messages }),
    deleteSession: (id) => apiClient.delete(`/chat/sessions/${id}`),
    startAssessment: (data = {}) => apiClient.post("/chat/assessment/start", data),
    stepAssessment: ({ sessionId, answer, skipped = false, step }) =>
      apiClient.post("/chat/assessment/step", { sessionId, answer, skipped, step }),
    analyzeAssessment: ({ sessionId }) =>
      apiClient.post("/chat/assessment/analyze", { sessionId }),
  },

  // Long-Term Personal AI Memory methods
  memory: {
    list: () => apiClient.get("/memory"),
    create: ({ content, category }) => apiClient.post("/memory", { content, category }),
    delete: (id) => apiClient.delete(`/memory/${id}`),
    clearAll: () => apiClient.delete("/memory"),
  },
};

export default apiClient;
