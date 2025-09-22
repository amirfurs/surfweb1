/**
 * Configuration script to disable mock backend and use Flask API
 * This should be loaded before other scripts to ensure proper configuration
 */

// Disable the mock backend to force use of real Flask API
window.DISABLE_MOCK_BACKEND = true;

// Override the mock backend initialization
(function() {
    // Prevent mock backend from being created
    const originalMockBackend = window.MockBackend;
    
    // Disable mock backend by making it null
    Object.defineProperty(window, 'mockBackend', {
        get: function() {
            return null;
        },
        set: function() {
            // Prevent setting mock backend
            return null;
        },
        configurable: false
    });
    
    // Also prevent MockBackend class from being used
    window.MockBackend = null;
    
    console.log('Mock backend disabled - using Flask API at http://127.0.0.1:5000');
})();
