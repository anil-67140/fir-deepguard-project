import { configureStore, createSlice } from '@reduxjs/toolkit';

// ---- AUTH SLICE ----
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: JSON.parse(localStorage.getItem('dg_user') || 'null'),
    token: localStorage.getItem('dg_token') || null,
    loading: false,
    error: null
  },
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
      localStorage.setItem('dg_token', action.payload.token);
      localStorage.setItem('dg_user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('dg_token');
      localStorage.removeItem('dg_user');
    },
    setAuthLoading: (state, action) => { state.loading = action.payload; },
    setAuthError: (state, action) => { state.error = action.payload; }
  }
});

// ---- ANALYSIS SLICE ----
const analysisSlice = createSlice({
  name: 'analysis',
  initialState: {
    currentUpload: null,
    uploads: [],
    transactions: [],
    summary: null,
    loading: false,
    uploadProgress: 0,
    error: null
  },
  reducers: {
    setCurrentUpload: (state, action) => { state.currentUpload = action.payload; },
    setUploads: (state, action) => { state.uploads = action.payload; },
    setTransactions: (state, action) => { state.transactions = action.payload; },
    setSummary: (state, action) => { state.summary = action.payload; },
    setAnalysisLoading: (state, action) => { state.loading = action.payload; },
    setUploadProgress: (state, action) => { state.uploadProgress = action.payload; },
    setAnalysisError: (state, action) => { state.error = action.payload; },
    clearAnalysis: (state) => {
      state.currentUpload = null;
      state.transactions = [];
      state.summary = null;
      state.error = null;
    }
  }
});

// ---- UI SLICE ----
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    activeModal: null,
    notifications: []
  },
  reducers: {
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen; },
    setModal: (state, action) => { state.activeModal = action.payload; },
    addNotification: (state, action) => {
      state.notifications.unshift({ id: Date.now(), ...action.payload });
      if (state.notifications.length > 5) state.notifications.pop();
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    }
  }
});

export const { setCredentials, logout, setAuthLoading, setAuthError } = authSlice.actions;
export const {
  setCurrentUpload, setUploads, setTransactions, setSummary,
  setAnalysisLoading, setUploadProgress, setAnalysisError, clearAnalysis
} = analysisSlice.actions;
export const { toggleSidebar, setModal, addNotification, removeNotification } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    analysis: analysisSlice.reducer,
    ui: uiSlice.reducer
  }
});
