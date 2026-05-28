/**
 * state.js - Central Application State for Skinderm AI
 */

const state = {
    activeSection: 'sec-home',
    history: [],
    user: null,
    idToken: null,
    currentStream: null,
    usingFrontCamera: false,
    lastCapturedImage: null,
    compareSelection: [],
    blogPosts: [],
    blogLastUpdated: 0,
    tempAvatarFile: null,
    currentWeather: null,
    isThinkingEnabled: true,
    isGeneratingResponse: false,
    abortController: null,
    lang: localStorage.getItem('appLang') || 'vi',
    theme: localStorage.getItem('appTheme') || 'light'
};

export default state;
