// main.js - DermAI Vision

document.addEventListener('DOMContentLoaded', () => {
    console.log("DermAI Vision - Initialized");

    // Slow down the hero video and loop first 4 seconds
    const video = document.getElementById('hero-video');
    if (video) {
        video.playbackRate = 0.55; 
        
        // Loop the video within the first 4 seconds
        video.addEventListener('timeupdate', () => {
            if (video.currentTime >= 4) {
                video.currentTime = 0;
            }
        });
    }

    // Xử lý hiệu ứng Navbar khi cuộn trang
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('navbar-liquid');
        } else {
            navbar.classList.remove('navbar-liquid');
        }
    });

    // Hamburger Menu Toggle
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    const mobileDrawer = document.getElementById('mobileMenuDrawer');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    if (hamburgerBtn && mobileDrawer) {
        hamburgerBtn.addEventListener('click', () => {
            hamburgerBtn.classList.toggle('active');
            mobileDrawer.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });

        // Close drawer when clicking a link
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburgerBtn.classList.remove('active');
                mobileDrawer.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        });
    }

    // Scroll Spy
    const sections = document.querySelectorAll('header, section');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
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

    // Intersection Observer for Animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Docs Tabs
    const docTabs = document.querySelectorAll('.tech-sidebar li');
    const docContents = document.querySelectorAll('.doc-pane');

    docTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            docTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-target');
            docContents.forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });
            
            const targetPane = document.getElementById(target);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.style.display = 'block';
            }
        });
    });
    // Performance Rocky Scroll Effect
    const rockySection = document.querySelector('.performance-rocky');
    const rockyText = document.querySelector('.rocky-bg-text');
    
    if (rockySection && rockyText) {
        window.addEventListener('scroll', () => {
            const sectionRect = rockySection.getBoundingClientRect();
            const sectionTop = sectionRect.top;
            const sectionHeight = sectionRect.height;
            const windowHeight = window.innerHeight;
            
            if (sectionTop < windowHeight && sectionTop > -sectionHeight) {
                // Progress from 0 (section enters bottom) to 1 (section leaves top)
                const scrollProgress = (windowHeight - sectionTop) / (windowHeight + sectionHeight);
                // Move text down relative to scroll progress
                const moveY = scrollProgress * 400; // Adjust sensitivity
                rockyText.style.transform = `translateY(${moveY}px)`;
            }
        });
    }
});

// ==========================================
// MIND MAP INTERACTION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const treeNodes = document.querySelectorAll('.tree-node');
    const infoBox = document.getElementById('mindmap-info');

    if (treeNodes.length > 0 && infoBox) {
        treeNodes.forEach(node => {
            node.addEventListener('click', (e) => {
                // Prevent bubbling if needed
                e.stopPropagation();
                
                // Remove active from all
                treeNodes.forEach(n => n.classList.remove('active'));
                
                // Add active to clicked
                node.classList.add('active');
                
                // Get data
                const title = node.getAttribute('data-title');
                const desc = node.getAttribute('data-desc');
                
                if (title && desc) {
                    // Animate info box
                    infoBox.style.opacity = 0;
                    infoBox.style.transform = 'translateY(10px)';
                    
                    setTimeout(() => {
                        infoBox.innerHTML = `<h3>${title}</h3><p>${desc}</p>`;
                        infoBox.style.opacity = 1;
                        infoBox.style.transform = 'translateY(0)';
                    }, 200);
                }
            });
        });
    }
});

// ==========================================
// CTA PARTICLE GRID (Hover Effect)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const ctaSection = document.querySelector('.cta-section');
    const canvas = document.getElementById('cta-particles');
    
    if (!ctaSection || !canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    
    // Grid settings
    const spacing = 35; // Distance between dots
    const baseRadius = 1.5;
    const hoverRadius = 4;
    const hoverDistance = 180; // Distance of effect
    
    // Use project's medical blue color (or read from CSS variable)
    const activeColor = '#0ea5e9'; // var(--medical-blue-base)
    const baseColor = 'rgba(150, 150, 150, 0.2)'; // Faded dot color

    let particles = [];
    let mouse = { x: -1000, y: -1000 };

    function init() {
        width = canvas.width = ctaSection.offsetWidth;
        height = canvas.height = ctaSection.offsetHeight;
        particles = [];

        for (let x = 0; x < width + spacing; x += spacing) {
            for (let y = 0; y < height + spacing; y += spacing) {
                particles.push({
                    x: x,
                    y: y,
                    baseX: x,
                    baseY: y,
                    r: baseRadius
                });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        particles.forEach(p => {
            // Calculate distance from mouse
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Calculate active ratio based on distance
            let activeRatio = 0;
            if (dist < hoverDistance) {
                activeRatio = 1 - (dist / hoverDistance);
            }

            // Interpolate radius
            const r = baseRadius + (hoverRadius - baseRadius) * activeRatio;
            
            // Move slightly towards mouse for a magnetic effect
            const moveForce = activeRatio * 12;
            if (dist > 0 && dist < hoverDistance) {
                p.x = p.baseX + (dx / dist) * moveForce;
                p.y = p.baseY + (dy / dist) * moveForce;
            } else {
                p.x += (p.baseX - p.x) * 0.1;
                p.y += (p.baseY - p.y) * 0.1;
            }

            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            
            if (activeRatio > 0.05) {
                ctx.fillStyle = activeColor;
                ctx.globalAlpha = 0.2 + (activeRatio * 0.8);
            } else {
                ctx.fillStyle = baseColor;
                ctx.globalAlpha = 1;
            }
            
            ctx.fill();
            ctx.globalAlpha = 1; // Reset alpha
        });

        requestAnimationFrame(draw);
    }

    init();
    draw();

    window.addEventListener('resize', init);

    ctaSection.addEventListener('mousemove', (e) => {
        const rect = ctaSection.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    ctaSection.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });
});
