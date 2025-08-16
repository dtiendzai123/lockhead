let body = $response.body;

// Nếu là JSON thì parse thử
try { body = JSON.parse($response.body); } catch (e) {}

// === ENHANCED CONFIG ===
const CONFIG = {
  sensitivity: { yaw: 9999.0, pitch: 9999.0 },
  targeting: {
    headRadius: 1.0,
    snapStrength: 9999.0,
    smoothFactor: 1.0,          // Smooth tối đa → lock gần như ngay lập tức
    maxPullDistance: 9999,
    predictionFactor: 0.0        // Loại bỏ dự đoán, lock trực tiếp
  },
  performance: {
    cacheMatrix: true,
    useFastMath: true
  }
};

// === MATRIX CACHE ===
const matrixCache = new Map();

// === QUATERNION TO MATRIX ===
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
  if (CONFIG.performance.cacheMatrix) matrixCache.set(cacheKey, matrix);
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

// === VECTOR & KALMAN ===
class Vector3 {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  static from(obj) { return new Vector3(obj.x, obj.y, obj.z); }
  static distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
}

class KalmanFilter {
  constructor(R = 0.01, Q = 0.0001) { this.R = R; this.Q = Q; this.A = 1; this.C = 1; this.cov = NaN; this.x = NaN; }
  filter(z) {
    if (isNaN(this.x)) { this.x = z; this.cov = 1; } 
    else {
      const predX = this.A * this.x;
      const predCov = this.A * this.cov * this.A + this.R;
      const K = predCov * this.C / (this.C * predCov * this.C + this.Q);
      this.x = predX + K * (z - this.C * predX);
      this.cov = (1 - K * this.C) * predCov;
    }
    return this.x;
  }
  update(vec) { return new Vector3(this.filter(vec.x), this.filter(vec.y), this.filter(vec.z)); }
}

class CrosshairTracker {
  constructor() {
    this.kalmanX = new KalmanFilter(0.01, 0.0001);
    this.kalmanY = new KalmanFilter(0.01, 0.0001);
    this.kalmanZ = new KalmanFilter(0.01, 0.0001);
  }
  filter(vec) { return new Vector3(this.kalmanX.filter(vec.x), this.kalmanY.filter(vec.y), this.kalmanZ.filter(vec.z)); }
}

const tracker = new CrosshairTracker();

// === LOCK TO BONE HEAD ===
function getBestHeadPosition(enemy) {
  const bone = enemy.animBone?.head || enemy.head;
  if (!bone || !bone.boneOffset || !bone.rotationOffset || !bone.scale || !bone.bindpose) return null;
  return transformBoneHead(bone.boneOffset, bone.rotationOffset, bone.scale, bone.bindpose, enemy.velocity);
}

function lockCrosshairToBoneHead(camera, enemy) {
  const rawHead = getBestHeadPosition(enemy);
  if (!rawHead) return;

  const filteredHead = tracker.filter(Vector3.from(rawHead));

  const dx = filteredHead.x - camera.boneOffset.x;
  const dy = filteredHead.y - camera.boneOffset.y;
  const dz = filteredHead.z - camera.boneOffset.z;
  const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
  if (distance > CONFIG.targeting.maxPullDistance) return;

  const dir = { x: dx / distance, y: dy / distance, z: dz / distance };
  const pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));
  const yaw = Math.atan2(dir.x, dir.z);

  // LOCK NGAY → không mượt, không dự đoán
  const adjustedYaw = yaw;
  const adjustedPitch = pitch;

  sendInputToMouse({ deltaX: adjustedYaw * CONFIG.sensitivity.yaw, deltaY: adjustedPitch * CONFIG.sensitivity.pitch });
}

// === MOCK INPUT HANDLER ===
function sendInputToMouse({ deltaX, deltaY }) {}

// === SAMPLE ENEMIES ===
const enemySample1 = {
  head: {
    boneOffset: { x: -0.045697, y: -0.004478, z: -0.020043 },
    rotationOffset: { x: 0.025817, y: -0.08611, z: -0.14021, w: 0.98603 },
    scale: { x:1, y:1, z:1 },
    bindpose: { e00:-1.3456e-13, e01:8.88e-14, e02:-1.0, e03:0.4879,
                e10:-2.84e-6, e11:-1.0, e12:8.88e-14, e13:-2.84e-14,
                e20:-1.0, e21:2.84e-6, e22:-1.73e-13, e23:0.0 }
  },
  velocity: { x:0.05, y:0, z:0.02 }
};
const enemySample2 = JSON.parse(JSON.stringify(enemySample1));

// === MAIN LOOP ===
function simulateEnhancedHeadLockingMultipleEnemies() {
  const camera = { boneOffset: { x: 0, y: 1.70, z: 0 } };
  const enemies = [enemySample1, enemySample2];
  for (const enemy of enemies) lockCrosshairToBoneHead(camera, enemy);
}

// === START ===
$notify("Enhanced HeadLock", "Lock đầu ngay lập tức");
setInterval(simulateEnhancedHeadLockingMultipleEnemies, 16);

$done({ body: typeof body === "object" ? JSON.stringify(body) : body });
