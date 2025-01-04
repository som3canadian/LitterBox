// DOM Elements
const elements = {
    fileList: document.getElementById('fileList'),
    fileRowTemplate: document.getElementById('fileRowTemplate'),
    emptyState: document.getElementById('emptyState'),
    searchFiles: document.getElementById('searchFiles'),
    filterType: document.getElementById('filterType'),
    filterRisk: document.getElementById('filterRisk'),
    sortBy: document.getElementById('sortBy'),
    totalFiles: document.getElementById('totalFiles'),
    storageUsed: document.getElementById('storageUsed'),
    averageRisk: document.getElementById('averageRisk'),
    averageEntropy: document.getElementById('averageEntropy')
};

// State
let files = [];

// Fetch and render files
async function loadFiles() {
    try {
        const response = await fetch('/files');
        const data = await response.json();
        
        if (data.status === 'success') {
            files = Object.entries(data.files).map(([md5, file]) => ({
                md5,
                ...file
            }));
            updateStats();
            renderFiles();
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

// Update statistics
function updateStats() {
    elements.totalFiles.textContent = files.length;
    
    // Calculate total storage
    const totalBytes = files.reduce((sum, file) => sum + (file.file_size || 0), 0);
    elements.storageUsed.textContent = formatFileSize(totalBytes);
    
    // Calculate average entropy and determine risk
    const filesWithEntropy = files.filter(f => f.entropy_value);
    
    if (filesWithEntropy.length > 0) {
        const avgEntropy = filesWithEntropy.reduce((sum, file) => sum + file.entropy_value, 0) / filesWithEntropy.length;
        
        // Determine risk level based on entropy value
        let riskText;
        let riskClass;
        
        if (avgEntropy >= 7.2) {
            riskText = 'High';
            riskClass = 'bg-red-500 text-white';
        } else if (avgEntropy >= 6.8) {
            riskText = 'Medium';
            riskClass = 'bg-yellow-500 text-black';
        } else {
            riskText = 'Low';
            riskClass = 'bg-green-500 text-white';
        }
        // console.log(avgEntropy);
        
        elements.averageRisk.textContent = riskText;
        elements.averageRisk.className = 'px-2 py-1 text-sm rounded-lg inline-flex items-center justify-center font-medium ' + riskClass;
        elements.averageEntropy.textContent = `Entropy: ${avgEntropy.toFixed(3)}`;
    } else {
        elements.averageRisk.textContent = '-';
        elements.averageRisk.className = 'px-2 py-1 text-sm rounded-lg inline-flex items-center justify-center font-medium bg-gray-500 text-white';
        elements.averageEntropy.textContent = 'Entropy: -';
    }
}

// Render file list
function renderFiles() {
    const filteredFiles = filterFiles(files);
    const sortedFiles = sortFiles(filteredFiles);
    
    elements.fileList.innerHTML = '';
    elements.emptyState.classList.toggle('hidden', sortedFiles.length > 0);
    
    sortedFiles.forEach(file => {
        const row = elements.fileRowTemplate.content.cloneNode(true);
        
        // File name and hash
        row.querySelector('[data-field="fileName"]').textContent = file.filename;
        row.querySelector('[data-field="fileHash"]').textContent = file.md5;
        
        // Entropy and Risk
        const entropyEl = row.querySelector('[data-field="fileEntropy"]');
        const riskEl = row.querySelector('[data-field="fileRisk"]');
        
        if (file.entropy_value) {
            entropyEl.textContent = `Entropy: ${file.entropy_value.toFixed(2)}`;
        }
        
        if (file.detection_risk) {
            riskEl.textContent = file.detection_risk;
            riskEl.className = 'px-3 py-1 text-xs rounded-lg inline-flex items-center justify-center font-medium';
            switch(file.detection_risk.toLowerCase()) {
                case 'high':
                    // riskEl.className += ' bg-red-500/10 text-red-400 border border-red-900/20';
                    riskEl.className += ' bg-red-500 text-white';
                    break;
                case 'medium':
                    // riskEl.className += ' bg-yellow-500/10 text-yellow-400 border border-yellow-900/20';
                    riskEl.className += ' bg-yellow-500 text-black';
                    break;
                case 'low':
                    // riskEl.className += ' bg-green-500/10 text-green-400 border border-green-900/20';
                    riskEl.className += ' bg-green-500 text-white';
                    break;
                default:
                    // riskEl.className += ' bg-gray-500/10 text-gray-400 border border-gray-900/20'; 
                    riskEl.className += ' bg-gray-500 text-white';
            }
        }
        // File type
        // const typeCell = row.querySelector('#fileType');
        // const fileExt = file.filename.split('.').pop().toLowerCase();
        // typeCell.textContent = fileExt;
        
        // File size
        row.querySelector('[data-field="fileSize"]').textContent = formatFileSize(file.file_size);
        
        // Upload time
        row.querySelector('[data-field="fileUploadDate"]').textContent = file.upload_time;
        
        // Analysis status
        const statusCell = row.querySelector('[data-field="fileAnalysisStatus"]');
        const status = getAnalysisStatus(file);
        statusCell.className = `px-2 py-1 text-sm rounded-lg ${status.class}`;
        statusCell.textContent = status.text;
        
        // Action buttons
        const viewButton = row.querySelector('[data-action="view"]');
        const deleteButton = row.querySelector('[data-action="delete"]');
        
        viewButton.onclick = () => viewFile(file.md5);
        deleteButton.onclick = () => showFileDeleteWarning(file.md5);
        
        elements.fileList.appendChild(row);
    });
}

// Filter files based on search and type
function filterFiles(files) {
    const searchTerm = elements.searchFiles.value.toLowerCase();
    const fileType = elements.filterType.value;
    const riskLevel = elements.filterRisk.value;
    
    return files.filter(file => {
        const matchesSearch = file.filename.toLowerCase().includes(searchTerm) ||
                            file.md5.toLowerCase().includes(searchTerm);
        const matchesType = fileType === 'all' || file.filename.toLowerCase().endsWith(fileType);
        const matchesRisk = riskLevel === 'all' || 
                           (file.detection_risk && file.detection_risk.toLowerCase() === riskLevel);
        return matchesSearch && matchesType && matchesRisk;
    });
}

// Sort files based on selected criteria
function sortFiles(files) {
    const sortBy = elements.sortBy.value;
    
    return [...files].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.filename.localeCompare(b.filename);
            case 'newest':
                return new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime();
            case 'oldest':
                return new Date(a.upload_time).getTime() - new Date(b.upload_time).getTime();
            case 'size':
                return (b.file_size || 0) - (a.file_size || 0);
            case 'entropy':
                return (b.entropy_value || 0) - (a.entropy_value || 0);
            default:
                return 0;
        }
    });
}

// Get analysis status display properties
function getAnalysisStatus(file) {
    if (file.has_static_analysis && file.has_dynamic_analysis) {
        return {
            text: 'Complete',
            class: 'bg-green-500/10 text-green-400 border border-green-900/20'
        };
    } else if (file.has_static_analysis || file.has_dynamic_analysis) {
        return {
            text: 'Partial',
            class: 'bg-yellow-500/10 text-yellow-400 border border-yellow-900/20'
        };
    }
    return {
        text: 'Pending',
        class: 'bg-gray-500/10 text-gray-400 border border-gray-900/20'
    };
}

// View file details
function viewFile(md5) {
    window.location.href = `/file/${md5}/info`;
}

// Show/hide file delete warning
function showFileDeleteWarning(md5) {
    const modal = document.getElementById('fileDeleteWarningModal');
    const confirmButton = document.getElementById('confirmDeleteButton');
    
    // Set up the confirm button to call deleteFile with the correct md5
    confirmButton.onclick = () => deleteFile(md5);
    modal?.classList.remove('hidden');
}

function hideFileDeleteWarning() {
    const modal = document.getElementById('fileDeleteWarningModal');
    modal?.classList.add('hidden');
}

// Delete file
async function deleteFile(md5) {
    try {
        const response = await fetch(`/file/${md5}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Hide modal first
            hideFileDeleteWarning();
            
            // Wait a brief moment for the modal to hide
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Remove from local array and update UI
            files = files.filter(file => file.md5 !== md5);
            updateStats();
            renderFiles();
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

// Show cleanup warning for summary page
function showSummaryCleanupWarning() {
    const modal = document.getElementById('summaryCleanupWarningModal');
    modal?.classList.remove('hidden');
}

// Hide cleanup warning for summary page
function hideSummaryCleanupWarning() {
    const modal = document.getElementById('summaryCleanupWarningModal');
    modal?.classList.add('hidden');
}

// Cleanup all files
async function cleanupFiles() {
    try {
        const response = await fetch('/cleanup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            // Hide modal first
            hideSummaryCleanupWarning();
            // Wait a brief moment for the modal to hide
            await new Promise(resolve => setTimeout(resolve, 300));
            // Then reload
            window.location.reload(true);
        }
    } catch (error) {
        console.error('Error cleaning files:', error);
    }
}

// Make functions available globally
window.showSummaryCleanupWarning = showSummaryCleanupWarning;
window.hideSummaryCleanupWarning = hideSummaryCleanupWarning;
window.cleanupFiles = cleanupFiles;
window.showFileDeleteWarning = showFileDeleteWarning;
window.hideFileDeleteWarning = hideFileDeleteWarning;

// Utility: Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Event listeners
elements.searchFiles.addEventListener('input', () => renderFiles());
elements.filterType.addEventListener('change', () => renderFiles());
elements.sortBy.addEventListener('change', () => renderFiles());
elements.filterRisk.addEventListener('change', () => renderFiles());

// Initialize
loadFiles();