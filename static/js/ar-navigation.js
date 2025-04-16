// DOM Elements
const startLocationSelect = document.getElementById('start-location');
const endLocationSelect = document.getElementById('end-location');
const startButton = document.getElementById('start-button');
const arButton = document.getElementById('ar-button');
const distanceInfo = document.getElementById('distance-info');
const compatibilityMessage = document.getElementById('compatibility-message');

// Location data from scenes.json
let scenes = {};

// Initialize the application
async function init() {
    try {
        // Fetch scenes data
        const response = await fetch('/scenes');
        scenes = await response.json();
        
        console.log('Loaded scenes:', scenes); // Debug log
        
        populateLocationSelects();
        checkDeviceCompatibility();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading scenes:', error);
        alert('Error loading location data. Please try again later.');
    }
}

// Populate location selectors
function populateLocationSelects() {
    // Clear existing options
    startLocationSelect.innerHTML = '';
    endLocationSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a location';
    defaultOption.style.color = '#333'; // Ensure text color is visible
    startLocationSelect.appendChild(defaultOption.cloneNode(true));
    endLocationSelect.appendChild(defaultOption);
    
    // Add locations from scenes
    Object.entries(scenes).forEach(([id, scene]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = scene.scene_name;
        option.style.color = '#333'; // Ensure text color is visible
        startLocationSelect.appendChild(option.cloneNode(true));
        endLocationSelect.appendChild(option);
    });
    
    // Debug log
    console.log('Populated dropdowns with options:', startLocationSelect.options.length);
}

// Check device compatibility for AR
function checkDeviceCompatibility() {
    const isCompatible = 'mediaDevices' in navigator && 
                        'getUserMedia' in navigator.mediaDevices &&
                        window.isSecureContext;
    
    if (!isCompatible) {
        compatibilityMessage.style.display = 'block';
        arButton.disabled = true;
    }
}

// Setup event listeners
function setupEventListeners() {
    startButton.addEventListener('click', startNavigation);
    arButton.addEventListener('click', startARView);
    
    // Update button states based on selection
    [startLocationSelect, endLocationSelect].forEach(select => {
        select.addEventListener('change', () => {
            startButton.disabled = !startLocationSelect.value || !endLocationSelect.value;
        });
    });
}

// Start navigation
function startNavigation() {
    const startLocationId = startLocationSelect.value;
    const endLocationId = endLocationSelect.value;
    
    if (!startLocationId || !endLocationId) {
        alert('Please select both start and end locations');
        return;
    }
    
    const startLocation = scenes[startLocationId];
    const endLocation = scenes[endLocationId];
    
    // Calculate distance using coordinates
    const distance = calculateDistance(startLocation, endLocation);
    displayDistanceInfo(distance);
    
    // Enable AR button
    arButton.disabled = false;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(start, end) {
    // Parse coordinates
    const [startLat, startLng] = start.coor.split(',').map(coord => parseFloat(coord.trim()));
    const [endLat, endLng] = end.coor.split(',').map(coord => parseFloat(coord.trim()));
    
    // Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = startLat * Math.PI/180;
    const φ2 = endLat * Math.PI/180;
    const Δφ = (endLat - startLat) * Math.PI/180;
    const Δλ = (endLng - startLng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Display distance information
function displayDistanceInfo(distance) {
    distanceInfo.textContent = `Distance: ${distance.toFixed(2)} meters`;
    distanceInfo.style.display = 'block';
}

// Start AR view
function startARView() {
    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            // Initialize AR scene
            initARScene(stream);
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please ensure camera permissions are granted.');
        });
}

// Initialize AR scene
function initARScene(stream) {
    const scene = document.querySelector('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('ar', '');
    
    // Add AR markers and navigation elements
    addARNavigationElements();
    
    // Show AR view
    document.querySelector('.ui-container').style.display = 'none';
    scene.style.display = 'block';
}

// Add AR navigation elements
function addARNavigationElements() {
    const scene = document.querySelector('a-scene');
    
    // Add camera
    const camera = document.createElement('a-entity');
    camera.setAttribute('camera', '');
    scene.appendChild(camera);
    
    // Get selected locations
    const startLocationId = startLocationSelect.value;
    const endLocationId = endLocationSelect.value;
    const startLocation = scenes[startLocationId];
    const endLocation = scenes[endLocationId];
    
    // Parse coordinates
    const [startLat, startLng] = startLocation.coor.split(',').map(coord => parseFloat(coord.trim()));
    const [endLat, endLng] = endLocation.coor.split(',').map(coord => parseFloat(coord.trim()));
    
    // Add start marker
    const startMarker = document.createElement('a-entity');
    startMarker.setAttribute('geometry', 'primitive: cylinder; radius: 0.5; height: 0.1');
    startMarker.setAttribute('material', 'color: #2ecc71');
    startMarker.setAttribute('gps-entity-place', `latitude: ${startLat}; longitude: ${startLng}`);
    scene.appendChild(startMarker);
    
    // Add end marker
    const endMarker = document.createElement('a-entity');
    endMarker.setAttribute('geometry', 'primitive: cylinder; radius: 0.5; height: 0.1');
    endMarker.setAttribute('material', 'color: #e74c3c');
    endMarker.setAttribute('gps-entity-place', `latitude: ${endLat}; longitude: ${endLng}`);
    scene.appendChild(endMarker);
    
    // Add navigation arrow
    const arrow = document.createElement('a-entity');
    arrow.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.5; radiusTop: 0; height: 2');
    arrow.setAttribute('material', 'color: #3498db');
    arrow.setAttribute('gps-entity-place', `latitude: ${(startLat + endLat) / 2}; longitude: ${(startLng + endLng) / 2}`);
    arrow.setAttribute('look-at', '[camera]');
    scene.appendChild(arrow);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init); 