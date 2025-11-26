// Modal Designer State
let sections = [];
let selectedSectionId = null;
let modalWidth = 400;
let modalHeight = 600;

// Initialize with default sections
function init() {
    // Add default sections
    const defaultSections = ['Header', 'Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6', 'Line 7', 'Line 8'];

    defaultSections.forEach((name, index) => {
        const heightPercent = index === 0 ? 10 : 11.25; // Header 10%, others split remaining 90%
        sections.push({
            id: Date.now() + index,
            name: name,
            height: heightPercent,
            content: []
        });
    });

    renderSections();
    renderControls();
    setupDragAndResize();
}

// Add new section
function addSection() {
    const sectionNumber = sections.length + 1;
    const newSection = {
        id: Date.now(),
        name: `Line ${sectionNumber}`,
        height: 10,
        content: []
    };

    sections.push(newSection);
    renderSections();
    renderControls();
}

// Remove section
function removeSection(id) {
    sections = sections.filter(s => s.id !== id);
    if (selectedSectionId === id) {
        selectedSectionId = null;
    }
    renderSections();
    renderControls();
}

// Update section height
function updateSectionHeight(id, height) {
    const section = sections.find(s => s.id === id);
    if (section) {
        section.height = parseFloat(height);
        renderSections();
    }
}

// Select section
function selectSection(id) {
    selectedSectionId = id;
    renderSections();
    renderControls();
}

// Add content to selected section
function addContent(type) {
    if (!selectedSectionId) {
        alert('Please select a section first!');
        return;
    }

    const section = sections.find(s => s.id === selectedSectionId);
    if (!section) return;

    const content = {
        id: Date.now(),
        type: type
    };

    section.content.push(content);
    renderSections();
}

// Render sections in modal
function renderSections() {
    const container = document.getElementById('modalSections');
    container.innerHTML = '';

    sections.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'modal-section';
        sectionEl.style.height = `${section.height}%`;

        if (section.id === selectedSectionId) {
            sectionEl.classList.add('selected');
        }

        sectionEl.onclick = (e) => {
            e.stopPropagation();
            selectSection(section.id);
        };

        // Add label
        const label = document.createElement('div');
        label.className = 'section-label';
        label.textContent = `${section.name} (${section.height.toFixed(1)}%)`;
        sectionEl.appendChild(label);

        // Render content
        section.content.forEach(item => {
            const contentEl = createContentElement(item);
            sectionEl.appendChild(contentEl);
        });

        container.appendChild(sectionEl);
    });

    // Click outside to deselect
    container.onclick = () => {
        selectedSectionId = null;
        renderSections();
        renderControls();
    };
}

// Create content element
function createContentElement(item) {
    const el = document.createElement('div');

    switch (item.type) {
        case 'text':
            el.className = 'dummy-text';
            el.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.';
            break;
        case 'button':
            const btn = document.createElement('button');
            btn.className = 'dummy-button';
            btn.textContent = 'Click Me';
            el.appendChild(btn);
            break;
        case 'input':
            const input = document.createElement('input');
            input.className = 'dummy-input';
            input.type = 'text';
            input.placeholder = 'Enter text...';
            el.appendChild(input);
            break;
        case 'image':
            const img = document.createElement('div');
            img.className = 'dummy-image';
            img.textContent = '🖼️ Image Placeholder';
            el.appendChild(img);
            break;
    }

    return el;
}

// Render controls panel
function renderControls() {
    const container = document.getElementById('sectionControls');
    container.innerHTML = '';

    sections.forEach(section => {
        const controlEl = document.createElement('div');
        controlEl.className = 'section-control';

        if (section.id === selectedSectionId) {
            controlEl.classList.add('selected');
        }

        controlEl.innerHTML = `
            <div class="section-header">
                <span class="section-name">${section.name}</span>
                <button class="btn-remove" onclick="removeSection(${section.id})">Remove</button>
            </div>
            <div class="height-control">
                <label>Height:</label>
                <input type="range"
                       min="5"
                       max="50"
                       step="0.5"
                       value="${section.height}"
                       oninput="updateSectionHeight(${section.id}, this.value); this.nextElementSibling.value = this.value">
                <input type="number"
                       min="5"
                       max="50"
                       step="0.5"
                       value="${section.height}"
                       oninput="updateSectionHeight(${section.id}, this.value); this.previousElementSibling.value = this.value">
            </div>
        `;

        controlEl.onclick = () => selectSection(section.id);

        container.appendChild(controlEl);
    });
}

// Setup drag and resize functionality
function setupDragAndResize() {
    const modal = document.getElementById('modalPreview');
    const header = modal.querySelector('.modal-header');
    const resizeHandle = modal.querySelector('.resize-handle');

    // Dragging
    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('.modal-drag-handle') || e.target === header) {
            initialX = e.clientX - modal.offsetLeft;
            initialY = e.clientY - modal.offsetTop;
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            modal.style.left = currentX + 'px';
            modal.style.top = currentY + 'px';
            modal.style.transform = 'none';
        }
    }

    function dragEnd() {
        isDragging = false;
    }

    // Resizing
    let isResizing = false;
    let originalWidth, originalHeight, originalMouseX, originalMouseY;

    resizeHandle.addEventListener('mousedown', resizeStart);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', resizeEnd);

    function resizeStart(e) {
        isResizing = true;
        originalWidth = modal.offsetWidth;
        originalHeight = modal.offsetHeight;
        originalMouseX = e.clientX;
        originalMouseY = e.clientY;
        e.preventDefault();
    }

    function resize(e) {
        if (isResizing) {
            const width = originalWidth + (e.clientX - originalMouseX);
            const height = originalHeight + (e.clientY - originalMouseY);

            if (width > 200) {
                modal.style.width = width + 'px';
                modalWidth = width;
            }
            if (height > 300) {
                modal.style.height = height + 'px';
                modalHeight = height;
            }

            updateSizeDisplay();
        }
    }

    function resizeEnd() {
        isResizing = false;
    }
}

// Update size display
function updateSizeDisplay() {
    document.getElementById('modalWidth').textContent = Math.round(modalWidth);
    document.getElementById('modalHeight').textContent = Math.round(modalHeight);
}

// Export HTML
function exportHTML() {
    let html = `<div class="modal-container">\n`;
    html += `  <div class="modal-header">\n`;
    html += `    <span class="modal-title">Modal Title</span>\n`;
    html += `    <button class="modal-close">×</button>\n`;
    html += `  </div>\n`;
    html += `  <div class="modal-body">\n`;

    sections.forEach(section => {
        html += `    <div class="modal-section" data-height="${section.height}%">\n`;
        html += `      <!-- ${section.name} -->\n`;

        section.content.forEach(item => {
            switch (item.type) {
                case 'text':
                    html += `      <p>Lorem ipsum dolor sit amet...</p>\n`;
                    break;
                case 'button':
                    html += `      <button>Click Me</button>\n`;
                    break;
                case 'input':
                    html += `      <input type="text" placeholder="Enter text...">\n`;
                    break;
                case 'image':
                    html += `      <img src="placeholder.jpg" alt="Placeholder">\n`;
                    break;
            }
        });

        html += `    </div>\n`;
    });

    html += `  </div>\n`;
    html += `</div>`;

    showExportModal('Export HTML', html);
}

// Export CSS
function exportCSS() {
    let css = `.modal-container {\n`;
    css += `  width: ${modalWidth}px;\n`;
    css += `  height: ${modalHeight}px;\n`;
    css += `  background: white;\n`;
    css += `  border-radius: 12px;\n`;
    css += `  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n`;
    css += `  display: flex;\n`;
    css += `  flex-direction: column;\n`;
    css += `  overflow: hidden;\n`;
    css += `}\n\n`;

    css += `.modal-header {\n`;
    css += `  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n`;
    css += `  color: white;\n`;
    css += `  padding: 16px 20px;\n`;
    css += `  display: flex;\n`;
    css += `  justify-content: space-between;\n`;
    css += `  align-items: center;\n`;
    css += `}\n\n`;

    css += `.modal-body {\n`;
    css += `  flex: 1;\n`;
    css += `  display: flex;\n`;
    css += `  flex-direction: column;\n`;
    css += `  overflow-y: auto;\n`;
    css += `}\n\n`;

    sections.forEach((section, index) => {
        css += `.modal-section:nth-child(${index + 1}) {\n`;
        css += `  height: ${section.height}%;\n`;
        css += `  padding: 16px;\n`;
        css += `  border-bottom: 1px solid #e0e0e0;\n`;
        css += `}\n\n`;
    });

    showExportModal('Export CSS', css);
}

// Show export modal
function showExportModal(title, code) {
    const modal = document.getElementById('exportModal');
    const titleEl = document.getElementById('exportTitle');
    const codeEl = document.getElementById('exportCode');

    titleEl.textContent = title;
    codeEl.value = code;
    modal.classList.add('active');
}

// Close export modal
function closeExportModal() {
    const modal = document.getElementById('exportModal');
    modal.classList.remove('active');
}

// Copy export code
function copyExportCode() {
    const codeEl = document.getElementById('exportCode');
    codeEl.select();
    document.execCommand('copy');
    alert('Code copied to clipboard!');
}

// Reset modal
function resetModal() {
    if (confirm('Are you sure you want to reset the modal? This will clear all sections and content.')) {
        sections = [];
        selectedSectionId = null;

        const modal = document.getElementById('modalPreview');
        modal.style.width = '400px';
        modal.style.height = '600px';
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.transform = 'translate(-50%, -50%)';

        modalWidth = 400;
        modalHeight = 600;

        init();
    }
}

// Click outside export modal to close
window.onclick = function(event) {
    const modal = document.getElementById('exportModal');
    if (event.target === modal) {
        closeExportModal();
    }
}

// Initialize on load
window.onload = init;
