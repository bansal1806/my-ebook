// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let flipBook = null;
let pdfDoc = null;
const scale = 1.5; // Adjust rendering scale

// Global state for persistence
window.currentPdfData = null;

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
        pdfDoc = null;
        window.currentPdfData = null;
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
    flipbookEl.innerHTML = ''; 

    try {
        const arrayBuffer = await (file.arrayBuffer ? file.arrayBuffer() : file.slice().arrayBuffer());
        window.currentPdfData = arrayBuffer;

        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDoc.numPages;
        totalPagesEl.textContent = totalPages;

        // Optimized Rendering Loop: Render first 4 pages to show the book quickly
        const initialPages = Math.min(4, totalPages);
        
        for (let i = 1; i <= initialPages; i++) {
            await renderPage(i);
            updateProgress(i, totalPages);
        }

        // Initialize flipbook session
        initFlipbook();

        // Background rendering for the rest of the pages
        if (totalPages > initialPages) {
            for (let i = initialPages + 1; i <= totalPages; i++) {
                await renderPage(i);
                updateProgress(i, totalPages);
                
                if (flipBook) {
                    flipBook.updateFromHtml(document.querySelectorAll('.page'));
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

    } catch (err) {
        console.error('Error loading PDF:', err);
        alert('Failed to load PDF. Please try again.');
        uploadSection.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

async function renderPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
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
}

function updateProgress(current, total) {
    const progress = Math.round((current / total) * 100);
    progressEl.textContent = `${progress}%`;
}

function initFlipbook() {
    loader.classList.add('hidden');
    flipbookSection.classList.remove('hidden');

    // Adaptive sizing
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? window.innerWidth * 0.9 : 500;
    const height = isMobile ? (window.innerWidth * 0.9) * 1.4 : 700;

    if (flipBook) {
        flipBook.destroy();
        flipbookEl.innerHTML = '';
        // Re-inject pages after destroy if needed, 
        // but it's cleaner to just create a fresh instance
    }

    flipBook = new St.PageFlip(flipbookEl, {
        width: Math.round(width),
        height: Math.round(height),
        size: "stretch",
        minWidth: 315,
        maxWidth: 1000,
        minHeight: 420,
        maxHeight: 1350,
        maxShadowOpacity: 0.5,
        showCover: true,
        mobileScrollSupport: false,
        usePortrait: isMobile, // Use single page on mobile
        startPage: 0
    });

    flipBook.loadFromHTML(document.querySelectorAll('.page'));

    flipBook.on('flip', (e) => {
        currentPageEl.textContent = e.data + 1;
    });

    document.getElementById('btn-prev').onclick = () => flipBook.flipPrev();
    document.getElementById('btn-next').onclick = () => flipBook.flipNext();
}

// Handle window resize for perfect responsiveness
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (pdfDoc && flipBook) {
            initFlipbook();
        }
    }, 500);
});

// "Download Ebook" feature
document.getElementById('btn-download').addEventListener('click', async () => {
    if (!pdfDoc || !window.currentPdfData) {
        alert("Please upload a PDF first!");
        return;
    }

    const btn = document.getElementById('btn-download');
    const originalText = btn.textContent;
    btn.textContent = "Zipping...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        
        const cssResponse = await fetch('styles.css');
        const jsResponse = await fetch('script.js');
        
        const css = await cssResponse.text();
        const js = await jsResponse.text();
        
        zip.file("index.html", document.documentElement.outerHTML);
        zip.file("styles.css", css);
        zip.file("script.js", js);
        zip.file("book.pdf", window.currentPdfData);

        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, "my-premium-flipbook.zip");
        
        alert("Success! Extract this zip and you'll have a permanent ebook ready for hosting.");
    } catch (err) {
        console.error("Download error:", err);
        alert("Download failed. But don't worry! You can just copy the folder 'EBOOK' from your desktop!");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});
