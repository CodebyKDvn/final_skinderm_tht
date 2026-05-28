/**
 * charts.js - Chart.js Visualization Module
 */

import state from './state.js';

const CHARTS = {
    initHomeCharts(canvas) {
        if (!canvas) return;
        
        const last7 = state.history.slice(0, 7).reverse();
        const labels = last7.map(h => h.date.split(' ')[0]);
        const data = last7.map(h => h.risk);

        if (window.homeChart) window.homeChart.destroy();

        window.homeChart = new Chart(canvas, {
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
    },

    renderMonitorCharts(trendCanvas) {
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
};

export default CHARTS;
