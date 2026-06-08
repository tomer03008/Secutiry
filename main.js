/* Hero: Three.js scene — desktop only (mobile loads static hero image) */

initHero3D();

async function initHero3D() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

  const CONFIG = {
    glbPath: "./cctv_camera.glb",
    modelTargetSize: 6.0,
    cameraCount: 2,
    targetDamp: 0.14,
    rotDamp: 0.15,
    parallax: 0.2,
    aimRangeX: 3.0,
    aimRangeY: 2.0,
    aimDist: 5.0,
    fogColor: 0xebe9e4,
  };

  const LAYOUT = [
    { pos: [5.0, -1.0, 0.2], scale: 1.0 },
    { pos: [-5.1, 1.2, -1.2], scale: 0.9 },
  ];

  const canvas = document.getElementById("scene");
  const hero = document.querySelector(".hero");
  const loaderEl = document.getElementById("loader");

  function heroSize() {
    const w = canvas.clientWidth || (hero && hero.clientWidth) || window.innerWidth;
    const h = canvas.clientHeight || (hero && hero.clientHeight) || window.innerHeight;
    return { w, h };
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  {
    const { w, h } = heroSize();
    renderer.setSize(w, h, false);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = makeGradientBackground(THREE);
  scene.fog = new THREE.Fog(CONFIG.fogColor, 10, 24);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const initSize = heroSize();
  const camera = new THREE.PerspectiveCamera(40, initSize.w / initSize.h, 0.1, 100);
  camera.position.set(0, 0, 11.5);

  const cameraRig = new THREE.Group();
  cameraRig.add(camera);
  scene.add(cameraRig);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

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

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const targetPoint = new THREE.Vector3(0, 0, 0);
  const dampedTarget = new THREE.Vector3(0, 0, 0);

  const cams = [];
  const dummy = new THREE.Object3D();

  new GLTFLoader().load(
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
    const norm = CONFIG.modelTargetSize / maxDim;

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
        aim: neutral.clone(),
        phase: Math.random() * Math.PI * 2,
        floatAmp: 0.08 + Math.random() * 0.03,
      });
      scene.add(obj);
    }
    onResize();
    requestAnimationFrame(() => loaderEl && loaderEl.classList.add("is-hidden"));
  }

  function setPointerFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  window.addEventListener("pointermove", setPointerFromEvent, { passive: true });

  function onResize() {
    const { w, h } = heroSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
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

  const clock = new THREE.Clock();
  const _aim = new THREE.Vector3();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!heroVisible || document.hidden) return;

    const t = clock.elapsedTime;
    const kTarget = 1 - Math.pow(1 - CONFIG.targetDamp, dt * 60);
    const kRot = 1 - Math.pow(1 - CONFIG.rotDamp, dt * 60);

    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(targetPlane, targetPoint);
    dampedTarget.lerp(targetPoint, kTarget);

    for (let i = 0; i < cams.length; i++) {
      const c = cams[i];
      const fy = Math.sin(t * 0.7 + c.phase) * c.floatAmp;
      const fx = Math.cos(t * 0.45 + c.phase) * c.floatAmp * 0.5;
      c.object.position.set(c.basePos.x + fx, c.basePos.y + fy, c.basePos.z);

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
      c.aim.lerp(_aim, kRot);

      dummy.position.copy(c.object.position);
      dummy.lookAt(c.aim);
      c.object.quaternion.slerp(dummy.quaternion, kRot);
    }

    const rigX = pointer.x * CONFIG.parallax;
    const rigY = pointer.y * CONFIG.parallax * 0.5;
    cameraRig.position.x += (rigX - cameraRig.position.x) * kTarget;
    cameraRig.position.y += (rigY - cameraRig.position.y) * kTarget;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  requestAnimationFrame(tick);
}

function makeGradientBackground(THREE) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#f8f7f4");
  grad.addColorStop(0.6, "#f6f5f2");
  grad.addColorStop(1, "#ebe9e4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
