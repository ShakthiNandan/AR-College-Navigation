let scenes = {};
let currentLocation = null;
let destination = null;
let arScene = null;
let arCamera = null;
let arRenderer = null;
let arrows = [];
let arrowModel = null;
let pinModel = null;
const MAX_ARROW_DISTANCE = 50; // meters

// Check WebXR support
async function checkXRSupport() {
    if (!navigator.xr) {
        throw new Error('WebXR not supported in this browser');
    }

    // Check if AR is supported
    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!isSupported) {
        throw new Error('AR not supported on this device');
    }

    return true;
}

// Load 3D models
async function loadModels() {
    const objLoader = new THREE.OBJLoader();
    
    try {
        arrowModel = await new Promise((resolve, reject) => {
            objLoader.load('/models/arrow.obj', resolve, undefined, reject);
        });
        
        pinModel = await new Promise((resolve, reject) => {
            objLoader.load('/models/pin.obj', resolve, undefined, reject);
        });
    } catch (error) {
        console.error('Error loading models:', error);
        alert('Error loading 3D models. Please check your internet connection and try again.');
    }
}

// Load scenes data
async function loadScenes() {
    try {
        const response = await fetch('/scenes');
        scenes = await response.json();
        populateLocationSelects();
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

// Initialize WebXR
async function initAR() {
    try {
        // Check WebXR support first
        await checkXRSupport();

        const arView = document.getElementById('ar-view');
        arView.style.display = 'block';
        document.getElementById('distance-info').style.display = 'block';
        
        // Create scene
        arScene = new THREE.Scene();
        
        // Create camera
        arCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Create renderer
        arRenderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        arRenderer.setSize(window.innerWidth, window.innerHeight);
        arRenderer.xr.enabled = true;
        arView.appendChild(arRenderer.domElement);
        
        // Add lights
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        arScene.add(light);
        
        // Create navigation arrows
        await createNavigationArrows();
        
        // Request AR session with minimal required features
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local'],
            optionalFeatures: ['dom-overlay', 'hit-test'],
            domOverlay: { root: document.body }
        });
        
        arRenderer.xr.setReferenceSpaceType('local');
        await arRenderer.xr.setSession(session);
        
        session.addEventListener('end', () => {
            arView.style.display = 'none';
            document.getElementById('ar-button').style.display = 'block';
            document.getElementById('distance-info').style.display = 'none';
        });
        
        // Get user's location
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(updateUserPosition);
        }
        
        animate();
    } catch (error) {
        console.error('Error starting AR session:', error);
        let errorMessage = 'Unable to start AR session. ';
        
        if (error.name === 'NotSupportedError') {
            errorMessage += 'Your device or browser does not support AR features. ';
            errorMessage += 'Please try using a compatible device (like an Android phone with ARCore support) or a different browser.';
        } else if (error.message.includes('WebXR not supported')) {
            errorMessage += 'WebXR is not supported in your browser. Please try using Chrome on Android or Safari on iOS.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
        document.getElementById('ar-button').style.display = 'block';
    }
}

// Create navigation arrows along the path
async function createNavigationArrows() {
    const path = calculatePath(currentLocation, destination);
    if (!path) return;
    
    // Clear existing arrows
    arrows.forEach(arrow => arScene.remove(arrow));
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
        
        const arrow = arrowModel.clone();
        arrow.position.set(pos.x, pos.y, pos.z);
        arrow.scale.set(0.2, 0.2, 0.2);
        arScene.add(arrow);
        arrows.push(arrow);
    }
    
    // Add destination marker
    const pin = pinModel.clone();
    pin.position.set(path.end.x, 0, path.end.z);
    pin.scale.set(0.3, 0.3, 0.3);
    arScene.add(pin);
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
    
    updateArrowsOrientation(position.coords.latitude, position.coords.longitude);
}

// Update arrow orientations based on user position
function updateArrowsOrientation(userLat, userLng) {
    const userLocal = gpsToLocal(userLat, userLng);
    const userPosition = new THREE.Vector3(userLocal.x, 0, userLocal.y);
    
    arrows.forEach(arrow => {
        if (arrow === pinModel) return; // Skip the destination pin
        
        const distance = arrow.position.distanceTo(userPosition);
        arrow.visible = distance <= MAX_ARROW_DISTANCE;
        
        if (arrow.visible) {
            arrow.lookAt(userPosition);
            arrow.rotateX(Math.PI / 2);
        }
    });
}

// Animation loop
function animate() {
    arRenderer.setAnimationLoop(() => {
        arRenderer.render(arScene, arCamera);
    });
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
        start: new THREE.Vector3(startLocal.x, 0, startLocal.y),
        end: new THREE.Vector3(endLocal.x, 0, endLocal.y)
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
    }
});

document.getElementById('ar-button').addEventListener('click', async () => {
    try {
        await checkXRSupport();
        initAR();
    } catch (error) {
        console.error('AR support check failed:', error);
        alert('AR is not supported on your device. Please use a compatible device like an Android phone with ARCore support.');
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (arCamera && arRenderer) {
        arCamera.aspect = window.innerWidth / window.innerHeight;
        arCamera.updateProjectionMatrix();
        arRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Initialize the application
Promise.all([loadModels(), loadScenes()]).then(() => {
    console.log('Application initialized');
});