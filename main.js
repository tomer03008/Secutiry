import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ============================================================
   Smart Security Systems — clean / light cinematic hero
   - Loads cctv_camera.glb (the real model, no procedural)
   - Desktop: cameras at sides framing centered copy
   - Mobile: dedicated visual band — large cameras, no text overlay
   ============================================================ */

function isMobileView() {
  return window.innerWidth < 768;
}

function getModelSize() {
  return isMobileView() ? 5.6 : 6.0;
}

const CONFIG = {
  glbPath: "./cctv_camera.glb",
  cameraCount: 2,
  targetDamp: 0.14,
  rotDamp: 0.15,
  parallax: 0.2,
  aimRangeX: 3.0,
  aimRangeY: 2.0,
  aimDist: 5.0,
  fogColor: 0xece6da,
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileView() ? 1.5 : 2));
{
  const { w, h } = heroSize();
  renderer.setSize(w, h, false);
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

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Camera ----------
const _initSize = heroSize();
const camera = new THREE.PerspectiveCamera(
  isMobileView() ? 46 : 40,
  _initSize.w / _initSize.h,
  0.1,
  100
);
camera.position.set(0, 0, isMobileView() ? 7.2 : 11.5);

const cameraRig = new THREE.Group();
cameraRig.add(camera);
scene.add(cameraRig);

// ---------- Lighting ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-5, 7, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(
  isMobileView() ? 1024 : 2048,
  isMobileView() ? 1024 : 2048
);
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
const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const targetPoint = new THREE.Vector3(0, 0, 0);
const dampedTarget = new THREE.Vector3(0, 0, 0);

// ---------- Camera instances ----------
const cams = [];
const dummy = new THREE.Object3D();

const LAYOUT_DESKTOP = [
  { pos: [5.0, -1.0, 0.2], scale: 1.0 },
  { pos: [-5.1, 1.2, -1.2], scale: 0.9 },
];
/* Mobile band: two large cameras flanking center, fully in frame */
const LAYOUT_MOBILE = [
  { pos: [-2.35, -0.15, 0.45], scale: 1.08 },
  { pos: [2.35, -0.15, 0.45], scale: 1.0 },
];

function getLayout() {
  return isMobileView() ? LAYOUT_MOBILE : LAYOUT_DESKTOP;
}

function getSceneTuning() {
  const mobile = isMobileView();
  return {
    fov: mobile ? 46 : 40,
    camZ: mobile ? 7.2 : 11.5,
    fogNear: mobile ? 11 : 10,
    fogFar: mobile ? 22 : 24,
    parallax: mobile ? 0.12 : 0.2,
    aimRangeX: mobile ? 2.2 : 3.0,
    aimRangeY: mobile ? 1.4 : 2.0,
    floatAmp: mobile ? 0.05 : 0.08,
  };
}

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
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const norm = getModelSize() / maxDim;

  root.position.sub(center);
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

  const orient = new THREE.Group();
  orient.rotation.y = -Math.PI / 2;
  orient.add(scaler);

  const wrapper = new THREE.Group();
  wrapper.add(orient);
  return wrapper;
}

function buildCameras(template) {
  const layout = getLayout();
  const tuning = getSceneTuning();
  for (let i = 0; i < Math.min(CONFIG.cameraCount, layout.length); i++) {
    const conf = layout[i];
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
      layoutScale: conf.scale,
      neutral,
      aim: neutral.clone(),
      phase: Math.random() * Math.PI * 2,
      floatAmp: tuning.floatAmp + Math.random() * 0.03,
    });
    scene.add(obj);
  }
  applyCameraLayout();
  requestAnimationFrame(() => loaderEl && loaderEl.classList.add("is-hidden"));
}

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
function setPointerFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

window.addEventListener("pointermove", setPointerFromEvent, { passive: true });
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches[0]) setPointerFromEvent(e.touches[0]);
  },
  { passive: true }
);

function applyCameraLayout() {
  const layout = getLayout();
  const tuning = getSceneTuning();

  camera.fov = tuning.fov;
  camera.position.z = tuning.camZ;
  scene.fog.near = tuning.fogNear;
  scene.fog.far = tuning.fogFar;

  cams.forEach((c, i) => {
    const conf = layout[i];
    if (!conf) {
      c.object.visible = false;
      return;
    }
    c.object.visible = true;
    c.basePos.set(...conf.pos);
    c.layoutScale = conf.scale;
    c.object.position.set(...conf.pos);
    c.object.scale.setScalar(conf.scale);
    c.neutral.set(conf.pos[0] * 0.12, conf.pos[1] * 0.12, CONFIG.aimDist);
    c.floatAmp = tuning.floatAmp + (i * 0.01);
  });

  const { w, h } = heroSize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function onResize() {
  const mobile = isMobileView();
  const { w, h } = heroSize();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(w, h, false);
  if (cams.length) applyCameraLayout();
}
window.addEventListener("resize", onResize);
window.addEventListener("load", onResize);
requestAnimationFrame(onResize);

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
const _idlePointer = new THREE.Vector2();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!heroVisible || document.hidden) return;

  const t = clock.elapsedTime;
  const tuning = getSceneTuning();
  const kTarget = 1 - Math.pow(1 - CONFIG.targetDamp, dt * 60);
  const kRot = 1 - Math.pow(1 - CONFIG.rotDamp, dt * 60);

  // Gentle idle sweep on mobile when the user isn't dragging
  if (isMobileView()) {
    _idlePointer.set(Math.sin(t * 0.35) * 0.42, Math.cos(t * 0.28) * 0.18);
    if (Math.abs(pointer.x) < 0.05 && Math.abs(pointer.y) < 0.05) {
      pointer.copy(_idlePointer);
    }
  }

  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(targetPlane, targetPoint);
  dampedTarget.lerp(targetPoint, kTarget);

  for (let i = 0; i < cams.length; i++) {
    const c = cams[i];
    if (!c.object.visible) continue;

    const fy = Math.sin(t * 0.7 + c.phase) * c.floatAmp;
    const fx = Math.cos(t * 0.45 + c.phase) * c.floatAmp * 0.5;
    c.object.position.set(c.basePos.x + fx, c.basePos.y + fy, c.basePos.z);

    _aim.set(
      c.neutral.x +
        THREE.MathUtils.clamp(
          dampedTarget.x - c.neutral.x,
          -tuning.aimRangeX,
          tuning.aimRangeX
        ),
      c.neutral.y +
        THREE.MathUtils.clamp(
          dampedTarget.y - c.neutral.y,
          -tuning.aimRangeY,
          tuning.aimRangeY
        ),
      c.neutral.z
    );
    c.aim.lerp(_aim, kRot);

    dummy.position.copy(c.object.position);
    dummy.lookAt(c.aim);
    c.object.quaternion.slerp(dummy.quaternion, kRot);
  }

  const rigX = pointer.x * tuning.parallax;
  const rigY = pointer.y * tuning.parallax * 0.5;
  cameraRig.position.x += (rigX - cameraRig.position.x) * kTarget;
  cameraRig.position.y += (rigY - cameraRig.position.y) * kTarget;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

requestAnimationFrame(tick);
