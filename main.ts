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
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    for (let i = -5; i <= 5; i++) {
        const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, 12), roadMat);
        roadX.rotation.x = -Math.PI / 2;
        roadX.position.y = 0.01;
        roadX.position.z = i * 100;
        scene.add(roadX);

        // Dashed lines
        const lineGeo = new THREE.PlaneGeometry(2, 0.5);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        for (let j = -CITY_SIZE / 2; j < CITY_SIZE / 2; j += 10) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(j, 0.02, i * 100);
            scene.add(line);
        }

        const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(12, CITY_SIZE), roadMat);
        roadZ.rotation.x = -Math.PI / 2;
        roadZ.position.y = 0.01;
        roadZ.position.x = i * 100;
        scene.add(roadZ);
    }

    for (let i = 0; i < 250; i++) {
        const h = 20 + Math.random() * 60;
        const w = 15 + Math.random() * 10;
        const boxGeo = new THREE.BoxGeometry(w, h, w);
        const buildingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.2, 0.4) });
        const building = new THREE.Mesh(boxGeo, buildingMat);
        
        let x = (Math.random() - 0.5) * CITY_SIZE * 0.9;
        let z = (Math.random() - 0.5) * CITY_SIZE * 0.9;
        if (Math.abs(x % 100) < 20) x += 30;
        if (Math.abs(z % 100) < 20) z += 30;

        building.position.set(x, h / 2, z);
        scene.add(building);

        // Simple windows
        const windowGeo = new THREE.PlaneGeometry(w * 0.8, h * 0.8);
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.3 });
        for (let side = 0; side < 4; side++) {
            const win = new THREE.Mesh(windowGeo, windowMat);
            if (side === 0) win.position.set(0, 0, w / 2 + 0.1);
            if (side === 1) { win.position.set(0, 0, -w / 2 - 0.1); win.rotation.y = Math.PI; }
            if (side === 2) { win.position.set(w / 2 + 0.1, 0, 0); win.rotation.y = Math.PI / 2; }
            if (side === 3) { win.position.set(-w / 2 - 0.1, 0, 0); win.rotation.y = -Math.PI / 2; }
            building.add(win);
        }
    }
}
createCity();

// --- Car Factory ---
function createCar(color: number, isPolice = false) {
    const group = new THREE.Group();
    
    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.5), new THREE.MeshStandardMaterial({ color }));
    body.position.y = 0.6;
    group.add(body);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2), new THREE.MeshStandardMaterial({ color: color }));
    cabin.position.set(0, 1.2, -0.2);
    group.add(cabin);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), winMat);
    windshield.position.set(0, 1.2, 0.81);
    group.add(windshield);

    if (isPolice) {
        const siren = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        siren.position.y = 1.6;
        group.add(siren);
        
        const sirenLight = new THREE.PointLight(0xff0000, 2, 15);
        sirenLight.position.y = 1.7;
        group.add(sirenLight);
    }

    // Headlights
    const lightGeo = new THREE.CircleGeometry(0.3, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const h1 = new THREE.Mesh(lightGeo, lightMat);
    h1.position.set(0.7, 0.6, 2.26);
    group.add(h1);
    const h2 = new THREE.Mesh(lightGeo, lightMat);
    h2.position.set(-0.7, 0.6, 2.26);
    group.add(h2);

    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    [[ -1.1, 0.5, 1.4 ], [ 1.1, 0.5, 1.4 ], [ -1.1, 0.5, -1.4 ], [ 1.1, 0.5, -1.4 ]].forEach(pos => {
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
