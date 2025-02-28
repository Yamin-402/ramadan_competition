document.addEventListener('DOMContentLoaded', () => {
    // تفعيل عناصر التوضيح
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });

    // إدارة عرض التفاصيل
    document.querySelectorAll('.task-details-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const details = button.closest('.task-item').querySelector('.task-details');
            details.classList.toggle('show');
        });
    });
});