// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let flipBook = null;
let pdfDoc = null;
const scale = 1.5; // Adjust rendering scale

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const flipbookSection = document.getElementById('flipbook-section');
const flipbookEl = document.getElementById('flipbook');
const loader = document.getElementById('loader');
const progressEl = document.getElementById('progress');
const currentPageEl = document.getElementById('current-page');
const totalPagesEl = document.getElementById('total-pages');

// Check for default PDF on load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('book.pdf');
        if (response.ok) {
            const blob = await response.blob();
            handlePDF(blob);
        }
    } catch (e) {
        console.log("No default book.pdf found. Waiting for upload.");
    }
});


// Feature Toggles (for "Change PDF")
document.getElementById('btn-upload').addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    flipbookSection.classList.add('hidden');
    if (flipBook) {
        flipBook.destroy();
        flipbookEl.innerHTML = '';
    }
});

// Drag and Drop Logic
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handlePDF(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handlePDF(e.target.files[0]);
    }
});

async function handlePDF(file) {
    uploadSection.classList.add('hidden');
    loader.classList.remove('hidden');
    progressEl.textContent = '0%';

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDoc.numPages;
        totalPagesEl.textContent = totalPages;

        // Render all pages
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            flipbookEl.appendChild(pageDiv);

            const progress = Math.round((i / totalPages) * 100);
            progressEl.textContent = `${progress}%`;
        }

        initFlipbook();
    } catch (err) {
        console.error('Error loading PDF:', err);
        alert('Failed to load PDF. Please try again.');
        uploadSection.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

function initFlipbook() {
    loader.classList.add('hidden');
    flipbookSection.classList.remove('hidden');

    const width = 500; // Standard page width
    const height = 700; // Standard page height

    flipBook = new St.PageFlip(flipbookEl, {
        width: width,
        height: height,
        size: "stretch",
        minWidth: 315,
        maxWidth: 1000,
        minHeight: 420,
        maxHeight: 1350,
        maxShadowOpacity: 0.5,
        showCover: true,
        mobileScrollSupport: false
    });

    flipBook.loadFromHTML(document.querySelectorAll('.page'));

    flipBook.on('flip', (e) => {
        currentPageEl.textContent = e.data + 1;
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
        flipBook.flipPrev();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        flipBook.flipNext();
    });
}

// "Download Ebook" feature
document.getElementById('btn-download').addEventListener('click', () => {
    alert("I am preparing your permanent storage instructions. Please check the walkthrough for how to save this forever!");
});
