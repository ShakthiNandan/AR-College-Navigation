let scenes = {};
let currentLocation = null;
let destination = null;
let arEntities = null;
let arrows = [];
const MAX_ARROW_DISTANCE = 50; // meters

// Load scenes data
async function loadScenes() {
    try {
        console.log('Loading scenes data...');
        const response = await fetch('/scenes');
        scenes = await response.json();
        populateLocationSelects();
        console.log('Scenes loaded successfully');
    } catch (error) {
        console.error('Error loading scenes:', error);
        alert('Error loading location data. Please check your internet connection and try again.');
    }
}

// Convert GPS coordinates to local coordinates
function gpsToLocal(lat, lng) {
    // Convert GPS coordinates to meters using Mercator projection
    const EARTH_RADIUS = 6378137;
    const x = EARTH_RADIUS * lng * Math.PI / 180;
    const y = EARTH_RADIUS * Math.log(Math.tan((90 + lat) * Math.PI / 360));
    return { x, y };
}

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Populate location dropdowns
function populateLocationSelects() {
    const startSelect = document.getElementById('start');
    const endSelect = document.getElementById('end');
    
    Object.entries(scenes).forEach(([id, scene]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${scene.scene_name} (${scene.title})`;
        
        startSelect.appendChild(option.cloneNode(true));
        endSelect.appendChild(option);
    });
}

// Initialize AR
function initAR() {
    console.log('Initializing AR...');
    
    const arView = document.getElementById('ar-view');
    arView.style.display = 'block';
    document.getElementById('distance-info').style.display = 'block';
    
    // Get the AR entities container
    arEntities = document.getElementById('ar-entities');
    
    // Create navigation arrows
    createNavigationArrows();
    
    // Get user's location with error handling
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            updateUserPosition,
            (error) => {
                console.log('Geolocation error:', error);
                alert('Please enable location services to use AR navigation');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }
}

// Create navigation arrows along the path
function createNavigationArrows() {
    const path = calculatePath(currentLocation, destination);
    if (!path) return;
    
    // Clear existing arrows
    arEntities.innerHTML = '';
    arrows = [];
    
    // Create new arrows
    const numArrows = 5; // Number of arrows to show along the path
    for (let i = 0; i < numArrows; i++) {
        const t = i / (numArrows - 1);
        const pos = {
            x: path.start.x + (path.end.x - path.start.x) * t,
            y: 0,
            z: path.start.z + (path.end.z - path.start.z) * t
        };
        
        // Create arrow entity
        const arrow = document.createElement('a-entity');
        arrow.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        arrow.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.5; height: 2');
        arrow.setAttribute('material', 'color: #00ff00; opacity: 0.8');
        arrow.setAttribute('rotation', '90 0 0');
        arrow.setAttribute('gps-entity-place', `latitude: ${path.start.lat + (path.end.lat - path.start.lat) * t}; longitude: ${path.start.lng + (path.end.lng - path.start.lng) * t}`);
        
        arEntities.appendChild(arrow);
        arrows.push(arrow);
    }
    
    // Add destination marker
    const pin = document.createElement('a-entity');
    pin.setAttribute('position', `${path.end.x} ${path.end.y} ${path.end.z}`);
    pin.setAttribute('geometry', 'primitive: cylinder; radius: 0.5; height: 2');
    pin.setAttribute('material', 'color: #ff0000; opacity: 0.8');
    pin.setAttribute('gps-entity-place', `latitude: ${path.end.lat}; longitude: ${path.end.lng}`);
    
    arEntities.appendChild(pin);
    arrows.push(pin);
}

// Update user's position
function updateUserPosition(position) {
    if (!destination) return;
    
    const destScene = scenes[destination];
    const [destLat, destLng] = destScene.coor.split(',').map(Number);
    
    const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        destLat,
        destLng
    );
    
    document.getElementById('distance-value').textContent = Math.round(distance);
}

// Calculate path between locations
function calculatePath(startId, endId) {
    const start = scenes[startId];
    const end = scenes[endId];
    
    if (!start || !end) return null;
    
    const [startLat, startLng] = start.coor.split(',').map(Number);
    const [endLat, endLng] = end.coor.split(',').map(Number);
    
    const startLocal = gpsToLocal(startLat, startLng);
    const endLocal = gpsToLocal(endLat, endLng);
    
    return {
        start: {
            x: startLocal.x,
            y: 0,
            z: startLocal.y,
            lat: startLat,
            lng: startLng
        },
        end: {
            x: endLocal.x,
            y: 0,
            z: endLocal.y,
            lat: endLat,
            lng: endLng
        }
    };
}

// Event Listeners
document.getElementById('start-button').addEventListener('click', () => {
    const startId = document.getElementById('start').value;
    const endId = document.getElementById('end').value;
    
    if (startId && endId) {
        currentLocation = startId;
        destination = endId;
        document.getElementById('ar-button').style.display = 'block';
        console.log(`Navigation started from ${startId} to ${endId}`);
    }
});

document.getElementById('ar-button').addEventListener('click', () => {
    try {
        initAR();
    } catch (error) {
        console.error('AR initialization error:', error);
        alert('Error starting AR. Please make sure your device supports AR and you have granted camera and location permissions.');
    }
});

// Initialize the application
loadScenes().then(() => {
    console.log('Application initialized');
});