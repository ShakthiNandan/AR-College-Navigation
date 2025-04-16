let scenes = {};
let currentLocation = null;
let destination = null;
let arScene = null;
let arCamera = null;
let arRenderer = null;
let arrows = [];
const MAX_ARROW_DISTANCE = 50; // meters

// Load scenes data
async function loadScenes() {
    try {
        const response = await fetch('scenes.json');
        scenes = await response.json();
        populateLocationSelects();
    } catch (error) {
        console.error('Error loading scenes:', error);
    }
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
    const arView = document.getElementById('ar-view');
    arView.style.display = 'block';
    
    // Create scene
    arScene = new THREE.Scene();
    
    // Create camera
    arCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create renderer
    arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    arRenderer.xr.enabled = true;
    arView.appendChild(arRenderer.domElement);
    
    // Add lights
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    arScene.add(light);
    
    // Start AR session
    try {
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
        });
        
        arRenderer.xr.setReferenceSpaceType('local');
        await arRenderer.xr.setSession(session);
        
        session.addEventListener('end', () => {
            arView.style.display = 'none';
            document.getElementById('ar-button').style.display = 'block';
        });
        
        animate();
    } catch (error) {
        console.error('Error starting AR session:', error);
    }
}

// Create navigation arrow
function createArrow() {
    const arrowGeometry = new THREE.ConeGeometry(0.5, 2, 32);
    const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    return arrow;
}

// Update arrow positions based on user location
function updateArrows() {
    if (!currentLocation || !destination) return;
    
    const userPosition = new THREE.Vector3();
    arCamera.getWorldPosition(userPosition);
    
    arrows.forEach(arrow => {
        const distance = arrow.position.distanceTo(userPosition);
        arrow.visible = distance <= MAX_ARROW_DISTANCE;
        
        if (arrow.visible) {
            // Point arrow towards destination
            const direction = new THREE.Vector3()
                .subVectors(arrow.position, userPosition)
                .normalize();
            
            arrow.lookAt(userPosition);
            arrow.rotateX(Math.PI / 2);
        }
    });
}

// Animation loop
function animate() {
    arRenderer.setAnimationLoop(() => {
        updateArrows();
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
    
    // Convert lat/lng to 3D coordinates (simplified)
    const startPos = new THREE.Vector3(startLat, 0, startLng);
    const endPos = new THREE.Vector3(endLat, 0, endLng);
    
    return { start: startPos, end: endPos };
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

document.getElementById('ar-button').addEventListener('click', initAR);

// Handle window resize
window.addEventListener('resize', () => {
    if (arCamera && arRenderer) {
        arCamera.aspect = window.innerWidth / window.innerHeight;
        arCamera.updateProjectionMatrix();
        arRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Initialize the application
loadScenes(); 