import * as THREE from 'three';

// --- Game Constants ---
const CITY_SIZE = 1000;
const CAR_ACCEL = 0.5;
const CAR_FRICTION = 0.98;
const CAR_STEER = 0.05;

// --- State ---
const state = {
    keys: {} as Record<string, boolean>,
    carVelocity: new THREE.Vector3(),
    carRotation: 0,
    wantedLevel: 0,
};

// --- Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container')?.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

// --- World: Ground ---
const groundGeo = new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- World: Simple City (Blocks) ---
function createCity() {
    const boxGeo = new THREE.BoxGeometry(20, 50, 20);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    
    for (let i = 0; i < 100; i++) {
        const building = new THREE.Mesh(boxGeo, boxMat);
        building.position.x = (Math.random() - 0.5) * CITY_SIZE * 0.8;
        building.position.z = (Math.random() - 0.5) * CITY_SIZE * 0.8;
        building.position.y = 25;
        scene.add(building);
    }
}
createCity();

// --- Player Car ---
const carGroup = new THREE.Group();
const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.5;
carGroup.add(body);

// Wheels
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
const wheelPositions = [
    [-1.1, 0.4, 1.5], [1.1, 0.4, 1.5],
    [-1.1, 0.4, -1.5], [1.1, 0.4, -1.5]
];
wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(pos[0], pos[1], pos[2]);
    carGroup.add(wheel);
});

scene.add(carGroup);
camera.position.set(0, 10, 20);

// --- Controls ---
window.addEventListener('keydown', (e) => state.keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => state.keys[e.key.toLowerCase()] = false);

// --- UI Updates ---
const wantedEl = document.getElementById('wanted-level');
const speedEl = document.getElementById('speed');

// --- Mini-map ---
const miniMapCanvas = document.getElementById('mini-map-canvas') as HTMLCanvasElement;
const miniMapCtx = miniMapCanvas.getContext('2d');
miniMapCanvas.width = 150;
miniMapCanvas.height = 150;

function updateMiniMap() {
    if (!miniMapCtx) return;
    miniMapCtx.clearRect(0, 0, 150, 150);
    miniMapCtx.fillStyle = '#333';
    miniMapCtx.fillRect(0, 0, 150, 150);
    
    // Player on minimap
    const px = (carGroup.position.x / CITY_SIZE + 0.5) * 150;
    const pz = (carGroup.position.z / CITY_SIZE + 0.5) * 150;
    miniMapCtx.fillStyle = 'red';
    miniMapCtx.beginPath();
    miniMapCtx.arc(px, pz, 3, 0, Math.PI * 2);
    miniMapCtx.fill();
}

// --- Game Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Driving Logic
    if (state.keys['w']) {
        state.carVelocity.z -= Math.cos(state.carRotation) * CAR_ACCEL;
        state.carVelocity.x -= Math.sin(state.carRotation) * CAR_ACCEL;
    }
    if (state.keys['s']) {
        state.carVelocity.z += Math.cos(state.carRotation) * CAR_ACCEL;
        state.carVelocity.x += Math.sin(state.carRotation) * CAR_ACCEL;
    }
    
    const speed = Math.sqrt(state.carVelocity.x ** 2 + state.carVelocity.z ** 2);
    if (speed > 0.1) {
        if (state.keys['a']) state.carRotation += CAR_STEER * (speed / 10);
        if (state.keys['d']) state.carRotation -= CAR_STEER * (speed / 10);
    }

    state.carVelocity.multiplyScalar(CAR_FRICTION);
    carGroup.position.add(state.carVelocity);
    carGroup.rotation.y = state.carRotation;

    // Camera follow
    const camOffset = new THREE.Vector3(0, 5, 15).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.carRotation);
    camera.position.lerp(carGroup.position.clone().add(camOffset), 0.1);
    camera.lookAt(carGroup.position);

    // UI
    if (speedEl) speedEl.innerText = `Speed: ${Math.round(speed * 10)} km/h`;
    
    updateMiniMap();
    renderer.render(scene, camera);
}

animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
