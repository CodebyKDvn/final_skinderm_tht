/**
 * ui.js - General UI Management (Sidebar, Theme, Language)
 */

import state from './state.js';

const i18n = {
    vi: {
        nav_home: "Trang chủ",
        nav_explore: "Khám phá",
        nav_scan: "Quét & Phân tích",
        nav_monitor: "Theo dõi",
        nav_history: "Lịch sử",
        nav_doctor: "Bác sĩ AI",
        nav_settings: "Cài đặt",
        nav_account: "Tài khoản",
        explore_title: "Khám phá Da liễu",
        scan_title: "Phân tích Tổn thương Da",
        monitor_title: "Theo dõi Tiến triển",
        history_title: "Lịch sử Phân tích",
        btn_upload: "Tải ảnh lên",
        btn_camera: "Máy ảnh",
        scan_drag_drop: "Kéo thả hoặc nhấn để chọn ảnh",
        btn_capture: "Chụp ảnh",
        btn_flip: "Đổi cam",
        btn_analyze: "Bắt đầu phân tích AI",
        btn_cancel: "Hủy",
        btn_save: "Lưu thay đổi",
        btn_edit: "Chỉnh sửa",
        btn_consult_ai: "Hỏi ý kiến Bác sĩ AI",
        scan_advice: "Lời khuyên Y khoa:",
        scan_advice_loading: "Hệ thống đang chuẩn bị lời khuyên...",
        chat_welcome: "Skinderm AI xin chào",
        chat_placeholder: "Hỏi Skinderm AI về vấn đề da liễu...",
        profile_update_title: "Cập nhật hồ sơ",
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
        nav_home: "Dashboard",
        nav_explore: "Explore",
        nav_scan: "Scan & Analyze",
        nav_monitor: "Monitor",
        nav_history: "History",
        nav_doctor: "AI Doctor",
        nav_settings: "Settings",
        nav_account: "Account",
        explore_title: "Dermatology Explore",
        scan_title: "Skin Lesion Analysis",
        monitor_title: "Progress Monitoring",
        history_title: "Analysis History",
        btn_upload: "Upload Photo",
        btn_camera: "Camera",
        scan_drag_drop: "Drag & drop or click to select image",
        btn_capture: "Capture",
        btn_flip: "Flip Cam",
        btn_analyze: "Start AI Analysis",
        btn_cancel: "Cancel",
        btn_save: "Save Changes",
        btn_edit: "Edit",
        btn_consult_ai: "Consult AI Doctor",
        scan_advice: "Medical Advice:",
        scan_advice_loading: "System is preparing advice...",
        chat_welcome: "Welcome to Skinderm AI",
        chat_placeholder: "Ask Skinderm AI about dermatology...",
        profile_update_title: "Update Profile",
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

const UI = {
    applyLanguage() {
        const dict = i18n[state.lang];
        if (!dict) return;
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });
    },

    applyTheme() {
        const toggleDarkMode = document.getElementById('toggleDarkMode');
        if (state.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (toggleDarkMode) toggleDarkMode.checked = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (toggleDarkMode) toggleDarkMode.checked = false;
        }
    },

    toggleSidebar(sidebar) {
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        if (sidebar.classList.contains('circular')) {
            sidebar.classList.remove('circular');
            if (toggleSidebarBtn) {
                const icon = toggleSidebarBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-chevron-left';
            }
        } else {
            sidebar.classList.add('circular');
            if (toggleSidebarBtn) {
                const icon = toggleSidebarBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-chevron-right';
            }
        }
    },

    switchSection(sectionId, navItems, sections) {
        state.activeSection = sectionId;
        
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        sections.forEach(sec => {
            if (sec.id === sectionId) {
                sec.classList.add('active');
                sec.style.animation = 'none';
                sec.offsetHeight; // trigger reflow
                sec.style.animation = null; 
            } else {
                sec.classList.remove('active');
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateAccountInfo() {
        if (!state.user) return;
        
        // Main Account Page
        const accName = document.getElementById('accName');
        const accEmail = document.getElementById('accEmail');
        if (accName) accName.textContent = state.user.name;
        if (accEmail) accEmail.textContent = state.user.email;

        // Sidebar Profile
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarEmail = document.getElementById('sidebarUserEmail');
        const sidebarPhoto = document.getElementById('sidebarUserPhoto');
        
        if (sidebarName) sidebarName.textContent = state.user.name;
        if (sidebarEmail) sidebarEmail.textContent = state.user.email;
        if (sidebarPhoto && state.user.photo) {
            sidebarPhoto.src = state.user.photo;
        } else if (sidebarPhoto) {
            sidebarPhoto.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=random&color=fff`;
        }
    },

    toggleProfileModal(show) {
        const modal = document.getElementById('profileEditModal');
        if (modal) {
            if (show) modal.classList.remove('hidden');
            else modal.classList.add('hidden');
        }
    }
};


export default UI;
