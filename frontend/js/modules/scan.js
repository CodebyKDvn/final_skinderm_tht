/**
 * scan.js - Skin Capture & Analysis Logic
 */

import state from './state.js';
import API from './api.js';

const SCAN = {
    async startCamera(webcamEl) {
        try {
            state.currentStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: state.usingFrontCamera ? 'user' : 'environment' } 
            });
            webcamEl.srcObject = state.currentStream;
        } catch (err) {
            alert("Không thể mở camera. Vui lòng kiểm tra quyền truy cập.");
        }
    },

    stopCamera() {
        if (state.currentStream) {
            state.currentStream.getTracks().forEach(track => track.stop());
            state.currentStream = null;
        }
    },

    handleFile(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.lastCapturedImage = e.target.result;
            if (callback) callback();
        };
        reader.readAsDataURL(file);
    },

    captureImage(webcamEl) {
        const canvas = document.createElement('canvas');
        canvas.width = webcamEl.videoWidth;
        canvas.height = webcamEl.videoHeight;
        canvas.getContext('2d').drawImage(webcamEl, 0, 0);
        state.lastCapturedImage = canvas.toDataURL('image/jpeg');
        this.stopCamera();
    }
};

export default SCAN;
