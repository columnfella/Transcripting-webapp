// Header scroll behavior
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.top-header');
    let lastScrollTop = 0;
    let scrollThreshold = 100; // Pixels to scroll before hiding header
    let isHeaderVisible = true;
    let ticking = false;

    function updateHeader() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollingDown = scrollTop > lastScrollTop;
        const scrolledEnough = Math.abs(scrollTop - lastScrollTop) > 5; // Minimum scroll distance

        if (scrolledEnough) {
            if (scrollingDown && scrollTop > scrollThreshold && isHeaderVisible) {
                // Scrolling down and past threshold - hide header
                header.classList.add('header-hidden');
                header.classList.remove('header-visible');
                isHeaderVisible = false;
            } else if (!scrollingDown && !isHeaderVisible) {
                // Scrolling up - show header
                header.classList.add('header-visible');
                header.classList.remove('header-hidden');
                isHeaderVisible = true;
            } else if (scrollTop <= scrollThreshold && !isHeaderVisible) {
                // Near top of page - always show header
                header.classList.add('header-visible');
                header.classList.remove('header-hidden');
                isHeaderVisible = true;
            }

            lastScrollTop = scrollTop;
        }

        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }

    // Listen for scroll events
    window.addEventListener('scroll', requestTick, { passive: true });

    // Initialize header state
    header.classList.add('header-visible');
});

// Logo click to scroll to top
document.addEventListener('DOMContentLoaded', function() {
    const logoContainer = document.querySelector('.logo-container');
    const logoText = document.querySelector('.top-header-title-span');

    if (logoContainer && logoText) {
        // Make the logo clickable
        logoContainer.style.cursor = 'pointer';
        logoText.style.cursor = 'pointer';

        // Add click event listener
        logoContainer.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        // Optional: Add subtle hover effect without modifying CSS
        logoContainer.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
            this.style.transition = 'transform 0.2s ease';
        });

        logoContainer.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
});