// === CONFIG ĐỘ NHẠY ===
const sensitivityConfig = {
  yaw: 0.52,
  pitch: 0.49
};
// === QUATERNION → MATRIX ===
function quaternionToMatrix(q) {
  const { x, y, z, w } = q;
  return {
    e00: 1 - 2 * (y * y + z * z),
    e01: 2 * (x * y - z * w),
    e02: 2 * (x * z + y * w),
    e03: 0,

    e10: 2 * (x * y + z * w),
    e11: 1 - 2 * (x * x + z * z),
    e12: 2 * (y * z - x * w),
    e13: 0,

    e20: 2 * (x * z - y * w),
    e21: 2 * (y * z + x * w),
    e22: 1 - 2 * (x * x + y * y),
    e23: 0
  };
}

// === APPLY ROTATION + SCALE + BINDPOSE ===
function transformBoneHead(pos, rotation, scale, bindpose) {
  const rotM = quaternionToMatrix(rotation);

  // Apply rotation
  let x = rotM.e00 * pos.x + rotM.e01 * pos.y + rotM.e02 * pos.z;
  let y = rotM.e10 * pos.x + rotM.e11 * pos.y + rotM.e12 * pos.z;
  let z = rotM.e20 * pos.x + rotM.e21 * pos.y + rotM.e22 * pos.z;

  // Apply scale
  x *= scale.x;
  y *= scale.y;
  z *= scale.z;

  // Apply bindpose (final world position)
  return {
    x: bindpose.e00 * x + bindpose.e01 * y + bindpose.e02 * z + bindpose.e03,
    y: bindpose.e10 * x + bindpose.e11 * y + bindpose.e12 * z + bindpose.e13,
    z: bindpose.e20 * x + bindpose.e21 * y + bindpose.e22 * z + bindpose.e23
  };
}


function lockCrosshairToBoneHead(camera, enemy) {
  const transformedHead = transformBoneHead(
    enemy.head,
    enemy.rotation,
    enemy.scale,
    enemy.bindpose
  );

  const dx = transformedHead.x - camera.position.x;
  const dy = transformedHead.y - camera.position.y;
  const dz = transformedHead.z - camera.position.z;

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const dir = { x: dx / len, y: dy / len, z: dz / len };

  const pitch = -Math.asin(dir.y);
  const yaw = Math.atan2(dir.x, dir.z);

  sendInputToMouse({
    deltaX: yaw * sensitivityConfig.yaw,
    deltaY: pitch * sensitivityConfig.pitch
  });

  console.log(`🔒 Locked to Head (Full Transform) | Yaw=${yaw.toFixed(3)} | Pitch=${pitch.toFixed(3)}`);
}

// === DRAG + SNAP CỰC MẠNH VÀO ĐẦU ===
function adjustAimAfterPull(currentPos, targetHeadPos, armorZonePos, pullDistance, boneInfo = {}) {
  // Offset từ bindpose nếu có
  if (boneInfo.offset) {
    targetHeadPos = {
      x: targetHeadPos.x + boneInfo.offset.x,
      y: targetHeadPos.y + boneInfo.offset.y
    };
  }

  const distToHead = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);
  const distToArmor = Math.hypot(currentPos.x - armorZonePos.x, currentPos.y - armorZonePos.y);

  // Kéo nhẹ về giáp nếu gần hơn
  if (distToArmor < distToHead * 0.7) {
    currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
    currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
  }

  // Kéo mượt bằng easing về đầu
  const t = Math.min(1, pullDistance / 50);
  const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
  const easeFactor = easeOutQuad(t);
  currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * 0.6;
  currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * 0.6;

  // Snap cực mạnh nếu gần vào vùng đầu
  const headRadius = boneInfo.radius || 6.5;
  const distToBone = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);

  if (distToBone < headRadius) {
    const pullFactor = (headRadius - distToBone) / headRadius;
    currentPos.x += (targetHeadPos.x - currentPos.x) * pullFactor * 0.85;
    currentPos.y += (targetHeadPos.y - currentPos.y) * pullFactor * 0.85;
  }

  return currentPos;
}

// === DEMO DÙNG THỬ ===
function simulateHeadLocking() {
  const camera = {
    position: { x: 0, y: 1.7, z: 0 }
  };

  const enemy = {
  head: {
    x: -0.0456970781,
    y: -0.004478302,
    z: -0.0200432576
  },
  rotation: {
    x: 0.0258174837,
    y: -0.08611039,
    z: -0.1402113,
    w: 0.9860321
  },
  scale: {
    x: 0.99999994,
    y: 1.00000012,
    z: 1.0
  },
  bindpose: {
    e00: -1.34559613E-13, e01: 8.881784E-14, e02: -1.0, e03: 0.487912,
    e10: -2.84512817E-06, e11: -1.0, e12: 8.881784E-14, e13: -2.842171E-14,
    e20: -1.0, e21: 2.84512817E-06, e22: -1.72951931E-13, e23: 0.0,
    e30: 0.0, e31: 0.0, e32: 0.0, e33: 1.0
  }
};

  const armorZone = { x: 0.1, y: 0.1 };
  const currentCrosshair = { x: 0.0, y: 0.0 };
  const pullDistance = 15;

  const pulledAim = adjustAimAfterPull(currentCrosshair, enemy.head, armorZone, pullDistance, {
    offset: { x: 0.002, y: 0.004 },
    radius: 7.0
  });

  console.log("🎯 Adjusted Aim Pos:", pulledAim);

  lockCrosshairToBoneHead(camera, enemy);
}

// === MOCK INPUT MOUSE ===
function sendInputToMouse({ deltaX, deltaY }) {
  console.log(`🖱️ Move Mouse → ΔX=${deltaX.toFixed(3)} | ΔY=${deltaY.toFixed(3)}`);
}

// === CHẠY DEMO ===
simulateHeadLocking();
