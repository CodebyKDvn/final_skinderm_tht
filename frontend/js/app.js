/**
 * app.js - Main Entry Point for Skinderm AI
 * Orchestrates modules and handles event listeners.
 */

import state from './modules/state.js';
import UI from './modules/ui.js';
import API from './modules/api.js';
import SCAN from './modules/scan.js';
import CHAT from './modules/chat.js';
import CHARTS from './modules/charts.js';
import WeatherService from './weather-service.js';
import { auth, onAuthStateChanged, signOut, updateProfile } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- INITIALIZATION ---
    UI.applyTheme();
    UI.applyLanguage();
    initEventListeners();

    onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            window.location.href = 'auth.html';
            return;
        }
        
        console.log("Logged in as:", firebaseUser.email, firebaseUser.displayName);
        
        state.user = {
            name: firebaseUser.displayName || 'Người dùng',
            email: firebaseUser.email,
            photo: firebaseUser.photoURL
        };
        state.idToken = await firebaseUser.getIdToken();
        
        UI.updateAccountInfo();
        updateWeather();
        updateHomeGreeting();
        CHARTS.initHomeCharts(document.getElementById('homeProgressChart'));
        
        await fetchData();

        // Check if user is new or hasn't set a profile
        if (!firebaseUser.displayName) {
            setTimeout(() => UI.toggleProfileModal(true), 2000);
        }
    });

    async function fetchData() {
        try {
            const [historyRes, exploreRes] = await Promise.all([
                API.getHistory(state.idToken),
                API.getExploreContent(state.lang)
            ]);

            if (historyRes.status === 'success') {
                state.history = historyRes.data.map(item => ({
                    id: item.id,
                    date: new Date(item.created_at).toLocaleString('vi-VN'),
                    image: item.image_url,
                    risk: item.risk_score,
                    diagnosis: item.classification,
                    details: item
                }));
                renderHistory();
                renderRecentActivity();
                updateHomeGreeting();
                CHARTS.initHomeCharts(document.getElementById('homeProgressChart'));
            }

            if (exploreRes.status === 'success') {
                state.blogPosts = exploreRes.data;
                renderBlogPosts();
            }
        } catch (err) {
            console.error("Initialization Error:", err);
        }
    }

    // --- EVENT LISTENERS ---
    function initEventListeners() {
        // Sidebar & Navigation
        const sidebar = document.getElementById('appSidebar');
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.view-section');
        const sidebarHeader = document.querySelector('.sidebar-header');
        const toggleSidebarBtn = document.getElementById('toggleSidebar');

        const handleSidebarToggle = (e) => {
            if (e) e.stopPropagation();
            UI.toggleSidebar(sidebar);
        };

        if (sidebarHeader) sidebarHeader.addEventListener('click', handleSidebarToggle);
        if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', handleSidebarToggle);

        const sidebarProfile = document.getElementById('sidebarUserProfile');
        if (sidebarProfile) {
            sidebarProfile.addEventListener('click', () => {
                switchSection('sec-account');
            });
        }

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.section;
                switchSection(target);
            });
        });

        // Profile Editing
        const btnEditProfile = document.getElementById('btnEditProfile');
        const btnSettingsEditProfile = document.getElementById('btnSettingsEditProfile');
        const btnSelectAvatar = document.getElementById('btnSelectAvatar');
        const avatarInput = document.getElementById('avatarInput');
        const btnSaveProfile = document.getElementById('btnSaveProfile');
        const btnCancelProfile = document.getElementById('btnCancelProfile');

        const openProfileModal = () => {
            UI.toggleProfileModal(true);
            document.getElementById('editDisplayName').value = state.user.name === 'Người dùng' ? '' : state.user.name;
            document.getElementById('editAvatarPreview').src = state.user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=random&color=fff`;
        };

        if (btnEditProfile) btnEditProfile.addEventListener('click', openProfileModal);
        if (btnSettingsEditProfile) btnSettingsEditProfile.addEventListener('click', openProfileModal);

        if (btnSelectAvatar) btnSelectAvatar.addEventListener('click', () => avatarInput.click());

        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    state.tempAvatarFile = file; 
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        document.getElementById('editAvatarPreview').src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (btnSaveProfile) {
            btnSaveProfile.addEventListener('click', async () => {
                const newName = document.getElementById('editDisplayName').value || 'Người dùng';
                let newPhoto = state.user.photo;

                btnSaveProfile.disabled = true;
                btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

                try {
                    // 1. Upload image if selected
                    if (state.tempAvatarFile) {
                        const uploadRes = await API.uploadAvatar(state.tempAvatarFile, state.idToken);
                        if (uploadRes.status === 'success') {
                            newPhoto = uploadRes.url;
                        }
                    }

                    // 2. Update Firebase Profile
                    await updateProfile(auth.currentUser, {
                        displayName: newName,
                        photoURL: newPhoto
                    });

                    state.user.name = newName;
                    state.user.photo = newPhoto;
                    state.tempAvatarFile = null; // Clear temp file
                    
                    UI.updateAccountInfo();
                    UI.toggleProfileModal(false);
                    updateHomeGreeting();
                    alert("Hồ sơ đã được cập nhật thành công!");
                } catch (err) {
                    console.error("Profile Update Error:", err);
                    alert("Lỗi cập nhật hồ sơ: " + err.message);
                } finally {
                    btnSaveProfile.disabled = false;
                    btnSaveProfile.innerHTML = 'Lưu thay đổi';
                }
            });
        }

        if (btnCancelProfile) {
            btnCancelProfile.addEventListener('click', () => UI.toggleProfileModal(false));
        }

        // Settings
        const toggleDarkMode = document.getElementById('toggleDarkMode');
        const langSelect = document.getElementById('langSelect');
        const btnClearData = document.getElementById('btnClearData');

        if (toggleDarkMode) {
            toggleDarkMode.addEventListener('change', (e) => {
                state.theme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('appTheme', state.theme);
                UI.applyTheme();
            });
        }

        if (langSelect) {
            langSelect.value = state.lang;
            langSelect.addEventListener('change', (e) => {
                state.lang = e.target.value;
                localStorage.setItem('appLang', state.lang);
                UI.applyLanguage();
            });
        }

        if (btnClearData) {
            btnClearData.addEventListener('click', () => {
                if (confirm(state.lang === 'vi' ? 'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu trên thiết bị này?' : 'Are you sure you want to clear all data on this device?')) {
                    localStorage.clear();
                    window.location.reload();
                }
            });
        }

        // Scan Section
        const btnShowUpload = document.getElementById('btnShowUpload');
        const btnShowCamera = document.getElementById('btnShowCamera');
        const fileInput = document.getElementById('fileInput');
        const btnCapture = document.getElementById('btnCapture');
        const btnStartAnalyze = document.getElementById('btnStartAnalyze');
        const btnCancelPreview = document.getElementById('btnCancelPreview');
        const btnConsultAI = document.getElementById('btnConsultAI');

        if (btnShowUpload) {
            btnShowUpload.addEventListener('click', () => {
                document.getElementById('viewUpload').classList.remove('hidden');
                document.getElementById('viewCamera').classList.add('hidden');
                document.getElementById('viewPreview').classList.add('hidden');
                SCAN.stopCamera();
            });
        }

        if (btnShowCamera) {
            btnShowCamera.addEventListener('click', () => {
                document.getElementById('viewUpload').classList.add('hidden');
                document.getElementById('viewCamera').classList.remove('hidden');
                document.getElementById('viewPreview').classList.add('hidden');
                SCAN.startCamera(document.getElementById('webcam'));
            });
        }

        const viewUpload = document.getElementById('viewUpload');
        if (viewUpload) viewUpload.addEventListener('click', () => fileInput.click());
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    SCAN.handleFile(e.target.files[0], showPreview);
                }
            });
        }

        if (btnCapture) {
            btnCapture.addEventListener('click', () => {
                SCAN.captureImage(document.getElementById('webcam'));
                showPreview();
            });
        }

        if (btnCancelPreview) {
            btnCancelPreview.addEventListener('click', () => {
                document.getElementById('viewPreview').classList.add('hidden');
                document.getElementById('viewUpload').classList.remove('hidden');
            });
        }

        if (btnStartAnalyze) btnStartAnalyze.addEventListener('click', startAnalysis);

        if (btnConsultAI) {
            btnConsultAI.addEventListener('click', () => {
                const latestScan = state.history[0];
                const chatInput = document.getElementById('chatInput');
                if (latestScan) {
                    chatInput.value = `Hãy phân tích chi tiết hơn kết quả chẩn đoán ${latestScan.diagnosis} của tôi từ ảnh chụp gần nhất.`;
                }
                switchSection('sec-doctor');
                if (latestScan) setTimeout(() => handleChatSend(), 500);
            });
        }

        // Chat Section
        const chatInput = document.getElementById('chatInput');
        const btnSendMessage = document.getElementById('btnSendMessage');
        const btnBackFromDoctor = document.getElementById('btnBackFromDoctor');

        if (btnSendMessage) {
            btnSendMessage.addEventListener('click', () => {
                if (state.isGeneratingResponse) {
                    if (state.abortController) state.abortController.abort();
                } else {
                    handleChatSend();
                }
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => { 
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend(); 
                }
            });
        }

        if (btnBackFromDoctor) {
            btnBackFromDoctor.addEventListener('click', () => switchSection('sec-home'));
        }

        // Account
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi Skinderm AI?")) {
                    await signOut(auth);
                    window.location.href = 'auth.html';
                }
            });
        }

        // Modals
        const btnCloseModal = document.getElementById('btnCloseModal');
        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', () => {
                document.getElementById('scanDetailModal').classList.add('hidden');
            });
        }
    }

    // --- HELPER FUNCTIONS ---

    function switchSection(sectionId) {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.view-section');
        UI.switchSection(sectionId, navItems, sections);
        
        if (sectionId === 'sec-scan') SCAN.stopCamera();
        if (sectionId === 'sec-monitor') CHARTS.renderMonitorCharts(document.getElementById('monitorTrendChart'));
        if (sectionId === 'sec-home') updateHomeGreeting();
        if (sectionId === 'sec-doctor') document.getElementById('chatInput').focus();
    }

    async function updateWeather() {
        const applyWeatherData = async (lat, lon) => {
            try {
                const data = await WeatherService.getWeatherData(lat, lon);
                if (!data) return;

                document.getElementById('tempValue').textContent = Math.round(data.temp);
                document.getElementById('uvValue').textContent = data.uvIndex;
                document.getElementById('weatherLocation').textContent = data.location;
                
                const theme = WeatherService.getWeatherTheme(data.weatherCode, data.uvIndex);
                const advice = WeatherService.getUVAdvice(data.uvIndex);
                document.getElementById('weatherAdvice').textContent = advice.advice;
                state.currentWeather = data;
                
                const weatherVideo = document.getElementById('weatherVideo');
                if (weatherVideo && !weatherVideo.src.includes(theme.video)) {
                    weatherVideo.src = `assets/video/${theme.video}`;
                    weatherVideo.load();
                }
            } catch (err) {
                console.error("Weather Display Error:", err);
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => applyWeatherData(pos.coords.latitude, pos.coords.longitude),
                (err) => {
                    console.warn("Geolocation failed, using default (Hanoi):", err.message);
                    applyWeatherData(21.0285, 105.8542);
                }
            );
        } else {
            applyWeatherData(21.0285, 105.8542);
        }
    }

    function updateHomeGreeting() {
        const hour = new Date().getHours();
        let greetText = hour < 12 ? "Chào buổi sáng" : (hour < 18 ? "Chào buổi chiều" : "Chào buổi tối");
        const greeting = document.getElementById('welcomeGreeting');
        if (greeting && state.user) {
            greeting.textContent = `${greetText}, ${state.user.name.split(' ')[0]}!`;
        }
    }

    function showPreview() {
        document.getElementById('viewUpload').classList.add('hidden');
        document.getElementById('viewCamera').classList.add('hidden');
        document.getElementById('viewPreview').classList.remove('hidden');
        document.getElementById('imgPreview').src = state.lastCapturedImage;
    }

    async function startAnalysis() {
        const btn = document.getElementById('btnStartAnalyze');
        const container = document.getElementById('previewContainer');
        
        container.classList.add('scanning');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

        try {
            const blob = await (await fetch(state.lastCapturedImage)).blob();
            const data = await API.analyzeImage(blob, state.idToken, state.currentWeather);
            
            displayScanResult(data);
            await API.getHistory(state.idToken); // Sync history
        } catch (err) {
            alert("Lỗi kết nối máy chủ AI. Vui lòng thử lại sau.");
        } finally {
            container.classList.remove('scanning');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-microscope"></i> Bắt đầu phân tích AI';
        }
    }

    function displayScanResult(data) {
        document.getElementById('resultEmpty').classList.add('hidden');
        document.getElementById('resultContent').classList.remove('hidden');

        const score = data.risk_score;
        const riskLevel = score > 70 ? 'Cực kỳ nguy hiểm' : (score > 40 ? 'Cần theo dõi' : 'Lành tính');
        const badgeClass = score > 70 ? 'pill-danger' : (score > 40 ? 'pill-warning' : 'pill-success');

        document.getElementById('riskScore').textContent = `${score}%`;
        const riskBadge = document.getElementById('riskLevelBadge');
        riskBadge.textContent = riskLevel;
        riskBadge.className = `score-badge ${badgeClass}`;

        const topList = document.getElementById('topPredictionsList');
        topList.innerHTML = data.top3.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${p.label}</span>
                <span class="pill" style="background: rgba(59, 130, 246, 0.1); color: var(--medical-blue-dark); font-size: 0.75rem;">${p.score}%</span>
            </div>
        `).join('');

        document.getElementById('medicalAdvice').innerHTML = marked.parse(CHAT.processAIContent(data.medical_advice || "Chưa có lời khuyên."));
        renderABCDEChart(data.abcde);

        // Add to history state locally for immediate update
        const newRecord = {
            id: Date.now(),
            date: new Date().toLocaleString('vi-VN'),
            image: state.lastCapturedImage,
            risk: score,
            diagnosis: data.classification,
            details: data
        };
        state.history.unshift(newRecord);
        renderHistory();
        renderRecentActivity();
        CHARTS.initHomeCharts(document.getElementById('homeProgressChart'));
    }

    function renderABCDEChart(abcde) {
        const container = document.getElementById('abcdeChartContainer');
        if (!container || !abcde) return;

        const metrics = [
            { id: 'A', label: 'Asymmetry', val: abcde.A_asymmetry.score, status: abcde.A_asymmetry.status, color: 'var(--danger)' },
            { id: 'B', label: 'Border', val: abcde.B_border.score, status: abcde.B_border.status, color: 'var(--warning)' },
            { id: 'C', label: 'Color', val: abcde.C_color.score, status: abcde.C_color.status, color: 'var(--medical-blue-base)' },
            { id: 'D', label: 'Diameter', val: abcde.D_diameter.score, status: `${abcde.D_diameter.value}mm`, color: 'var(--success)' },
            { id: 'E', label: 'Evolution', val: abcde.E_evolution.score, status: 'Historical', color: '#8b5cf6' }
        ];

        container.innerHTML = metrics.map(m => `
            <div class="abcde-row">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${m.id}. ${m.label}</span>
                    <span style="color: var(--text-muted); font-weight: 500;">${m.status}</span>
                </div>
                <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${m.val}%; height: 100%; background: ${m.color}; border-radius: 3px; transition: width 1s ease-out;"></div>
                </div>
            </div>
        `).join('');
    }

    function renderHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        if (!state.history.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:4rem; color:var(--text-muted)">Chưa có dữ liệu lịch sử.</td></tr>';
            return;
        }

        tbody.innerHTML = state.history.map(item => `
            <tr>
                <td><img src="${item.image}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;"></td>
                <td style="font-size: 0.85rem;">${item.date}</td>
                <td><strong>${item.diagnosis}</strong></td>
                <td><span class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}">${item.risk}%</span></td>
                <td>
                    <button class="btn-detail btn-pill" data-id="${item.id}" style="font-size: 0.75rem; background: var(--medical-blue-base); color: white; padding: 6px 12px;">Chi tiết</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => showScanDetail(btn.dataset.id));
        });
    }

    function renderRecentActivity() {
        const container = document.getElementById('homeRecentActivity');
        if (!container) return;

        if (!state.history.length) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu.</p>';
            return;
        }

        const recent = state.history.slice(0, 3);
        container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
            ${recent.map(item => `
                <div style="display: flex; align-items: center; gap: 1rem; padding: 10px; border-radius: 12px; cursor: pointer;">
                    <img src="${item.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.95rem;">${item.diagnosis}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.date}</div>
                    </div>
                    <div class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}">${item.risk}%</div>
                </div>
            `).join('')}
        </div>`;
    }

    function renderBlogPosts() {
        const grid = document.getElementById('exploreGrid');
        if (!grid) return;
        grid.innerHTML = state.blogPosts.map((post, index) => `
            <div class="blog-item fade-in">
                <img src="${post.img}" class="blog-img">
                <div class="blog-content">
                    <span class="blog-category">${post.category}</span>
                    <h3 class="blog-title">${post.title}</h3>
                    <p class="blog-desc">${post.desc}</p>
                    <button class="btn-pill btn-read-blog" data-index="${index}" style="margin-top: 1rem; border: 1px solid var(--border-light); font-size: 0.8rem; background: var(--bg-app);">Đọc tiếp</button>
                </div>
            </div>
        `).join('');
    }

    function showScanDetail(id) {
        const item = state.history.find(h => String(h.id) === String(id));
        if (!item) return;
        document.getElementById('scanDetailModal').classList.remove('hidden');
        document.getElementById('modalBody').innerHTML = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <img src="${item.image}" style="width: 100%; max-width: 400px; border-radius: 12px; box-shadow: var(--shadow-md);">
            </div>
            <div class="grid-2" style="gap: 1.5rem;">
                <div class="card-glass" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--medical-blue-dark);">Kết quả chẩn đoán</h4>
                    <div style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">${item.diagnosis}</div>
                    <div class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}" style="font-size: 1rem; padding: 6px 16px;">Độ rủi ro: ${item.risk}%</div>
                </div>
                <div class="card-glass" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--medical-blue-dark);">Thời gian</h4>
                    <div style="font-size: 1.1rem; font-weight: 600;">${item.date}</div>
                    <div style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">ID: ${item.id}</div>
                </div>
            </div>
        `;
    }

    function handleChatSend() {
        const chatInput = document.getElementById('chatInput');
        const chatHistory = document.getElementById('chatHistory');
        const btnSendMessage = document.getElementById('btnSendMessage');
        const chatModelSelect = document.getElementById('chatModelSelect');
        CHAT.sendMessage(chatInput, chatHistory, btnSendMessage, chatModelSelect);
    }
});
