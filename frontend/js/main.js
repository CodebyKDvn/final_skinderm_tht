// main.js - DermAI Vision

document.addEventListener('DOMContentLoaded', () => {
    console.log("DermAI Vision - Initialized");

    // Xử lý hiệu ứng Navbar khi cuộn trang
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(5, 5, 5, 0.7)';
            navbar.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.4)';
            navbar.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.05)';
            navbar.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
            navbar.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }
    });

    // Scroll Spy (Quăng class active theo khu vực)
    const sections = document.querySelectorAll('header, section');
    const navLinks = document.querySelectorAll('.nav-links a:not(.btn-demo)');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            // Cho phép kích hoạt khi cuộn đến 1/3 section
            if (scrollY >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (current && link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Hàm tiện ích thêm class khi element xuất hiện trong viewport (sẽ dùng cho animation)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            } else {
                // Khôi phục lại hiệu ứng fadein mỗi khi cuộn qua lại
                entry.target.classList.remove('in-view');
            }
        });
    }, observerOptions);

    // Mặc định, sẽ áp dụng cho tất cả elements có class .animate-on-scroll
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Xử lý chuyển đổi Tab cho hệ thống Docs (Tài liệu API Private)
    const docTabs = document.querySelectorAll('.tech-sidebar li');
    const docContents = document.querySelectorAll('.doc-pane');

    docTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all tabs
            docTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Get target id
            const target = tab.getAttribute('data-target');
            
            // Hide all contents
            docContents.forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });
            
            // Show target
            const targetPane = document.getElementById(target);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.style.display = 'block';
                targetPane.style.animation = 'fadeInTab 0.4s ease forwards';
            }
        });
    });

    // Hiệu ứng Typewriter (Gõ chữ) cho Hero Title
    const typingElement = document.querySelector('.typing-text');
    if (typingElement) {
        const texts = [
            "Intelligent Skin Cancer Diagnostics",
            "High-Precision Lesion Analysis",
            "Secured Hospital-grade Edge AI",
            "Enterprise Deep Learning Models"
        ];
        const gradients = [
            "linear-gradient(90deg, #f4f4f5 0%, #a1a1aa 100%)", // Silver / Platinum
            "linear-gradient(90deg, #7dd3fc 0%, #0284c7 100%)", // Luxurious Medical Blue
            "linear-gradient(90deg, #e4e4e7 0%, #71717a 100%)", // Titanium
            "linear-gradient(90deg, #ffffff 0%, #e4e4e7 100%)"  // Pure Elegance
        ];

        let textIndex = 0;
        let charIndex = 0;
        let isDeleting = false;

        // Cài đặt gradient khởi đầu
        typingElement.style.backgroundImage = gradients[0];

        function typeWriter() {
            const currentText = texts[textIndex];
            
            if (isDeleting) {
                typingElement.textContent = currentText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                typingElement.textContent = currentText.substring(0, charIndex + 1);
                charIndex++;
            }

            let typeSpeed = isDeleting ? 30 : 60;

            if (!isDeleting && charIndex === currentText.length) {
                isDeleting = true;
                typeSpeed = 2500; // Dừng lại để người dùng đọc (2.5 giây)
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
                typingElement.style.backgroundImage = gradients[textIndex]; // Đổi gradient màu mới
                typeSpeed = 400; // Nghỉ chút trước khi gõ sang câu khác
            }

            setTimeout(typeWriter, typeSpeed);
        }

        // Bắt đầu chạy sau khi hiệu ứng Fade-in của header đã ổn định
        setTimeout(typeWriter, 1200);
    }
});
