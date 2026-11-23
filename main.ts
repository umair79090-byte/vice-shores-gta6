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
    policeCars: [] as THREE.Group[],
    policeVelocities: [] as THREE.Vector3[],
};

// --- Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);

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

// --- World: Simple City (Blocks & Roads) ---
function createCity() {
    // Roads (X and Z axis)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let i = -5; i <= 5; i++) {
        const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, 10), roadMat);
        roadX.rotation.x = -Math.PI / 2;
        roadX.position.y = 0.01;
        roadX.position.z = i * 100;
        scene.add(roadX);

        const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY_SIZE), roadMat);
        roadZ.rotation.x = -Math.PI / 2;
        roadZ.position.y = 0.01;
        roadZ.position.x = i * 100;
        scene.add(roadZ);
    }

    const boxGeo = new THREE.BoxGeometry(20, 50, 20);
    for (let i = 0; i < 200; i++) {
        const buildingMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const building = new THREE.Mesh(boxGeo, buildingMat);
        let x = (Math.random() - 0.5) * CITY_SIZE * 0.9;
        let z = (Math.random() - 0.5) * CITY_SIZE * 0.9;
        // Avoid roads
        if (Math.abs(x % 100) < 15) x += 20;
        if (Math.abs(z % 100) < 15) z += 20;

        building.position.set(x, 25, z);
        scene.add(building);
    }
}
createCity();

// --- Car Factory ---
function createCar(color: number, isPolice = false) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color }));
    body.position.y = 0.5;
    group.add(body);

    if (isPolice) {
        const siren = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        siren.position.y = 1.1;
        group.add(siren);
        
        const sirenLight = new THREE.PointLight(0xff0000, 1, 10);
        sirenLight.position.y = 1.2;
        group.add(sirenLight);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    [[ -1.1, 0.4, 1.5 ], [ 1.1, 0.4, 1.5 ], [ -1.1, 0.4, -1.5 ], [ 1.1, 0.4, -1.5 ]].forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        group.add(wheel);
    });
    return group;
}

const carGroup = createCar(0xff0000);
scene.add(carGroup);

function spawnPolice() {
    const p = createCar(0xffffff, true);
    p.position.set(carGroup.position.x + 50, 0, carGroup.position.z + 50);
    scene.add(p);
    state.policeCars.push(p);
    state.policeVelocities.push(new THREE.Vector3());
}

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
    miniMapCtx.fillStyle = 'rgba(0,0,0,0.7)';
    miniMapCtx.fillRect(0, 0, 150, 150);
    
    const worldToMap = (val: number) => (val / CITY_SIZE + 0.5) * 150;
    
    // Player
    miniMapCtx.fillStyle = 'red';
    miniMapCtx.beginPath();
    miniMapCtx.arc(worldToMap(carGroup.position.x), worldToMap(carGroup.position.z), 3, 0, Math.PI * 2);
    miniMapCtx.fill();

    // Police
    miniMapCtx.fillStyle = 'blue';
    state.policeCars.forEach(p => {
        miniMapCtx.beginPath();
        miniMapCtx.arc(worldToMap(p.position.x), worldToMap(p.position.z), 2, 0, Math.PI * 2);
        miniMapCtx.fill();
    });
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

    // Wanted Logic
    if (speed > 20 && Math.random() < 0.01 && state.wantedLevel < 5) {
        state.wantedLevel++;
        if (wantedEl) wantedEl.innerText = `WANTED: ${state.wantedLevel}`;
        spawnPolice();
    }

    // Police AI
    state.policeCars.forEach((p, i) => {
        const dir = carGroup.position.clone().sub(p.position).normalize();
        state.policeVelocities[i].add(dir.multiplyScalar(0.3));
        state.policeVelocities[i].multiplyScalar(0.96);
        p.position.add(state.policeVelocities[i]);
        p.lookAt(carGroup.position);
        
        // Flashing sirens
        const siren = p.children[1] as THREE.Mesh;
        if (siren) {
            (siren.material as THREE.MeshStandardMaterial).color.setHex(Date.now() % 500 < 250 ? 0xff0000 : 0x0000ff);
        }

        // Catch player
        if (p.position.distanceTo(carGroup.position) < 3) {
            state.wantedLevel = 0;
            if (wantedEl) wantedEl.innerText = `BUSTED!`;
            carGroup.position.set(0, 0, 0);
            state.carVelocity.set(0, 0, 0);
            setTimeout(() => {
                state.policeCars.forEach(pc => scene.remove(pc));
                state.policeCars = [];
                state.policeVelocities = [];
                if (wantedEl) wantedEl.innerText = `WANTED: 0`;
            }, 2000);
        }
    });

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
