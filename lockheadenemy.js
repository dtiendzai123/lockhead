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
const enemy = {
  id: 1,
  health: 100,
  velocity: { x: 0.02, y: 0.0, z: 0.01 },

  // === Bone head tĩnh (static, không theo animation) ===
  head: {
    position: { x: -0.0456970781, y: -0.004478302, z: -0.0200432576 },
    rotation: { x: 0.0258174837, y: -0.08611039, z: -0.1402113, w: 0.9860321 },
    scale: { x: 0.99999994, y: 1.00000012, z: 1.0 }
  },

  // === Xoay toàn nhân vật (gốc) ===
  rotation: { x: 0, y: 0, z: 0, w: 1 }, // bạn có thể thay đổi nếu cần

  // === Scale nhân vật gốc ===
  scale: { x: 1, y: 1, z: 1 },

  // === Ma trận bindpose (matrix root) ===
  bindpose: {
    e00: -1.34559613e-13, e01: 8.881784e-14, e02: -1.0,        e03: 0.487912,
    e10: -2.84512817e-06, e11: -1.0,         e12: 8.881784e-14, e13: -2.842171e-14,
    e20: -1.0,            e21: 2.84512817e-06, e22: -1.72951931e-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  },

  // === Bone động theo animation (nếu có) ===
  animBone: {
    head: {
      position: { x: -0.045, y: -0.004, z: -0.020 }, // có thể thay đổi theo frame
      rotation: { x: 0.02, y: -0.08, z: -0.14, w: 0.98 },
      scale: { x: 1, y: 1, z: 1 },
      bindpose: {
        e00: -1.34559613e-13, e01: 8.881784e-14, e02: -1.0,        e03: 0.487912,
        e10: -2.84512817e-06, e11: -1.0,         e12: 8.881784e-14, e13: -2.842171e-14,
        e20: -1.0,            e21: 2.84512817e-06, e22: -1.72951931e-13, e23: 0.0,
        e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
      }
    }
  }
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
// === VECTOR & KALMAN SUPPORT ===
class Vector3 {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  static from(obj) {
    return new Vector3(obj.x, obj.y, obj.z);
  }
  static distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

class KalmanFilter {
  constructor(R = 0.01, Q = 0.0001) {
    this.R = R;
    this.Q = Q;
    this.A = 1;
    this.C = 1;
    this.cov = NaN;
    this.x = NaN;
  }

  filter(z) {
    if (isNaN(this.x)) {
      this.x = z;
      this.cov = 1;
    } else {
      const predX = this.A * this.x;
      const predCov = this.A * this.cov * this.A + this.R;
      const K = predCov * this.C / (this.C * predCov * this.C + this.Q);
      this.x = predX + K * (z - this.C * predX);
      this.cov = (1 - K * this.C) * predCov;
    }
    return this.x;
  }

  update(vec) {
    return new Vector3(
      this.filter(vec.x),
      this.filter(vec.y),
      this.filter(vec.z)
    );
  }
}
class CrosshairTracker {
  constructor() {
    this.kalmanX = new KalmanFilter(0.01, 0.0001);
    this.kalmanY = new KalmanFilter(0.01, 0.0001);
    this.kalmanZ = new KalmanFilter(0.01, 0.0001);
  }

  filter(vec) {
    return new Vector3(
      this.kalmanX.filter(vec.x),
      this.kalmanY.filter(vec.y),
      this.kalmanZ.filter(vec.z)
    );
  }
}

const tracker = new CrosshairTracker();
const kalman = new KalmanFilter();
// === LOCK TO BONE HEAD ===
// === GET BEST HEAD POSITION SAFELY ===
function getBestHeadPosition(enemy) {
  const bone = enemy.animBone?.head || enemy.head;

  if (
    !bone ||
    !bone.position || !bone.rotation || !bone.scale || !bone.bindpose ||
    typeof bone.rotation.x !== 'number'
  ) {
    console.log("⚠️ Invalid or incomplete bone data:", bone);
    return null;
  }

  return transformBoneHead(
    bone.position,
    bone.rotation,
    bone.scale,
    bone.bindpose,
    enemy.velocity
  );
}

// === LOCK TO HEAD USING FILTER + SAFETY ===
function lockCrosshairToBoneHead(camera, enemy, deltaTime = 0.016) {
  const rawHead = getBestHeadPosition(enemy);
  if (!rawHead) return; // Skip if data is invalid

  const filteredHead = tracker.filter(Vector3.from(rawHead));

  const dx = filteredHead.x - camera.position.x;
  const dy = filteredHead.y - camera.position.y;
  const dz = filteredHead.z - camera.position.z;

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
