document.addEventListener('DOMContentLoaded', () => {
    // Map of form input IDs to preview element IDs
    const fieldMap = {
        'f-project': 'p-project',
        'f-to': 'p-to',
        'f-attn': 'p-attn',
        'f-from': 'p-from',
        'f-date': 'p-date',
        'f-tc-no': 'p-tc-no',
        'f-ref-no': 'p-ref-no',
        'f-subject': 'p-subject',
        'f-references': 'p-references',
        'f-description': 'p-description',
        'f-proposal': 'p-proposal'
    };

    // Initialize logic
    loadFromLocalStorage();
    setupEventListeners();

    function setupEventListeners() {
        // Bind input events to update preview and save
        for (const [inputId, previewId] of Object.entries(fieldMap)) {
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                inputEl.addEventListener('input', (e) => {
                    updatePreview(previewId, e.target.value);
                    saveToLocalStorage();
                });
            }
        }

        // Action Buttons
        document.getElementById('btn-print').addEventListener('click', () => {
            window.print();
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            if(confirm('Are you sure you want to clear all fields? This cannot be undone.')) {
                clearForm();
            }
        });
    }

    function updatePreview(previewId, value) {
        const previewEl = document.getElementById(previewId);
        if (previewEl) {
            previewEl.textContent = value;
        }
    }

    function saveToLocalStorage() {
        const data = {};
        for (const inputId of Object.keys(fieldMap)) {
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                data[inputId] = inputEl.value;
            }
        }
        localStorage.setItem('tc-draft-data', JSON.stringify(data));
    }

    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('tc-draft-data');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                for (const [inputId, previewId] of Object.entries(fieldMap)) {
                    const inputEl = document.getElementById(inputId);
                    if (inputEl && data[inputId] !== undefined) {
                        inputEl.value = data[inputId];
                        updatePreview(previewId, data[inputId]);
                    }
                }
            } catch (e) {
                console.error('Failed to parse saved data', e);
            }
        } else {
            // Set default date if empty
            const dateInput = document.getElementById('f-date');
            if (dateInput && !dateInput.value) {
                dateInput.valueAsDate = new Date();
                updatePreview('p-date', dateInput.value);
            }
        }
    }

    function clearForm() {
        for (const [inputId, previewId] of Object.entries(fieldMap)) {
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                inputEl.value = '';
                updatePreview(previewId, '');
            }
        }
        
        // Reset date
        const dateInput = document.getElementById('f-date');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
            updatePreview('p-date', dateInput.value);
        }

        localStorage.removeItem('tc-draft-data');
    }
});
