document.addEventListener('DOMContentLoaded', function() {
    // 响应式菜单
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            console.log('菜单切换');
        });
    }
    
    // 轮播图
    const slides = document.querySelectorAll('.slide');
    const prevButton = document.querySelector('.slider-controls .prev');
    const nextButton = document.querySelector('.slider-controls .next');
    let currentSlide = 0;
    
    function showSlide(n) {
        slides.forEach(slide => slide.classList.remove('active'));
        currentSlide = (n + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    if (prevButton && nextButton) {
        prevButton.addEventListener('click', () => showSlide(currentSlide - 1));
        nextButton.addEventListener('click', () => showSlide(currentSlide + 1));
    }
    
    // 自动轮播
    setInterval(() => showSlide(currentSlide + 1), 5000);
    
    // 滚动效果
    const cards = document.querySelectorAll('.card');
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        { threshold: 0.1 }
    );
    
    cards.forEach(card => observer.observe(card));
}); 