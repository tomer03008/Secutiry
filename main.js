import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ============================================================
   Smart Security Systems — clean / light cinematic hero
   - Loads cctv_camera.glb (the real model, no procedural)
   - Cameras arranged neatly in a column on the right side
   - Bright studio environment (RoomEnvironment) on a white bg
   - Mouse-driven raycast target, damped + clamped look-at
   - Subtle idle breathing + parallax, 60fps loop
   ============================================================ */

const CONFIG = {
  glbPath: "./cctv_camera.glb",
  modelTargetSize: 6.0,   // big hero cameras
  cameraCount: 2,
  targetDamp: 0.14,       // how fast the shared aim chases the mouse
  rotDamp: 0.15,          // how fast each camera turns toward its aim (smooth)
  parallax: 0.2,          // rig sway strength
  aimRangeX: 3.0,         // max horizontal aim offset (limits rotation, smoothly)
  aimRangeY: 2.0,         // max vertical aim offset
  aimDist: 5.0,           // aim plane distance in front (keeps cams facing viewer)
  fogColor: 0xece6da,     // warm, matches the site paper color
};

// ---------- Renderer ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
const hero = document.querySelector(".hero");
function heroSize() {
  const w = canvas.clientWidth || (hero && hero.clientWidth) || window.innerWidth;
  const h = canvas.clientHeight || (hero && hero.clientHeight) || window.innerHeight;
  return { w, h };
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
{
  const { w, h } = heroSize();
  renderer.setSize(w, h, false); // keep CSS size (canvas fills hero)
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scene + fog ----------
const scene = new THREE.Scene();
scene.background = makeGradientBackground();
scene.fog = new THREE.Fog(CONFIG.fogColor, 10, 24);

// Studio reflections so the metal/glass reads as premium product
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Camera ----------
const _initSize = heroSize();
const camera = new THREE.PerspectiveCamera(
  40,
  _initSize.w / _initSize.h,
  0.1,
  100
);
camera.position.set(0, 0, 11.5);

const cameraRig = new THREE.Group();
cameraRig.add(camera);
scene.add(cameraRig);

// ---------- Lighting (soft studio for a white scene) ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-5, 7, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 40;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.radius = 6;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xdfe8f5, 0.7);
fillLight.position.set(6, 1, 4);
scene.add(fillLight);

// ---------- Raycast target plane ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z = 0
const targetPoint = new THREE.Vector3(0, 0, 0);
const dampedTarget = new THREE.Vector3(0, 0, 0);

// ---------- Camera instances ----------
const cams = [];
const dummy = new THREE.Object3D();

// Two big cameras pushed to the left/right edges, well clear of the
// centered text. Different heights + depth for a framed, premium feel.
const LAYOUT = [
  { pos: [5.0, -1.0, 0.2], scale: 1.0 },    // hero, lower-right, forward
  { pos: [-5.1, 1.2, -1.2], scale: 0.9 },   // secondary, upper-left, a touch back
];

const loader = new GLTFLoader();
const loaderEl = document.getElementById("loader");

loader.load(
  CONFIG.glbPath,
  (gltf) => buildCameras(prepModel(gltf.scene)),
  (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      const bar = document.querySelector(".loader__bar span");
      if (bar) bar.style.width = pct + "%";
    }
  },
  (err) => {
    console.error("[hero] failed to load cctv_camera.glb", err);
    if (loaderEl) loaderEl.querySelector(".loader__bar")?.classList.add("is-error");
  }
);

function prepModel(root) {
  // Measure in world space (accounts for Sketchfab node transforms)
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const norm = CONFIG.modelTargetSize / maxDim;

  root.position.sub(center); // center geometry at origin
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) o.material.envMapIntensity = 1.1;
    }
  });

  const scaler = new THREE.Group();
  scaler.scale.setScalar(norm);
  scaler.add(root);

  // Lens points along +X in the model; rotate so it aligns to +Z,
  // which is the axis Object3D.lookAt() aims at the target.
  const orient = new THREE.Group();
  orient.rotation.y = -Math.PI / 2;
  orient.add(scaler);

  const wrapper = new THREE.Group();
  wrapper.add(orient);
  return wrapper;
}

function buildCameras(template) {
  for (let i = 0; i < Math.min(CONFIG.cameraCount, LAYOUT.length); i++) {
    const conf = LAYOUT[i];
    const obj = template.clone(true);
    obj.position.set(...conf.pos);
    obj.scale.multiplyScalar(conf.scale);

    const neutral = new THREE.Vector3(
      conf.pos[0] * 0.12,
      conf.pos[1] * 0.12,
      CONFIG.aimDist
    );
    cams.push({
      object: obj,
      basePos: new THREE.Vector3(...conf.pos),
      neutral,
      aim: neutral.clone(),     // smoothed per-camera look point
      phase: Math.random() * Math.PI * 2,
      floatAmp: 0.08 + Math.random() * 0.03,
    });
    scene.add(obj);
  }
  requestAnimationFrame(() => loaderEl && loaderEl.classList.add("is-hidden"));
}

// ---------- Background: soft white gradient ----------
function makeGradientBackground() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#faf7f0");
  grad.addColorStop(0.6, "#f4f1ea");
  grad.addColorStop(1, "#e8e1d3");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Pointer / resize ----------
window.addEventListener(
  "pointermove",
  (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  },
  { passive: true }
);

function onResize() {
  const { w, h } = heroSize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", onResize);

// Pause rendering work when the hero is scrolled out of view (perf / battery)
let heroVisible = true;
if (hero && "IntersectionObserver" in window) {
  new IntersectionObserver(
    (entries) => {
      heroVisible = entries[0].isIntersecting;
    },
    { threshold: 0 }
  ).observe(hero);
}

// ---------- Animation loop ----------
const clock = new THREE.Clock();
const _aim = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!heroVisible || document.hidden) return; // skip heavy work off-screen
  const t = clock.elapsedTime;
  // Frame-rate independent smoothing factors
  const kTarget = 1 - Math.pow(1 - CONFIG.targetDamp, dt * 60);
  const kRot = 1 - Math.pow(1 - CONFIG.rotDamp, dt * 60);

  // Pointer -> world target on z=0 plane
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(targetPlane, targetPoint);
  dampedTarget.lerp(targetPoint, kTarget);

  for (let i = 0; i < cams.length; i++) {
    const c = cams[i];

    // Subtle breathing / float
    const fy = Math.sin(t * 0.7 + c.phase) * c.floatAmp;
    const fx = Math.cos(t * 0.45 + c.phase) * c.floatAmp * 0.5;
    c.object.position.set(c.basePos.x + fx, c.basePos.y + fy, c.basePos.z);

    // Limit the look point around a neutral front point (smooth, no snapping).
    _aim.set(
      c.neutral.x +
        THREE.MathUtils.clamp(
          dampedTarget.x - c.neutral.x,
          -CONFIG.aimRangeX,
          CONFIG.aimRangeX
        ),
      c.neutral.y +
        THREE.MathUtils.clamp(
          dampedTarget.y - c.neutral.y,
          -CONFIG.aimRangeY,
          CONFIG.aimRangeY
        ),
      c.neutral.z
    );
    // Extra per-camera easing for a buttery turn
    c.aim.lerp(_aim, kRot);

    dummy.position.copy(c.object.position);
    dummy.lookAt(c.aim);
    c.object.quaternion.slerp(dummy.quaternion, kRot);
  }

  // Gentle parallax sway
  const rigX = pointer.x * CONFIG.parallax;
  const rigY = pointer.y * CONFIG.parallax * 0.5;
  cameraRig.position.x += (rigX - cameraRig.position.x) * kTarget;
  cameraRig.position.y += (rigY - cameraRig.position.y) * kTarget;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

requestAnimationFrame(tick);
