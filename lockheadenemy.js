// === ENHANCED CONFIG ===
const CONFIG = {
  sensitivity: { yaw: 5.0, pitch: 5.0 },
  targeting: {
    headRadius: 1.0,
    snapStrength: 10.0,
    smoothFactor: 0.75,
    maxPullDistance: 9999,
    predictionFactor: 0.001
  },
  performance: {
    cacheMatrix: true,
    useFastMath: true
  }
};

const GamePackages = {
  GamePackage1: "com.dts.freefireth",
  GamePackage2: "com.dts.freefiremax"
};

// === CACHED MATRIX SYSTEM ===
const matrixCache = new Map();

// === QUATERNION TO MATRIX CONVERSION ===
function quaternionToMatrix(q) {
  const cacheKey = `${q.x.toFixed(6)}_${q.y.toFixed(6)}_${q.z.toFixed(6)}_${q.w.toFixed(6)}`;
  if (CONFIG.performance.cacheMatrix && matrixCache.has(cacheKey)) {
    return matrixCache.get(cacheKey);
  }
  const { x, y, z, w } = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  const matrix = {
    e00: 1 - (yy + zz), e01: xy - wz, e02: xz + wy, e03: 0,
    e10: xy + wz, e11: 1 - (xx + zz), e12: yz - wx, e13: 0,
    e20: xz - wy, e21: yz + wx, e22: 1 - (xx + yy), e23: 0
  };
  if (CONFIG.performance.cacheMatrix) {
    matrixCache.set(cacheKey, matrix);
  }
  return matrix;
}

// === TRANSFORM BONE HEAD ===
function transformBoneHead(pos, rotation, scale, bindpose, velocity = null) {
  const rotM = quaternionToMatrix(rotation);
  let x = rotM.e00 * pos.x + rotM.e01 * pos.y + rotM.e02 * pos.z;
  let y = rotM.e10 * pos.x + rotM.e11 * pos.y + rotM.e12 * pos.z;
  let z = rotM.e20 * pos.x + rotM.e21 * pos.y + rotM.e22 * pos.z;
  x *= scale.x; y *= scale.y; z *= scale.z;

  const worldPos = {
    x: bindpose.e00 * x + bindpose.e01 * y + bindpose.e02 * z + bindpose.e03,
    y: bindpose.e10 * x + bindpose.e11 * y + bindpose.e12 * z + bindpose.e13,
    z: bindpose.e20 * x + bindpose.e21 * y + bindpose.e22 * z + bindpose.e23
  };

  if (velocity) {
    const t = CONFIG.targeting.predictionFactor;
    worldPos.x += velocity.x * t;
    worldPos.y += velocity.y * t;
    worldPos.z += velocity.z * t;
  }

  return worldPos;
}

// === LOCK TO BONE HEAD ===
function lockCrosshairToBoneHead(camera, enemy, deltaTime = 0.016) {
  const target = transformBoneHead(enemy.head, enemy.rotation, enemy.scale, enemy.bindpose, enemy.velocity);
  const dx = target.x - camera.position.x;
  const dy = target.y - camera.position.y;
  const dz = target.z - camera.position.z;

  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance > CONFIG.targeting.maxPullDistance) return;

  const dir = { x: dx / distance, y: dy / distance, z: dz / distance };
  const pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));
  const yaw = Math.atan2(dir.x, dir.z);

  const factor = Math.max(0.3, Math.min(1.0, 10 / distance));
  const smooth = CONFIG.targeting.smoothFactor * deltaTime * 60;

  const adjustedYaw = yaw * factor * smooth;
  const adjustedPitch = pitch * factor * smooth;

  sendInputToMouse({
    deltaX: adjustedYaw * CONFIG.sensitivity.yaw,
    deltaY: adjustedPitch * CONFIG.sensitivity.pitch
  });

  console.log(`🎯 Lock → Dist=${distance.toFixed(2)} | Yaw=${yaw.toFixed(3)} | Pitch=${pitch.toFixed(3)}`);
}

// === MOCK INPUT HANDLER ===
function sendInputToMouse({ deltaX, deltaY }) {
  console.log(`🖱️ Move → ΔX=${deltaX.toFixed(4)} | ΔY=${deltaY.toFixed(4)}`);
}

// === MULTI-ENEMY SIMULATION ===
function simulateEnhancedHeadLockingMultipleEnemies() {
  const camera = { position: { x: 0, y: 1.7, z: 0 } };
  const enemies = [enemySample1, enemySample2]; // Reuse

  for (const enemy of enemies) {
    lockCrosshairToBoneHead(camera, enemy);
  }
}

// === ENEMY DATA SAMPLE ===
const enemySample1 = {
  head: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
  rotation: { x: 0.0258174837, y: -0.08611039, z: -0.1402113, w: 0.9860321 },
  scale: { x: 1.0, y: 1.0, z: 1.0 },
  bindpose: {
    e00: -1.3456e-13, e01: 8.88e-14, e02: -1.0, e03: 0.4879,
    e10: -2.84e-6, e11: -1.0, e12: 8.88e-14, e13: -2.84e-14,
    e20: -1.0, e21: 2.84e-6, e22: -1.73e-13, e23: 0.0
  },
  velocity: { x: 0.05, y: 0.0, z: 0.02 }
};

const enemySample2 = JSON.parse(JSON.stringify(enemySample1)); // Clone

// === INFINITE LOOP (60FPS) ===
function runInfiniteHeadLock() {
  setInterval(simulateEnhancedHeadLockingMultipleEnemies, 16);
}

// === START SYSTEM ===
console.log("🎮 ENHANCED MULTI-ENEMY AIMING STARTED");
runInfiniteHeadLock();
