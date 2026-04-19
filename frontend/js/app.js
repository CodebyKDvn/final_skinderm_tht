/* ============================================================
   SKINDERM AI - CORE APPLICATION LOGIC
   ============================================================ */

import WeatherService from './weather-service.js';
import { auth, onAuthStateChanged, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE MANAGEMENT ---
    let state = {
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
        currentWeather: null,
        isThinkingEnabled: true,
        isGeneratingResponse: false,
        abortController: null,
        lang: localStorage.getItem('appLang') || 'vi',
        theme: localStorage.getItem('appTheme') || 'light'
    };

    // --- TRANSLATIONS ---
    const i18n = {
        vi: {
            settings_title: "Cài đặt Ứng dụng",
            settings_desc: "Tùy chỉnh trải nghiệm cá nhân.",
            settings_theme: "Chế độ tối (Dark Mode)",
            settings_theme_desc: "Giảm chói mắt khi sử dụng vào ban đêm.",
            settings_lang: "Ngôn ngữ hiển thị",
            settings_lang_desc: "Thay đổi ngôn ngữ giao diện Skinderm.",
            settings_clear: "Xóa dữ liệu cá nhân",
            settings_clear_desc: "Xóa toàn bộ lịch sử thiết lập trên trình duyệt này.",
            btn_clear: "Xóa lịch sử",
            account_title: "Tài khoản của tôi",
            account_desc: "Quản lý hồ sơ và bảo mật.",
            account_pro: "Thành viên Tiêu chuẩn",
            btn_edit_profile: '<i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa hồ sơ',
            btn_change_pass: '<i class="fa-solid fa-key"></i> Đổi mật khẩu',
            btn_logout: "Đăng xuất"
        },
        en: {
            settings_title: "App Settings",
            settings_desc: "Customize your personal experience.",
            settings_theme: "Dark Mode",
            settings_theme_desc: "Reduce eye strain when using at night.",
            settings_lang: "Display Language",
            settings_lang_desc: "Change Skinderm interface language.",
            settings_clear: "Clear Personal Data",
            settings_clear_desc: "Erase all local settings history on this browser.",
            btn_clear: "Clear Data",
            account_title: "My Account",
            account_desc: "Manage profile and security.",
            account_pro: "Standard Member",
            btn_edit_profile: '<i class="fa-solid fa-pen-to-square"></i> Edit Profile',
            btn_change_pass: '<i class="fa-solid fa-key"></i> Change Password',
            btn_logout: "Logout"
        }
    };

    function applyLanguage() {
        const dict = i18n[state.lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });
    }

    function applyTheme() {
        if (state.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if(toggleDarkMode) toggleDarkMode.checked = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            if(toggleDarkMode) toggleDarkMode.checked = false;
        }
    }

    // --- DOM ELEMENTS ---
    const sidebar = document.getElementById('appSidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    const toggleSidebar = document.getElementById('toggleSidebar');

    // Settings Elements
    const toggleDarkMode = document.getElementById('toggleDarkMode');
    const langSelect = document.getElementById('langSelect');
    const btnClearData = document.getElementById('btnClearData');

    // Home Elements
    const homeProgressCanvas = document.getElementById('homeProgressChart');

    // Scan Elements
    const btnShowUpload = document.getElementById('btnShowUpload');
    const btnShowCamera = document.getElementById('btnShowCamera');
    const viewUpload = document.getElementById('viewUpload');
    const viewCamera = document.getElementById('viewCamera');
    const viewPreview = document.getElementById('viewPreview');
    const fileInput = document.getElementById('fileInput');
    const webcam = document.getElementById('webcam');
    const imgPreview = document.getElementById('imgPreview');
    const btnCapture = document.getElementById('btnCapture');
    const btnFlipCamera = document.getElementById('btnFlipCamera');
    const btnStartAnalyze = document.getElementById('btnStartAnalyze');
    const btnCancelPreview = document.getElementById('btnCancelPreview');
    const resultEmpty = document.getElementById('resultEmpty');
    const resultContent = document.getElementById('resultContent');

    // Doctor Elements
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const btnSendMessage = document.getElementById('btnSendMessage');
    const chatModelSelect = document.getElementById('chatModelSelect');
    const toggleThinking = document.getElementById('toggleThinking');
    const btnBackFromDoctor = document.getElementById('btnBackFromDoctor');
    const chatWelcome = document.getElementById('chatWelcome');

    // --- INITIALIZATION & AUTH ---
    initNavigation();
    applyTheme();
    applyLanguage();

    if (langSelect) {
        langSelect.value = state.lang;
        langSelect.addEventListener('change', (e) => {
            state.lang = e.target.value;
            localStorage.setItem('appLang', state.lang);
            applyLanguage();
        });
    }

    if (toggleDarkMode) {
        toggleDarkMode.addEventListener('change', (e) => {
            state.theme = e.target.checked ? 'dark' : 'light';
            localStorage.setItem('appTheme', state.theme);
            applyTheme();
        });
    }

    if (btnClearData) {
        btnClearData.addEventListener('click', () => {
            if (confirm(state.lang === 'vi' ? 'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu trên thiết bị này?' : 'Are you sure you want to clear all data on this device?')) {
                localStorage.clear();
                alert(state.lang === 'vi' ? 'Đã xóa dữ liệu thành công.' : 'Data cleared successfully.');
                window.location.reload();
            }
        });
    }

    onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            window.location.href = 'auth.html';
            return;
        }
        
        state.user = {
            name: firebaseUser.displayName || 'Người dùng',
            email: firebaseUser.email,
            photo: firebaseUser.photoURL
        };
        state.idToken = await firebaseUser.getIdToken();
        
        updateAccountInfo();
        updateWeather();
        updateHomeStats();
        initHomeCharts();
        
        await fetchData();
    });

    async function fetchData() {
        try {
            await Promise.all([
                loadHistory(),
                loadExplore()
            ]);
        } catch (err) {
            console.error("Initialization Error:", err);
        }
    }

    // --- NAVIGATION LOGIC ---
    function initNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.section;
                switchSection(target);
            });
        });

        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = toggleSidebar.querySelector('i');
            icon.classList.toggle('fa-chevron-left');
            icon.classList.toggle('fa-chevron-right');
        });

        if(btnBackFromDoctor) {
            btnBackFromDoctor.addEventListener('click', () => {
                switchSection('sec-home');
            });
        }
    }

    function switchSection(sectionId) {
        state.activeSection = sectionId;
        
        // Update Sidebar
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Update Sections
        sections.forEach(sec => {
            if (sec.id === sectionId) {
                sec.classList.add('active');
                sec.style.animation = 'none';
                sec.offsetHeight; /* trigger reflow */
                sec.style.animation = null; 
            } else {
                sec.classList.remove('active');
            }
        });

        // Trigger section-specific logic
        if (sectionId === 'sec-scan') stopCamera();
        if (sectionId === 'sec-monitor') renderMonitorCharts();
        if (sectionId === 'sec-home') updateHomeStats();
        if (sectionId === 'sec-doctor') {
            if(chatInput) chatInput.focus();
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- WEATHER & DYNAMIC BACKGROUND ---
    async function updateWeather() {
        const weatherVideo = document.getElementById('weatherVideo');
        const tempValue = document.getElementById('tempValue');
        const uvValue = document.getElementById('uvValue');
        const weatherAdvice = document.getElementById('weatherAdvice');
        const locationEl = document.getElementById('weatherLocation');
        const weatherDate = document.getElementById('weatherDate');

        const applyWeatherData = async (lat, lon) => {
            try {
                const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
                if (weatherDate) {
                    weatherDate.textContent = new Date().toLocaleDateString('vi-VN', dateOptions);
                }

                const data = await WeatherService.getWeatherData(lat, lon);
                if (!data) return;

                tempValue.textContent = Math.round(data.temp);
                uvValue.textContent = data.uvIndex;
                locationEl.textContent = data.location;
                
                const theme = WeatherService.getWeatherTheme(data.weatherCode, data.uvIndex);
                const advice = WeatherService.getUVAdvice(data.uvIndex);
                
                weatherAdvice.textContent = advice.advice;
                state.currentWeather = data;
                
                const videoSrc = `assets/video/${theme.video}`;
                if (!weatherVideo.src.includes(theme.video)) {
                    weatherVideo.src = videoSrc;
                    weatherVideo.load();
                }
            } catch (err) {
                console.error("Failed to apply weather data:", err);
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => applyWeatherData(pos.coords.latitude, pos.coords.longitude),
                (err) => {
                    applyWeatherData(21.0285, 105.8542);
                }
            );
        } else {
            applyWeatherData(21.0285, 105.8542);
        }
    }

    // --- EXPLORE SECTION ---
    async function loadExplore() {
        try {
            const response = await fetch(`http://127.0.0.1:8080/api/explore?language=vi`);
            const result = await response.json();
            if (result.status === 'success') {
                state.blogPosts = result.data;
                renderBlogPosts();
            }
        } catch (err) {
            console.warn("Failed to fetch explore content.");
        }
    }

    function renderBlogPosts() {
        const grid = document.getElementById('exploreGrid');
        if (!grid) return;
        
        grid.innerHTML = state.blogPosts.map((post, index) => `
            <div class="blog-item fade-in">
                <img src="${post.img}" class="blog-img" alt="Blog Image">
                <div class="blog-content">
                    <span class="blog-category">${post.category}</span>
                    <h3 class="blog-title">${post.title}</h3>
                    <p class="blog-desc">${post.desc}</p>
                    <button class="btn-pill btn-read-blog" data-index="${index}" style="margin-top: 1rem; border: 1px solid var(--border-light); font-size: 0.8rem; background: var(--bg-app); cursor: pointer;">Đọc tiếp</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.btn-read-blog').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                showBlogDetail(index);
            });
        });
    }

    function showBlogDetail(index) {
        const blog = state.blogPosts[index];
        if (!blog) return;

        const modal = document.getElementById('scanDetailModal');
        const body = document.getElementById('modalBody');
        const header = modal.querySelector('.modal-header h3');
        if (header) header.innerHTML = '<i class="fa-solid fa-newspaper"></i> Bài viết Y khoa';

        body.innerHTML = `
            <div style="padding: 1rem;">
                <span class="pill pill-success" style="margin-bottom: 1rem; background: rgba(16, 185, 129, 0.1); color: #10b981;">${blog.category}</span>
                <h2 style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem;">${blog.title}</h2>
                <img src="${blog.img}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 16px; margin-bottom: 2rem; box-shadow: var(--shadow-sm);">
                <div style="font-size: 1.05rem; line-height: 1.8; color: var(--text-primary); margin-bottom: 2rem;">
                    ${blog.content || blog.desc}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    // --- SCAN SECTION LOGIC ---
    btnShowUpload.addEventListener('click', () => {
        viewUpload.classList.remove('hidden');
        viewCamera.classList.add('hidden');
        viewPreview.classList.add('hidden');
        stopCamera();
    });

    btnShowCamera.addEventListener('click', () => {
        viewUpload.classList.add('hidden');
        viewCamera.classList.remove('hidden');
        viewPreview.classList.add('hidden');
        startCamera();
    });

    viewUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.lastCapturedImage = e.target.result;
            showPreview();
        };
        reader.readAsDataURL(file);
    }

    async function startCamera() {
        try {
            state.currentStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: state.usingFrontCamera ? 'user' : 'environment' } 
            });
            webcam.srcObject = state.currentStream;
        } catch (err) {
            alert("Không thể mở camera. Vui lòng kiểm tra quyền truy cập.");
        }
    }

    function stopCamera() {
        if (state.currentStream) {
            state.currentStream.getTracks().forEach(track => track.stop());
            state.currentStream = null;
        }
    }

    btnCapture.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        canvas.getContext('2d').drawImage(webcam, 0, 0);
        state.lastCapturedImage = canvas.toDataURL('image/jpeg');
        stopCamera();
        showPreview();
    });

    function showPreview() {
        viewUpload.classList.add('hidden');
        viewCamera.classList.add('hidden');
        viewPreview.classList.remove('hidden');
        imgPreview.src = state.lastCapturedImage;
    }

    btnCancelPreview.addEventListener('click', () => {
        viewPreview.classList.add('hidden');
        viewUpload.classList.remove('hidden');
    });

    btnStartAnalyze.addEventListener('click', async () => {
        const container = document.getElementById('previewContainer');
        container.classList.add('scanning');
        btnStartAnalyze.disabled = true;
        btnStartAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

        try {
            const blob = await (await fetch(state.lastCapturedImage)).blob();
            const formData = new FormData();
            formData.append('file', blob, 'scan.jpg');
            
            if (state.idToken) {
                formData.append('authorization', `Bearer ${state.idToken}`);
            }

            if (state.currentWeather) {
                formData.append('uv_index', state.currentWeather.uvIndex);
                formData.append('temperature', state.currentWeather.temp);
                formData.append('location', state.currentWeather.location);
            }

            const response = await fetch('http://127.0.0.1:8080/api/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("API Error");
            const data = await response.json();
            
            displayScanResult(data);
            
            if (state.idToken) loadHistory();
        } catch (err) {
            alert("Lỗi kết nối máy chủ AI. Vui lòng thử lại sau.");
            container.classList.remove('scanning');
            btnStartAnalyze.disabled = false;
            btnStartAnalyze.innerHTML = '<i class="fa-solid fa-microscope"></i> Bắt đầu phân tích AI';
        }
    });

    function displayScanResult(data) {
        document.getElementById('previewContainer').classList.remove('scanning');
        btnStartAnalyze.disabled = false;
        btnStartAnalyze.innerHTML = '<i class="fa-solid fa-microscope"></i> Bắt đầu phân tích AI';
        
        resultEmpty.classList.add('hidden');
        resultContent.classList.remove('hidden');

        const score = data.risk_score;
        const riskLevel = score > 70 ? 'Cực kỳ nguy hiểm' : (score > 40 ? 'Cần theo dõi' : 'Lành tính');
        const badgeClass = score > 70 ? 'pill-danger' : (score > 40 ? 'pill-warning' : 'pill-success');

        document.getElementById('riskScore').textContent = `${score}%`;
        document.getElementById('riskLevelBadge').textContent = riskLevel;
        document.getElementById('riskLevelBadge').className = `score-badge ${badgeClass}`;

        const topList = document.getElementById('topPredictionsList');
        topList.innerHTML = data.top3.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${p.label}</span>
                <span class="pill" style="background: rgba(59, 130, 246, 0.1); color: var(--medical-blue-dark); font-size: 0.75rem;">${p.score}%</span>
            </div>
        `).join('');

        document.getElementById('medicalAdvice').textContent = data.medical_advice || "Chưa có lời khuyên.";

        renderABCDEChart(data.abcde);

        const newRecord = {
            id: Date.now(),
            date: new Date().toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            image: state.lastCapturedImage,
            risk: score,
            diagnosis: data.classification,
            details: data
        };

        state.history.unshift(newRecord);
        renderHistory();
        renderRecentActivity();
        initHomeCharts();
    }

    function renderABCDEChart(abcde) {
        const container = document.getElementById('abcdeChartContainer');
        if (!container || !abcde) return;

        const metrics = [
            { id: 'A', label: 'Asymmetry (Bất đối xứng)', val: abcde.A_asymmetry.score, status: abcde.A_asymmetry.status, color: 'var(--danger)' },
            { id: 'B', label: 'Border (Đường viền)', val: abcde.B_border.score, status: abcde.B_border.status, color: 'var(--warning)' },
            { id: 'C', label: 'Color (Màu sắc)', val: abcde.C_color.score, status: abcde.C_color.status, color: 'var(--medical-blue-base)' },
            { id: 'D', label: 'Diameter (Kích thước)', val: abcde.D_diameter.score, status: `${abcde.D_diameter.value}mm`, color: 'var(--success)' },
            { id: 'E', label: 'Evolution (Tiến triển)', val: abcde.E_evolution.score, status: 'Historical', color: '#8b5cf6' }
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

    document.getElementById('btnConsultAI').addEventListener('click', () => {
        const latestScan = state.history[0];
        if (latestScan) {
            chatInput.value = `Hãy phân tích chi tiết hơn kết quả chẩn đoán ${latestScan.diagnosis} của tôi từ ảnh chụp gần nhất.`;
        }
        switchSection('sec-doctor');
        if (latestScan) {
            setTimeout(() => sendMessage(), 500);
        }
    });

    // --- HISTORY PIPELINE ---
    async function loadHistory() {
        if (!state.idToken) return;
        
        try {
            const formData = new FormData();
            formData.append('authorization', `Bearer ${state.idToken}`);

            const response = await fetch('http://127.0.0.1:8080/api/history', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.status === 'success') {
                state.history = result.data.map(item => ({
                    id: item.id,
                    date: new Date(item.created_at).toLocaleString('vi-VN'),
                    image: item.image_url,
                    risk: item.risk_score,
                    diagnosis: item.classification,
                    details: item
                }));
                renderHistory();
                renderRecentActivity();
                updateHomeStats();
                initHomeCharts();
            }
        } catch (err) {
            console.warn("Failed to fetch history from server.");
        }
    }

    function renderRecentActivity() {
        const container = document.getElementById('homeRecentActivity');
        if (!container) return;

        if (!state.history.length) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu phân tích gần đây.</p>';
            return;
        }

        const recent = state.history.slice(0, 3);
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
                ${recent.map(item => `
                    <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; cursor: pointer; transition: background 0.3s;" onmouseover="this.style.background='rgba(59,130,246,0.05)'" onmouseout="this.style.background='transparent'">
                        <img src="${item.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; box-shadow: var(--shadow-sm);">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${item.diagnosis}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${item.date}</div>
                        </div>
                        <div class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}" style="font-size: 0.85rem; font-weight: 800;">
                            ${item.risk}%
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function updateHomeStats() {
        const greeting = document.getElementById('welcomeGreeting');
        const hour = new Date().getHours();
        let greetText = "Chào buổi tối";
        if (hour < 12) greetText = "Chào buổi sáng";
        else if (hour < 18) greetText = "Chào buổi chiều";
        
        greeting.textContent = `${greetText}, ${state.user.name.split(' ')[0]}!`;
    }

    function renderHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        if (!state.history.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:4rem; color:var(--text-muted)"><i class="fa-solid fa-clock-rotate-left fa-2x mb-2"></i><br>Chưa có dữ liệu lịch sử.</td></tr>';
            return;
        }

        tbody.innerHTML = state.history.map(item => `
            <tr>
                <td><img src="${item.image}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; box-shadow: var(--shadow-sm);"></td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${item.date}</td>
                <td><strong style="color: var(--text-primary);">${item.diagnosis}</strong></td>
                <td><span class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}">${item.risk}%</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-detail btn-pill" data-id="${item.id}" style="font-size: 0.75rem; background: var(--medical-blue-base); color: white; padding: 6px 12px;">Chi tiết</button>
                        <button class="btn-compare btn-pill" data-id="${item.id}" style="font-size: 0.75rem; background: ${state.compareSelection.includes(item.id) ? '#f1f5f9' : 'transparent'}; border: 1px solid var(--border-light); padding: 6px 12px; color: ${state.compareSelection.includes(item.id) ? 'var(--medical-blue-base)' : 'var(--text-secondary)'};">
                            ${state.compareSelection.includes(item.id) ? '<i class="fa-solid fa-check"></i> Đã chọn' : 'So sánh'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-compare').forEach(btn => {
            btn.addEventListener('click', () => toggleComparison(btn.dataset.id));
        });

        document.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => showScanDetail(btn.dataset.id));
        });
    }

    function showScanDetail(id) {
        const item = state.history.find(h => String(h.id) === String(id));
        if (!item) return;

        const modal = document.getElementById('scanDetailModal');
        const body = document.getElementById('modalBody');
        const details = item.details;
        
        const header = modal.querySelector('.modal-header h3');
        if (header) header.innerHTML = '<i class="fa-solid fa-file-medical"></i> Báo cáo Chi tiết';

        body.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 2.5rem; align-items: start;">
                <div>
                    <img src="${item.image}" style="width: 100%; border-radius: 16px; margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
                    <div style="background: #f8fafc; border-radius: 12px; padding: 1.25rem; border: 1px solid var(--border-light);">
                        <p style="font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-secondary);"><strong>Thời gian:</strong> <span style="color: var(--text-primary); float: right;">${item.date}</span></p>
                        <p style="font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-secondary);"><strong>Vị trí:</strong> <span style="color: var(--text-primary); float: right;">${details.location || 'Không xác định'}</span></p>
                        <p style="font-size: 0.85rem; margin-bottom: 0; color: var(--text-secondary);"><strong>Thời tiết:</strong> <span style="color: var(--text-primary); float: right;">${details.temperature || '--'}°C, UV ${details.uv_index || '--'}</span></p>
                    </div>
                </div>
                <div>
                    <div style="margin-bottom: 2rem;">
                        <h4 style="margin-bottom: 0.75rem; font-size: 1.3rem; color: var(--text-primary);">Chẩn đoán: ${item.diagnosis}</h4>
                        <span class="pill ${item.risk > 70 ? 'pill-danger' : (item.risk > 40 ? 'pill-warning' : 'pill-success')}" style="font-size: 1.1rem; padding: 10px 20px;">
                            Nguy cơ rủi ro: ${item.risk}%
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <h5 style="margin-bottom: 1.25rem; font-size: 1.05rem; color: var(--medical-blue-dark); border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">Thông số ABCDE</h5>
                        <div id="modalAbcdeContainer"></div>
                    </div>

                    <div style="padding: 1.5rem; background: var(--medical-blue-light); border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.2);">
                        <h5 style="margin-bottom: 0.75rem; color: var(--medical-blue-dark); font-size: 1rem;"><i class="fa-solid fa-stethoscope"></i> Lời khuyên y khoa:</h5>
                        <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">${details.medical_advice || 'Không có dữ liệu lời khuyên.'}</p>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        
        let abcde = details.abcde || {};
        if (typeof abcde === 'string') {
            try { abcde = JSON.parse(abcde); } catch(e) { abcde = {}; }
        }

        const metrics = [
            { id: 'A', label: 'Asymmetry', val: abcde.A_asymmetry?.score || 0, color: 'var(--danger)' },
            { id: 'B', label: 'Border', val: abcde.B_border?.score || 0, color: 'var(--warning)' },
            { id: 'C', label: 'Color', val: abcde.C_color?.score || 0, color: 'var(--medical-blue-base)' },
            { id: 'D', label: 'Diameter', val: abcde.D_diameter?.score || 0, color: 'var(--success)' },
            { id: 'E', label: 'Evolution', val: abcde.E_evolution?.score || 0, color: '#8b5cf6' }
        ];

        document.getElementById('modalAbcdeContainer').innerHTML = metrics.map(m => `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                    <span style="font-weight: 500;">${m.id}. ${m.label}</span>
                    <span style="font-weight: 700; color: ${m.color};">${m.val}%</span>
                </div>
                <div style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${m.val}%; height: 100%; background: ${m.color};"></div>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('btnCloseModal').addEventListener('click', () => {
        document.getElementById('scanDetailModal').classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('scanDetailModal');
        if (e.target === modal) modal.classList.add('hidden');
    });

    function toggleComparison(id) {
        if (state.compareSelection.includes(id)) {
            state.compareSelection = state.compareSelection.filter(sid => sid !== id);
        } else {
            if (state.compareSelection.length >= 2) state.compareSelection.shift();
            state.compareSelection.push(id);
        }
        renderHistory();
        updateMonitorView();
    }

    function updateMonitorView() {
        const empty = document.getElementById('compareEmpty');
        const grid = document.getElementById('compareGrid');

        if (state.compareSelection.length === 2) {
            empty.classList.add('hidden');
            grid.classList.remove('hidden');

            const item1 = state.history.find(h => h.id === state.compareSelection[0]);
            const item2 = state.history.find(h => h.id === state.compareSelection[1]);

            document.getElementById('compDate1').textContent = `Ngày: ${item1.date}`;
            document.getElementById('compImg1').src = item1.image;
            document.getElementById('compDate2').textContent = `Ngày: ${item2.date}`;
            document.getElementById('compImg2').src = item2.image;
        } else {
            empty.classList.remove('hidden');
            grid.classList.add('hidden');
        }
    }

    // --- CHARTS ---
    function initHomeCharts() {
        if (!homeProgressCanvas) return;
        
        const last7 = state.history.slice(0, 7).reverse();
        const labels = last7.map(h => h.date.split(' ')[0]);
        const data = last7.map(h => h.risk);

        if (window.homeChart) window.homeChart.destroy();

        window.homeChart = new Chart(homeProgressCanvas, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Ngày 1', 'Ngày 2', 'Ngày 3'],
                datasets: [{
                    label: 'Mức rủi ro (%)',
                    data: data.length ? data : [10, 15, 12],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#fff',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderMonitorCharts() {
        const trendCanvas = document.getElementById('monitorTrendChart');
        if (!trendCanvas) return;

        const allLabels = state.history.slice().reverse().map(h => h.date);
        const allData = state.history.slice().reverse().map(h => h.risk);

        if (window.trendChart) window.trendChart.destroy();

        window.trendChart = new Chart(trendCanvas, {
            type: 'bar',
            data: {
                labels: allLabels,
                datasets: [{
                    label: 'Lịch sử chỉ số rủi ro',
                    data: allData,
                    backgroundColor: allData.map(v => v > 70 ? 'rgba(239, 68, 68, 0.7)' : (v > 40 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)')),
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // --- DOCTOR AI CHAT LOGIC ---
    // Textarea auto-resize
    if(chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value.trim() === '') this.style.height = '44px';
        });
    }

    // Toggle Thinking Process Setting
    if (toggleThinking) {
        toggleThinking.addEventListener('change', (e) => {
            state.isThinkingEnabled = e.target.checked;
            // Update existing blocks visually
            document.querySelectorAll('.msg-thinking-container').forEach(el => {
                if (state.isThinkingEnabled) {
                    el.classList.remove('hidden-thinking');
                } else {
                    el.classList.add('hidden-thinking');
                }
            });
        });
    }

    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.query;
            sendMessage();
        });
    });

    btnSendMessage.addEventListener('click', () => {
        if(state.isGeneratingResponse) {
            // Stop logic
            if(state.abortController) {
                state.abortController.abort();
            }
        } else {
            sendMessage();
        }
    });

    chatInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(); 
        }
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text && !state.isGeneratingResponse) return;
        
        if (state.isGeneratingResponse) return; // Prevent double send

        // UI Updates
        if (chatWelcome) chatWelcome.style.opacity = '0';
        setTimeout(() => { if (chatWelcome) chatWelcome.style.display = 'none'; }, 500);

        // Add User Bubble
        const userWrapper = document.createElement('div');
        userWrapper.className = 'message-wrapper';
        userWrapper.innerHTML = `
            <div class="message-bubble-modern msg-user-modern">
                ${text.replace(/\\n/g, '<br>')}
            </div>
        `;
        chatHistory.appendChild(userWrapper);
        
        chatInput.value = '';
        chatInput.style.height = '44px';
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // Change Send button to Stop
        btnSendMessage.innerHTML = '<i class="fa-solid fa-stop"></i>';
        btnSendMessage.style.background = 'var(--text-primary)';
        state.isGeneratingResponse = true;

        // AI Placeholder
        const aiWrapper = document.createElement('div');
        aiWrapper.className = 'message-wrapper';
        aiWrapper.innerHTML = `
            <div style="display: flex; gap: 12px; max-width: 100%;">
                <div class="message-avatar avatar-bot"><img src="assets/img/logo.png" alt="AI"></div>
                <div class="message-bubble-modern msg-bot-modern" style="flex: 1;">
                    <div class="thinking-status-video active">
                        <video src="assets/video/logo.mp4" autoplay loop muted playsinline></video>
                    </div>
                </div>
            </div>
        `;
        chatHistory.appendChild(aiWrapper);
        const aiBubble = aiWrapper.querySelector('.msg-bot-modern');
        const thinkingVideo = aiWrapper.querySelector('.thinking-status-video');
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const API_URL = 'http://127.0.0.1:8080/api';
        state.abortController = new AbortController();

        try {
            const context = state.history.length ? `Lịch sử chẩn đoán: ${JSON.stringify(state.history[0].details)}` : "Chưa có dữ liệu scan.";
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: state.abortController.signal,
                body: JSON.stringify({
                    message: text,
                    model: chatModelSelect.value,
                    context: context
                })
            });

            if (!response.ok) throw new Error("Lỗi kết nối máy chủ AI");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let fullAiRes = "";
            let thoughtElement = null;
            let contentElement = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) throw new Error(data.error);
                            
                            const delta = data.choices[0].delta.content || "";
                            if (delta) {
                                fullAiRes += delta;

                                // Extract Thought process
                                const thoughtMatch = fullAiRes.match(/(?:\(think\)|<think>|<thought>)([\s\S]*?)(?:\(\/think\)|<\/think>|<\/thought>|$)/);
                                if (thoughtMatch) {
                                    if (!thoughtElement) {
                                        thoughtElement = document.createElement('div');
                                        thoughtElement.className = 'msg-thinking-container';
                                        if (!state.isThinkingEnabled) thoughtElement.classList.add('hidden-thinking');
                                        
                                        thoughtElement.innerHTML = `<div class="msg-thinking-header"><i class="fa-solid fa-brain"></i> Quá trình suy nghĩ <i class="fa-solid fa-chevron-down" style="margin-left: auto; font-size: 0.7rem;"></i></div><div class="msg-thinking-content"></div>`;
                                        
                                        // Insert before final content if exists
                                        if(contentElement) {
                                            aiBubble.insertBefore(thoughtElement, contentElement);
                                        } else {
                                            aiBubble.appendChild(thoughtElement);
                                        }

                                        // Toggle collapse
                                        thoughtElement.querySelector('.msg-thinking-header').addEventListener('click', () => {
                                            const content = thoughtElement.querySelector('.msg-thinking-content');
                                            content.style.display = content.style.display === 'none' ? 'block' : 'none';
                                        });
                                    }
                                    thoughtElement.querySelector('.msg-thinking-content').innerHTML = marked.parse(thoughtMatch[1]);
                                }

                                // Main Content
                                let displayContent = fullAiRes.replace(/(?:\(think\)|<think>|<thought>)[\s\S]*?(?:\(\/think\)|<\/think>|<\/thought>|$)/g, '').trim();
                                if (displayContent) {
                                    // When actual content starts, hide thinking video
                                    if(thinkingVideo.classList.contains('active')) {
                                        thinkingVideo.classList.remove('active');
                                    }

                                    if (!contentElement) {
                                        contentElement = document.createElement('div');
                                        contentElement.className = 'msg-final-content';
                                        aiBubble.appendChild(contentElement);
                                    }
                                    contentElement.innerHTML = marked.parse(displayContent);
                                }

                                chatHistory.scrollTop = chatHistory.scrollHeight;
                            }
                        } catch (e) {
                            console.error("Stream parse error:", e);
                        }
                    }
                }
            }

            // Finished successfully
            if(thoughtElement && fullAiRes.match(/(?:\(\/think\)|<\/think>|<\/thought>)/)) {
                thoughtElement.style.opacity = '0.7';
                thoughtElement.querySelector('.msg-thinking-content').style.display = 'none'; // Auto collapse
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                aiBubble.innerHTML += `<div style="color:var(--warning); font-size: 0.85rem; margin-top:10px;"><i class="fa-solid fa-ban"></i> Đã dừng tạo phản hồi.</div>`;
            } else {
                aiBubble.innerHTML += `<div style="color:var(--danger); font-size: 0.85rem; margin-top:10px;"><i class="fa-solid fa-circle-exclamation"></i> Lỗi: ${err.message}</div>`;
            }
        } finally {
            if(thinkingVideo) thinkingVideo.classList.remove('active');
            // Reset button
            btnSendMessage.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            btnSendMessage.style.background = 'var(--medical-blue-base)';
            state.isGeneratingResponse = false;
            state.abortController = null;
            chatInput.focus();
        }
    }

    // --- ACCOUNT & AUTH ---
    function updateAccountInfo() {
        document.getElementById('accName').textContent = state.user.name;
        document.getElementById('accEmail').textContent = state.user.email;
    }

    document.getElementById('btnLogout').addEventListener('click', async () => {
        if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi Skinderm AI?")) {
            try {
                await signOut(auth);
                window.location.href = 'auth.html';
            } catch (err) {
                console.error("Logout Error:", err);
            }
        }
    });

});
