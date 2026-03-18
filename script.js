// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let flipBook = null;
let pdfDoc = null;
const scale = 1.5; // High-quality rendering

// Global state
window.currentPdfData = null;
let originalPages = []; // Store original page elements for re-injection

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
        console.log("No default book.pdf found.");
    }
});

// "Change PDF" button
document.getElementById('btn-upload').addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    flipbookSection.classList.add('hidden');
    if (flipBook) {
        try { flipBook.destroy(); } catch(e) {}
        flipBook = null;
    }
    flipbookEl.innerHTML = '';
    originalPages = [];
    pdfDoc = null;
    window.currentPdfData = null;
});

// Upload logic
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') handlePDF(files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handlePDF(e.target.files[0]);
});

async function handlePDF(file) {
    uploadSection.classList.add('hidden');
    loader.classList.remove('hidden');
    progressEl.textContent = '0%';
    flipbookEl.innerHTML = '';
    originalPages = [];

    try {
        const arrayBuffer = await (file.arrayBuffer ? file.arrayBuffer() : file.slice().arrayBuffer());
        window.currentPdfData = arrayBuffer;

        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDoc.numPages;
        totalPagesEl.textContent = totalPages;

        for (let i = 1; i <= totalPages; i++) {
            await renderPage(i);
            updateProgress(i, totalPages);
        }

        initFlipbook();
    } catch (err) {
        console.error('PDF Load Error:', err);
        alert('Error loading PDF.');
        uploadSection.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

async function renderPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = Math.round(viewport.height);
    canvas.width = Math.round(viewport.width);

    await page.render({ canvasContext: context, viewport }).promise;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.appendChild(canvas);
    
    originalPages.push(pageDiv); // Keep for re-injection on resize
}

function updateProgress(current, total) {
    const progress = Math.round((current / total) * 100);
    progressEl.textContent = `${progress}%`;
}

function initFlipbook() {
    loader.classList.add('hidden');
    flipbookSection.classList.remove('hidden');

    if (originalPages.length === 0) return;

    // Preserve current page
    let currentPage = flipBook ? flipBook.getCurrentPageIndex() : 0;

    // Clean destruction
    if (flipBook) {
        try { flipBook.destroy(); } catch (e) {}
        flipBook = null;
    }

    // CRITICAL: Re-inject pages into a clean container
    flipbookEl.innerHTML = '';
    originalPages.forEach(p => {
        // Clone or re-append (re-appeding is fine as long as they are fresh)
        flipbookEl.appendChild(p);
    });

    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? window.innerWidth * 0.95 : 500;
    const height = isMobile ? (window.innerWidth * 0.95) * 1.4 : 700;

    try {
        flipBook = new St.PageFlip(flipbookEl, {
            width: Math.round(width),
            height: Math.round(height),
            size: "stretch",
            minWidth: 200,
            maxWidth: 1000,
            minHeight: 300,
            maxHeight: 1500,
            maxShadowOpacity: 0.5,
            showCover: originalPages.length > 2,
            mobileScrollSupport: false,
            usePortrait: isMobile,
            startPage: currentPage
        });

        flipBook.loadFromHTML(document.querySelectorAll('.page'));
    } catch (e) {
        console.error("Flipbook Init Failure:", e);
    }

    flipBook.on('flip', (e) => {
        currentPageEl.textContent = e.data + 1;
    });

    document.getElementById('btn-prev').onclick = () => flipBook.flipPrev();
    document.getElementById('btn-next').onclick = () => flipBook.flipNext();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (pdfDoc && originalPages.length > 0) initFlipbook();
    }, 300);
});

// Download Logic
document.getElementById('btn-download').addEventListener('click', async () => {
    if (!pdfDoc || !window.currentPdfData) { alert("Upload first!"); return; }
    const btn = document.getElementById('btn-download');
    btn.textContent = "Zipping...";
    try {
        const zip = new JSZip();
        // Use simpler HTML for the download to avoid local issues
        zip.file("index.html", `<!DOCTYPE html>${document.documentElement.innerHTML}`);
        zip.file("styles.css", await (await fetch('styles.css')).text());
        zip.file("script.js", await (await fetch('script.js')).text());
        zip.file("book.pdf", window.currentPdfData);
        saveAs(await zip.generateAsync({type:"blob"}), "flipbook.zip");
    } catch (err) { alert("Download failed. Copy the folder manually!"); }
    finally { btn.textContent = "Download Ebook"; }
});
