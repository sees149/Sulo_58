import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/PointerLockControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7cc9ff);
scene.fog = new THREE.Fog(0x7cc9ff, 35, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdaf5ff, 0x31422b, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(30, 50, 30);
scene.add(sun);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  hud.style.display = 'none';
});
controls.addEventListener('unlock', () => {
  hud.style.display = 'block';
});

const blockGeo = new THREE.BoxGeometry(1, 1, 1);
const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x48a44d }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x8a5a35 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8e8e8e }),
  wood: new THREE.MeshLambertMaterial({ color: 0x946230 }),
};

const blocks = new Map();

function keyFor(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, material = materials.grass) {
  const key = keyFor(x, y, z);
  if (blocks.has(key)) return;
  const block = new THREE.Mesh(blockGeo, material);
  block.position.set(x, y, z);
  block.castShadow = false;
  block.receiveShadow = true;
  block.userData.grid = { x, y, z };
  scene.add(block);
  blocks.set(key, block);
}

function removeBlock(x, y, z) {
  const key = keyFor(x, y, z);
  const block = blocks.get(key);
  if (!block) return;
  scene.remove(block);
  blocks.delete(key);
}

function generateMap() {
  for (let x = -22; x <= 22; x += 1) {
    for (let z = -22; z <= 22; z += 1) {
      addBlock(x, -1, z, materials.dirt);
      addBlock(x, 0, z, materials.grass);
      if (Math.random() > 0.93) addBlock(x, 1, z, materials.stone);
    }
  }

  for (let y = 1; y < 5; y += 1) {
    addBlock(4, y, 4, materials.wood);
  }

  addBlock(4, 5, 4, materials.grass);
  addBlock(5, 5, 4, materials.grass);
  addBlock(4, 5, 5, materials.grass);
}

generateMap();
controls.getObject().position.set(0, 3, 8);

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

let velocityY = 0;
let isOnGround = false;
const playerHeight = 1.7;
const raycaster = new THREE.Raycaster();
const downRay = new THREE.Raycaster();
const actionRay = new THREE.Raycaster();

function onKeyChange(event, pressed) {
  switch (event.code) {
    case 'KeyW':
      keys.forward = pressed;
      break;
    case 'KeyS':
      keys.backward = pressed;
      break;
    case 'KeyA':
      keys.left = pressed;
      break;
    case 'KeyD':
      keys.right = pressed;
      break;
    case 'ShiftLeft':
      keys.sprint = pressed;
      break;
    case 'Space':
      if (pressed && isOnGround) {
        velocityY = 7.5;
        isOnGround = false;
      }
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (e) => onKeyChange(e, true));
window.addEventListener('keyup', (e) => onKeyChange(e, false));

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  actionRay.set(camera.position, direction);
  const hits = actionRay.intersectObjects([...blocks.values()], false);
  if (!hits.length) return;

  const hit = hits[0];
  const { x, y, z } = hit.object.userData.grid;

  if (e.button === 0) {
    removeBlock(x, y, z);
  } else if (e.button === 2) {
    const normal = hit.face.normal;
    const nx = x + normal.x;
    const ny = y + normal.y;
    const nz = z + normal.z;
    if (ny > -2) addBlock(nx, ny, nz, materials.grass);
  }
});

function collideHorizontal(nextPos) {
  const dirs = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  for (const dir of dirs) {
    raycaster.set(nextPos, dir);
    const hits = raycaster.intersectObjects([...blocks.values()], false);
    if (hits.length && hits[0].distance < 0.45) return true;
  }

  return false;
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (controls.isLocked) {
    const speed = keys.sprint ? 8 : 5;
    const dir = new THREE.Vector3();

    if (keys.forward) dir.z -= 1;
    if (keys.backward) dir.z += 1;
    if (keys.left) dir.x -= 1;
    if (keys.right) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const move = new THREE.Vector3();
      move.copy(dir).multiplyScalar(speed * dt);
      controls.moveRight(move.x);
      controls.moveForward(move.z);

      const playerPos = controls.getObject().position.clone();
      playerPos.y -= playerHeight * 0.4;
      if (collideHorizontal(playerPos)) {
        controls.moveRight(-move.x);
        controls.moveForward(-move.z);
      }
    }

    velocityY -= 18 * dt;
    controls.getObject().position.y += velocityY * dt;

    const feetPos = controls.getObject().position.clone();
    feetPos.y -= playerHeight * 0.5;
    downRay.set(feetPos, new THREE.Vector3(0, -1, 0));
    const hits = downRay.intersectObjects([...blocks.values()], false);

    if (hits.length && hits[0].distance <= 0.12 && velocityY <= 0) {
      isOnGround = true;
      velocityY = 0;
      controls.getObject().position.y += 0.12 - hits[0].distance;
    } else {
      isOnGround = false;
    }

    if (controls.getObject().position.y < -10) {
      controls.getObject().position.set(0, 3, 8);
      velocityY = 0;
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
